#!/usr/bin/env python3
"""Install and validate five-slot artillery and tracked-vehicle strips."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw

from generate_pose_board_production_assets import add_team_accent
from install_human_three_frame_strips import extract_strip_figures


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/dev-wiki/visual-drafts/mechanized-3frame-v1"
ASSET_DIR = ROOT / "public/assets/production/units"
ARTIFACT_DIR = ROOT / "artifacts/mechanized-3frame-v1"
POSES = ("idle", "walk-01", "walk-02", "walk-03", "attack")
CANVAS_SIZE = (768, 384)
ANCHOR_Y = 336
TARGET_HEIGHT = 250
SAFE_MARGIN = 12


@dataclass(frozen=True)
class MechanizedSpec:
    unit_id: str
    prefix: str
    role: str
    locomotion: str


UNITS = (
    MechanizedSpec("cannon_i", "cannon-i", "artillery", "wheel"),
    MechanizedSpec("cannon_ii", "cannon-ii", "artillery", "wheel"),
    MechanizedSpec("artillery_i", "artillery-i", "artillery", "wheel"),
    MechanizedSpec("artillery_ii", "artillery-ii", "artillery", "wheel"),
    MechanizedSpec("tank", "tank", "vehicle", "track"),
    MechanizedSpec("mobile_artillery", "mobile-artillery", "vehicle", "track"),
    MechanizedSpec("modern_tank", "modern-tank", "vehicle", "track"),
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("empty alpha content")
    return bbox


def reference_scale(image: Image.Image) -> float:
    left, top, right, bottom = alpha_bbox(image)
    scale = TARGET_HEIGHT / max(1, bottom - top)
    return min(scale, (CANVAS_SIZE[0] - SAFE_MARGIN * 2) / max(1, right - left))


def normalize_with_body_anchor(image: Image.Image, scale: float) -> Image.Image:
    content = image.crop(alpha_bbox(image))
    resized = content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )
    alpha = np.asarray(resized.getchannel("A")) >= 40
    ys, xs = np.where(alpha)
    if not len(xs):
        raise ValueError("empty resized frame")

    # Median opaque-pixel X follows the chassis instead of detached muzzle flash.
    body_center_x = float(np.median(xs))
    x = round(CANVAS_SIZE[0] / 2 - body_center_x)
    y = ANCHOR_Y - (int(ys.max()) + 1)
    if x < SAFE_MARGIN or x + resized.width > CANVAS_SIZE[0] - SAFE_MARGIN:
        raise ValueError(
            f"frame cannot fit safe horizontal margins: x={x}, width={resized.width}"
        )
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(resized, (x, y))
    return canvas


def region_rgb_difference(first: Image.Image, second: Image.Image) -> float:
    first_rgba = np.asarray(first, dtype=np.float32)
    second_rgba = np.asarray(second, dtype=np.float32)
    start_y = round(first.height * 0.48)
    opaque = (first_rgba[start_y:, :, 3] >= 40) | (second_rgba[start_y:, :, 3] >= 40)
    if not opaque.any():
        return 0.0
    delta = np.abs(first_rgba[start_y:, :, :3] - second_rgba[start_y:, :, :3])
    return float(delta[opaque].mean())


def silhouette_difference(first: Image.Image, second: Image.Image) -> float:
    diff = ImageChops.difference(first.getchannel("A"), second.getchannel("A"))
    return sum(diff.getdata()) / (255 * first.width * first.height)


def install_unit(spec: MechanizedSpec) -> dict[str, object]:
    source_path = SOURCE_DIR / f"{spec.prefix}-e-5slot-source.png"
    frames = extract_strip_figures(Image.open(source_path).convert("RGBA"), spec.prefix)
    if len(frames) != len(POSES):
        raise ValueError(f"{spec.prefix}: expected five frames, got {len(frames)}")

    scale = reference_scale(frames[0])
    production = {
        pose: normalize_with_body_anchor(frame, scale)
        for pose, frame in zip(POSES, frames)
    }
    for pose, canvas in production.items():
        add_team_accent(canvas, spec.role, "player", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}.png"
        )
        add_team_accent(canvas, spec.role, "enemy", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}-enemy.png"
        )

    boxes = {pose: alpha_bbox(frame) for pose, frame in production.items()}
    heights = {pose: box[3] - box[1] for pose, box in boxes.items()}
    widths = {pose: box[2] - box[0] for pose, box in boxes.items()}
    centers = {pose: round((box[0] + box[2]) / 2, 1) for pose, box in boxes.items()}
    walk_heights = [heights[pose] for pose in POSES[:4]]
    walk_widths = [widths[pose] for pose in POSES[:4]]
    wheel_differences = {
        "01-02": round(region_rgb_difference(production["walk-01"], production["walk-02"]), 3),
        "02-03": round(region_rgb_difference(production["walk-02"], production["walk-03"]), 3),
        "03-01": round(region_rgb_difference(production["walk-03"], production["walk-01"]), 3),
    }
    walk_silhouettes = {
        "01-02": round(silhouette_difference(production["walk-01"], production["walk-02"]), 4),
        "02-03": round(silhouette_difference(production["walk-02"], production["walk-03"]), 4),
    }
    safe = all(
        box[0] >= SAFE_MARGIN
        and box[1] >= SAFE_MARGIN
        and box[2] <= CANVAS_SIZE[0] - SAFE_MARGIN
        and box[3] <= ANCHOR_Y
        for box in boxes.values()
    )
    checks = {
        "five_frames": len(frames) == 5,
        "not_clipped": safe,
        "locomotion_height_consistent": max(walk_heights) / max(1, min(walk_heights)) <= 1.12,
        "locomotion_width_consistent": max(walk_widths) / max(1, min(walk_widths)) <= 1.18,
        "wheel_or_track_phases_distinct": min(wheel_differences.values()) >= 2.0,
        "attack_height_consistent": 0.88 <= heights["attack"] / heights["idle"] <= 1.12,
        "attack_body_anchor_consistent": abs(centers["attack"] - centers["idle"]) <= 58,
    }
    return {
        "unitId": spec.unit_id,
        "prefix": spec.prefix,
        "locomotion": spec.locomotion,
        "source": str(source_path.relative_to(ROOT)),
        "checks": checks,
        "pass": all(checks.values()),
        "widths": widths,
        "heights": heights,
        "alphaCentersX": centers,
        "wheelTrackRgbDifferences": wheel_differences,
        "walkSilhouetteDifferences": walk_silhouettes,
    }


def write_contact_sheet() -> None:
    tile_w, tile_h = 360, 230
    sheet = Image.new("RGBA", (tile_w * len(POSES), tile_h * len(UNITS)), (10, 20, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for row, spec in enumerate(UNITS):
        for col, pose in enumerate(POSES):
            frame = Image.open(ASSET_DIR / f"{spec.prefix}-e-{pose}.png").convert("RGBA")
            frame.thumbnail((tile_w - 12, tile_h - 30), Image.Resampling.LANCZOS)
            x = col * tile_w + (tile_w - frame.width) // 2
            y = row * tile_h + tile_h - frame.height
            sheet.alpha_composite(frame, (x, y))
            if row == 0:
                draw.text((col * tile_w + 8, 4), pose, fill=(220, 232, 242, 255))
        draw.text((8, row * tile_h + 4), spec.prefix, fill=(120, 210, 255, 255))
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(ARTIFACT_DIR / "production-contact-sheet.jpg", quality=94)


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    results = [install_unit(spec) for spec in UNITS]
    write_contact_sheet()
    report = {"contract": ["walk-01", "walk-02", "walk-03"], "units": results}
    (ARTIFACT_DIR / "qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    for result in results:
        state = "PASS" if result["pass"] else "FAIL"
        differences = result["wheelTrackRgbDifferences"]
        print(f"{state:4} {result['prefix']:<18} phase-rgb={differences}")
        if not result["pass"]:
            print("     failed:", [key for key, value in result["checks"].items() if not value])
    return 0 if all(result["pass"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
