#!/usr/bin/env python3
"""Split a prototype contact sheet and normalize assets to the style contract."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path

from PIL import Image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("asset has no opaque pixels")
    return bbox


def extract_connected_components(
    image: Image.Image,
    alpha_threshold: int = 12,
) -> list[dict[str, object]]:
    pixels = image.load()
    visited: set[tuple[int, int]] = set()
    components: list[dict[str, object]] = []

    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][3] < alpha_threshold or (x, y) in visited:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            points: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if not (0 <= nx < image.width and 0 <= ny < image.height):
                        continue
                    if pixels[nx, ny][3] < alpha_threshold or (nx, ny) in visited:
                        continue
                    visited.add((nx, ny))
                    queue.append((nx, ny))
            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            components.append({
                "points": points,
                "bbox": (min(xs), min(ys), max(xs) + 1, max(ys) + 1),
                "centroid": (sum(xs) / len(xs), sum(ys) / len(ys)),
            })
    return components


def build_component_assignment(
    source: Image.Image,
    columns: int,
    rows: int,
) -> dict[tuple[int, int], Image.Image]:
    slot_width = source.width / columns
    slot_height = source.height / rows
    assignments: dict[tuple[int, int], list[dict[str, object]]] = defaultdict(list)

    for component in extract_connected_components(source):
        centroid_x, centroid_y = component["centroid"]  # type: ignore[index]
        best_key: tuple[int, int] | None = None
        best_distance = float("inf")
        for row in range(rows):
            center_y = (row + 0.5) * slot_height
            for column in range(columns):
                center_x = (column + 0.5) * slot_width
                distance = (centroid_x - center_x) ** 2 + (centroid_y - center_y) ** 2
                if distance < best_distance:
                    best_distance = distance
                    best_key = (column, row)
        assert best_key is not None
        assignments[best_key].append(component)

    rendered: dict[tuple[int, int], Image.Image] = {}
    for key, components in assignments.items():
        merged = Image.new("RGBA", source.size, (0, 0, 0, 0))
        merged_pixels = merged.load()
        source_pixels = source.load()
        for component in components:
            for x, y in component["points"]:  # type: ignore[index]
                merged_pixels[x, y] = source_pixels[x, y]
        bbox = alpha_bbox(merged)
        rendered[key] = merged.crop(bbox)
    return rendered


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="tools/asset-qa/golden-reference-assets.json")
    parser.add_argument("--output", default="public/assets/golden-reference")
    args = parser.parse_args()

    spec_path = Path(args.spec)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    sources: dict[str, Image.Image] = {}
    component_cache: dict[tuple[str, int, int], dict[tuple[int, int], Image.Image]] = {}
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    report: list[dict[str, object]] = []
    for asset in spec["assets"]:
        source_path = asset.get("source", spec["source"])
        if source_path not in sources:
            sources[source_path] = Image.open(source_path).convert("RGBA")
        source = sources[source_path]
        use_component_assignment = bool(asset.get("assignByComponent", spec.get("assignByComponent", False)))
        if "crop" in asset:
            cell = source.crop(tuple(asset["crop"]))
        else:
            columns = asset.get("columns", spec["columns"])
            rows = asset.get("rows", spec["rows"])
            cell_width = source.width // columns
            cell_height = source.height // rows
            fallback_left = asset["column"] * cell_width
            fallback_top = asset["row"] * cell_height
            fallback_cell = source.crop((
                fallback_left,
                fallback_top,
                fallback_left + cell_width,
                fallback_top + cell_height,
            ))
            if use_component_assignment:
                cache_key = (source_path, columns, rows)
                if cache_key not in component_cache:
                    component_cache[cache_key] = build_component_assignment(source, columns, rows)
                cell = component_cache[cache_key].get((asset["column"], asset["row"]), fallback_cell)
            else:
                cell = fallback_cell
        content = cell.crop(alpha_bbox(cell))
        target_width, target_height = asset["canvas"]
        anchor_x, anchor_y = asset["anchor"]
        desired_height = asset["opaqueHeight"]
        scale = desired_height / content.height
        max_width = target_width - 24
        if content.width * scale > max_width:
            scale = max_width / content.width
        resized = content.resize(
            (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        x = round(anchor_x - resized.width / 2)
        y = round(anchor_y - resized.height)
        canvas.alpha_composite(resized, (x, y))
        output_path = output_dir / asset.get("filename", f"prototype-golden-{asset['key']}-v1.png")
        canvas.save(output_path)
        bbox = alpha_bbox(canvas)
        report.append({
            "key": asset["key"],
            "output": str(output_path),
            "canvas": [target_width, target_height],
            "alphaBbox": list(bbox),
            "groundAnchor": [anchor_x, anchor_y],
        })

    report_path = output_dir / "prototype-golden-normalization-report-v1.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"normalized {len(report)} assets -> {output_dir}")


if __name__ == "__main__":
    main()
