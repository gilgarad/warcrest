#!/usr/bin/env python3
"""Install and validate the four east-authored cavalry three-frame strips."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from generate_pose_board_production_assets import (
    WIDE_CANVAS,
    add_team_accent,
    compute_reference_scale,
    normalize_to_canvas,
)
from install_human_three_frame_strips import extract_strip_figures


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/dev-wiki/visual-drafts/cavalry-3frame-v1"
ASSET_DIR = ROOT / "public/assets/production/units"
ARTIFACT_DIR = ROOT / "artifacts/cavalry-3frame-v1"
POSES = ("idle", "walk-01", "walk-02", "walk-03", "attack")
HEAVY_LOCOMOTION_CANVAS = (512, 512)
HEAVY_ATTACK_CANVAS = (768, 384)


@dataclass(frozen=True)
class CavalrySpec:
    unit_id: str
    prefix: str
    design: str


CAVALRY = (
    CavalrySpec("knight", "knight", "late-Iron medieval knight, shield and sword"),
    CavalrySpec("heavy_cavalry", "heavy-cavalry", "Renaissance cuirassier, lance"),
    CavalrySpec("light_cavalry", "light-cavalry", "early-industrial hussar, sabre"),
    CavalrySpec("cavalry", "cavalry", "late-industrial cavalry, sabre and carbine"),
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("empty alpha content")
    return bbox


def silhouette_difference(first: Image.Image, second: Image.Image, lower_only: bool = False) -> float:
    if lower_only:
        top = round(first.height * 0.56)
        first = first.crop((0, top, first.width, first.height))
        second = second.crop((0, top, second.width, second.height))
    diff = ImageChops.difference(first.getchannel("A"), second.getchannel("A"))
    return sum(diff.getdata()) / (255 * first.width * first.height)


def install_unit(spec: CavalrySpec) -> dict[str, object]:
    source_path = SOURCE_DIR / f"{spec.prefix}-e-5slot-source.png"
    frames = extract_strip_figures(Image.open(source_path).convert("RGBA"), spec.prefix)

    if spec.prefix == "heavy-cavalry":
        # The upright lance must not shrink the horse. The attack pose has the
        # same horse/rider at an unobstructed body height, so it is the scale reference.
        reference_scale = compute_reference_scale(frames[-1], HEAVY_ATTACK_CANVAS)
    else:
        reference_scale = compute_reference_scale(frames[0], WIDE_CANVAS)

    production: dict[str, Image.Image] = {}
    for pose, frame in zip(POSES, frames):
        if spec.prefix == "heavy-cavalry" and pose != "attack":
            canvas_size = HEAVY_LOCOMOTION_CANVAS
            anchor_y = 448
        elif spec.prefix == "heavy-cavalry":
            canvas_size = HEAVY_ATTACK_CANVAS
            anchor_y = 336
        else:
            canvas_size = WIDE_CANVAS
            anchor_y = 336
        canvas = normalize_to_canvas(frame, canvas_size, reference_scale, anchor_y)
        production[pose] = canvas
        add_team_accent(canvas, "cavalry", "player", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}.png"
        )
        add_team_accent(canvas, "cavalry", "enemy", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}-enemy.png"
        )

    boxes = {pose: alpha_bbox(frame) for pose, frame in production.items()}
    unclipped = all(
        box[0] >= 8
        and box[1] >= 8
        and box[2] <= production[pose].width - 8
        and box[3] <= production[pose].height - 8
        for pose, box in boxes.items()
    )
    stride_difference = silhouette_difference(production["walk-01"], production["walk-03"])
    leg_difference = silhouette_difference(
        production["walk-01"], production["walk-03"], lower_only=True
    )
    checks = {
        "five_complete_poses": len(frames) == len(POSES),
        "not_clipped": unclipped,
        "opposite_stride_silhouettes": stride_difference >= 0.004,
        "opposite_horse_leg_silhouettes": leg_difference >= 0.012,
    }
    return {
        "unitId": spec.unit_id,
        "prefix": spec.prefix,
        "design": spec.design,
        "source": str(source_path.relative_to(ROOT)),
        "checks": checks,
        "pass": all(checks.values()),
        "strideDifference": round(stride_difference, 4),
        "legDifference": round(leg_difference, 4),
        "boxes": boxes,
    }


def write_contact_sheet() -> None:
    tile_w, tile_h = 320, 300
    sheet = Image.new("RGBA", (tile_w * len(POSES), tile_h * len(CAVALRY)), (10, 20, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for row, spec in enumerate(CAVALRY):
        for col, pose in enumerate(POSES):
            frame = Image.open(ASSET_DIR / f"{spec.prefix}-e-{pose}.png").convert("RGBA")
            frame.thumbnail((tile_w - 18, tile_h - 38), Image.Resampling.LANCZOS)
            x = col * tile_w + (tile_w - frame.width) // 2
            y = row * tile_h + tile_h - frame.height - 8
            sheet.alpha_composite(frame, (x, y))
            if row == 0:
                draw.text((col * tile_w + 8, 6), pose, fill=(220, 232, 242, 255))
        draw.text((8, row * tile_h + 6), spec.prefix, fill=(120, 210, 255, 255))
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(ARTIFACT_DIR / "cavalry-production-contact-sheet.jpg", quality=93)


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    results = [install_unit(spec) for spec in CAVALRY]
    write_contact_sheet()
    report = {"contract": ["walk-01", "walk-02", "walk-03", "walk-02"], "units": results}
    (ARTIFACT_DIR / "qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    for result in results:
        state = "PASS" if result["pass"] else "FAIL"
        print(
            f"{state:4} {result['prefix']:<16} "
            f"stride={result['strideDifference']:.4f} legs={result['legDifference']:.4f}"
        )
    return 0 if all(result["pass"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
