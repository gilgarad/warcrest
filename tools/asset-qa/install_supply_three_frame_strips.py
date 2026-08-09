#!/usr/bin/env python3
"""Install and validate the six approved supply-unit five-slot source strips."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from scipy import ndimage

from generate_pose_board_production_assets import (
    WIDE_CANVAS,
    add_team_accent,
    compute_reference_scale,
    normalize_to_canvas,
)
from install_human_three_frame_strips import extract_strip_figures


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/dev-wiki/visual-drafts/supply-3frame-v1"
ASSET_DIR = ROOT / "public/assets/production/units"
ARTIFACT_DIR = ROOT / "artifacts/supply-3frame-v1"
POSES = ("idle", "walk-01", "walk-02", "walk-03", "attack")
ANCHOR_Y = 336


@dataclass(frozen=True)
class SupplySpec:
    age_group: str
    prefix: str


SUPPLY_SPECS = (
    SupplySpec("stone/bronze", "supply-wagon-ancient"),
    SupplySpec("iron", "supply-wagon-iron"),
    SupplySpec("renaissance", "supply-wagon-renaissance"),
    SupplySpec("industrial", "supply-wagon-industrial"),
    SupplySpec("modern early", "supply-wagon-modern-early"),
    SupplySpec("modern mid/late", "supply-wagon-modern-late"),
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("empty alpha content")
    return bbox


def silhouette_difference(first: Image.Image, second: Image.Image) -> float:
    diff = ImageChops.difference(first.getchannel("A"), second.getchannel("A"))
    return sum(diff.getdata()) / (255 * first.width * first.height)


def lower_body_difference(first: Image.Image, second: Image.Image) -> float:
    first_alpha = np.asarray(first.getchannel("A"), dtype=np.float32)
    second_alpha = np.asarray(second.getchannel("A"), dtype=np.float32)
    top = round(first.height * 0.58)
    return float(np.abs(first_alpha[top:] - second_alpha[top:]).mean() / 255)


def align_alpha_mass_x(image: Image.Image) -> Image.Image:
    """Keep the actor body centered even when the heal hand extends to the right."""
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    ys, xs = np.where(alpha >= 32)
    if xs.size == 0:
        return image
    shift_x = round(image.width / 2 - float(np.median(xs)))
    if shift_x == 0:
        return image
    aligned = Image.new("RGBA", image.size, (0, 0, 0, 0))
    aligned.alpha_composite(image, (shift_x, 0))
    return aligned


def recolor_semitransparent_edges(image: Image.Image, opaque_alpha_cutoff = 220) -> Image.Image:
    """Replace black-matte fringe RGB with the nearest real sprite color."""
    rgba = np.asarray(image.convert("RGBA")).copy()
    alpha = rgba[:, :, 3]
    opaque = alpha >= opaque_alpha_cutoff
    semi = (alpha > 0) & ~opaque
    if not semi.any() or not opaque.any():
      return image
    _, nearest = ndimage.distance_transform_edt(~opaque, return_indices=True)
    rgba[semi, 0] = rgba[:, :, 0][nearest[0][semi], nearest[1][semi]]
    rgba[semi, 1] = rgba[:, :, 1][nearest[0][semi], nearest[1][semi]]
    rgba[semi, 2] = rgba[:, :, 2][nearest[0][semi], nearest[1][semi]]
    return Image.fromarray(rgba, "RGBA")


def reinforce_visible_alpha(
    image: Image.Image,
    minimum_alpha = 150,
    easing = 0.6,
    clear_below_alpha = 0,
) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    alpha = rgba[:, :, 3].astype(np.float32)
    if clear_below_alpha > 0:
        alpha[alpha < clear_below_alpha] = 0
    semi = (alpha > 0) & (alpha < 255)
    if not semi.any():
        return image
    lifted = 255 - ((255 - alpha[semi]) * easing)
    rgba[:, :, 3][semi] = np.clip(np.maximum(lifted, minimum_alpha), 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def install_supply(spec: SupplySpec) -> dict[str, object]:
    raw_source = SOURCE_DIR / f"{spec.prefix}-e-5slot-source.png"
    alpha_source = SOURCE_DIR / f"{spec.prefix}-e-5slot-source-alpha.png"
    if not raw_source.exists() or not alpha_source.exists():
        raise FileNotFoundError(f"missing source pair for {spec.prefix}")

    source_frames = extract_strip_figures(Image.open(alpha_source).convert("RGBA"), spec.prefix)
    if len(source_frames) != len(POSES):
        raise ValueError(f"{spec.prefix}: expected five poses, got {len(source_frames)}")

    reference_scale = compute_reference_scale(source_frames[0], WIDE_CANVAS)
    production: dict[str, Image.Image] = {}
    for pose, frame in zip(POSES, source_frames):
        canvas = recolor_semitransparent_edges(
            align_alpha_mass_x(
                normalize_to_canvas(frame, WIDE_CANVAS, reference_scale, ANCHOR_Y)
            )
        )
        if spec.prefix == "supply-wagon-modern-late":
            canvas = reinforce_visible_alpha(canvas, minimum_alpha=196, easing=0.32, clear_below_alpha=82)
        else:
            canvas = reinforce_visible_alpha(canvas, minimum_alpha=208, easing=0.24, clear_below_alpha=82)
        production[pose] = canvas
        add_team_accent(canvas, "support", "player", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}.png"
        )
        add_team_accent(canvas, "support", "enemy", spec.prefix).save(
            ASSET_DIR / f"{spec.prefix}-e-{pose}-enemy.png"
        )

    boxes = {pose: alpha_bbox(frame) for pose, frame in production.items()}
    heights = {pose: box[3] - box[1] for pose, box in boxes.items()}
    locomotion_heights = [heights[pose] for pose in POSES[:-1]]
    height_ratio = max(locomotion_heights) / max(1, min(locomotion_heights))
    full_difference = silhouette_difference(production["walk-01"], production["walk-03"])
    leg_difference = lower_body_difference(production["walk-01"], production["walk-03"])
    minimum_leg_difference = 0.016 if spec.prefix == "supply-wagon-modern-late" else 0.018
    unclipped = all(
        box[0] >= 12
        and box[1] >= 12
        and box[2] <= production[pose].width - 12
        and box[3] <= production[pose].height - 24
        for pose, box in boxes.items()
    )
    checks = {
        "five_complete_poses": len(source_frames) == 5,
        "safe_canvas_margins": unclipped,
        "locomotion_height_consistent": height_ratio <= 1.08,
        "opposite_stride_silhouettes_distinct": full_difference >= 0.012,
        "opposite_stride_lower_bodies_distinct": leg_difference >= minimum_leg_difference,
        "heal_reaches_beyond_idle": boxes["attack"][2] > boxes["idle"][2] + 18,
    }
    return {
        "ageGroup": spec.age_group,
        "prefix": spec.prefix,
        "uncutSource": str(raw_source.relative_to(ROOT)),
        "alphaSource": str(alpha_source.relative_to(ROOT)),
        "checks": checks,
        "pass": all(checks.values()),
        "heightRatio": round(height_ratio, 4),
        "walkSilhouetteDifference": round(full_difference, 4),
        "walkLowerBodyDifference": round(leg_difference, 4),
        "boxes": boxes,
    }


def write_contact_sheet() -> None:
    tile_w, tile_h = 280, 310
    sheet = Image.new("RGBA", (tile_w * len(POSES), tile_h * len(SUPPLY_SPECS)), (10, 20, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for row, spec in enumerate(SUPPLY_SPECS):
        for col, pose in enumerate(POSES):
            image = Image.open(ASSET_DIR / f"{spec.prefix}-e-{pose}.png").convert("RGBA")
            image.thumbnail((tile_w - 20, tile_h - 42), Image.Resampling.LANCZOS)
            x = col * tile_w + (tile_w - image.width) // 2
            y = row * tile_h + 32 + (tile_h - 38 - image.height)
            sheet.alpha_composite(image, (x, y))
            if row == 0:
                draw.text((col * tile_w + 8, 6), pose, fill=(220, 232, 242, 255))
        draw.text((8, row * tile_h + 6), spec.age_group, fill=(120, 210, 255, 255))
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(ARTIFACT_DIR / "production-contact-sheet.jpg", quality=92)


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    results = [install_supply(spec) for spec in SUPPLY_SPECS]
    write_contact_sheet()
    report = {
        "contract": ["walk-01", "walk-02", "walk-03", "walk-02"],
        "healPoseRuntimeName": "attack",
        "units": results,
    }
    (ARTIFACT_DIR / "qa-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    for result in results:
        state = "PASS" if result["pass"] else "FAIL"
        print(
            f"{state:4} {result['prefix']:<34} "
            f"height={result['heightRatio']:.3f} "
            f"silhouette={result['walkSilhouetteDifference']:.3f} "
            f"legs={result['walkLowerBodyDifference']:.3f}"
        )
    return 0 if all(result["pass"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
