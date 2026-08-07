#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path
from typing import Sequence

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_HELPER = ROOT / "tools/asset-qa/generate_pose_board_production_assets.py"
DEFAULT_STRIP = ROOT / "docs/dev-wiki/visual-drafts/rifleman-e-3frame-strip-current.png"
DEST_DIR = ROOT / "public/assets/production/units"
POSES = tuple(f"walk-{index:02d}" for index in range(1, 4))


def load_helper_module():
    spec = importlib.util.spec_from_file_location("pose_helper", SOURCE_HELPER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load helper module from {SOURCE_HELPER}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["pose_helper"] = module
    spec.loader.exec_module(module)
    return module


def extract_components(image: Image.Image) -> list[tuple[int, int, int, int]]:
    alpha = image.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    visited = [[False] * width for _ in range(height)]
    components: list[tuple[int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if visited[y][x] or pixels[x, y] < 12:
                continue
            stack = [(x, y)]
            visited[y][x] = True
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and not visited[ny][nx] and pixels[nx, ny] >= 12:
                        visited[ny][nx] = True
                        stack.append((nx, ny))
            if count >= 400:
                components.append((min_x, min_y, max_x + 1, max_y + 1))
    return sorted(components, key=lambda bbox: bbox[0])


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install rifleman east walk assets from an uncut strip.")
    parser.add_argument("--strip", type=Path, default=DEFAULT_STRIP)
    parser.add_argument(
        "--walk-03-source",
        type=Path,
        help="Install one uncut chroma-key source as rifleman east walk-03.",
    )
    parser.add_argument(
        "--attack-source",
        type=Path,
        help="Install one uncut chroma-key source as the rifleman east attack frame.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    module = load_helper_module()
    spec = next(unit for unit in module.UNIT_SPECS if unit.prefix == "rifleman")
    reference = Image.open(DEST_DIR / "rifleman-e-idle.png").convert("RGBA")
    scale = module.compute_reference_scale(reference, module.STANDARD_CANVAS)

    debug_dir = ROOT / "artifacts/rifleman-e-triplet"
    debug_dir.mkdir(parents=True, exist_ok=True)

    if args.attack_source:
        source = Image.open(args.attack_source).convert("RGBA")
        removed = module.remove_background(source)
        components = extract_components(removed)
        if len(components) != 1:
            raise RuntimeError(
                f"Expected one connected character in {args.attack_source}, found {len(components)}"
            )
        content = module.cleanup_content_image(removed.crop(components[0]), spec)
        attack_scale = module.compute_reference_scale(content, module.WIDE_CANVAS)
        player = module.cleanup_canvas(
            module.normalize_to_canvas(content, module.WIDE_CANVAS, attack_scale),
            spec,
        )
        enemy = module.add_team_accent(player, spec.role, "enemy")
        player.save(DEST_DIR / "rifleman-e-attack.png")
        enemy.save(DEST_DIR / "rifleman-e-attack-enemy.png")
        player.save(debug_dir / "rifleman-e-attack.png")
        return 0

    if args.walk_03_source:
        source = Image.open(args.walk_03_source).convert("RGBA")
        removed = module.remove_background(source)
        components = extract_components(removed)
        if len(components) != 1:
            raise RuntimeError(
                f"Expected one connected character in {args.walk_03_source}, found {len(components)}"
            )
        content = removed.crop(components[0])
        cleaned = module.cleanup_content_image(content, spec)
        normalized = module.normalize_to_canvas(cleaned, module.STANDARD_CANVAS, scale)
        player = module.cleanup_canvas(normalized, spec)
        enemy = module.add_team_accent(player, spec.role, "enemy")
        player.save(DEST_DIR / "rifleman-e-walk-03.png")
        enemy.save(DEST_DIR / "rifleman-e-walk-03-enemy.png")
        player.save(debug_dir / "rifleman-e-walk-03.png")
        return 0

    strip = Image.open(args.strip).convert("RGBA")
    removed = module.remove_background(strip)
    components = extract_components(removed)
    if len(components) != len(POSES):
        raise RuntimeError(f"Expected {len(POSES)} connected components in {args.strip}, found {len(components)}")

    strip.copy().save(debug_dir / "source-strip.png")

    for pose, bbox in zip(POSES, components):
        content = removed.crop(bbox)
        cleaned = module.cleanup_content_image(content, spec)
        normalized = module.normalize_to_canvas(cleaned, module.STANDARD_CANVAS, scale)
        normalized = module.cleanup_canvas(normalized, spec)
        player = normalized
        enemy = module.add_team_accent(normalized, spec.role, "enemy")
        player.save(DEST_DIR / f"rifleman-e-{pose}.png")
        enemy.save(DEST_DIR / f"rifleman-e-{pose}-enemy.png")
        player.save(debug_dir / f"rifleman-e-{pose}.png")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
