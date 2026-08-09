#!/usr/bin/env python3
"""Install and validate the approved five-slot biped infantry source strips."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw
import numpy as np
from scipy import ndimage

from generate_pose_board_production_assets import (
    STANDARD_CANVAS,
    WIDE_CANVAS,
    add_team_accent,
    compute_reference_scale,
    normalize_to_canvas,
    remove_background,
)


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/dev-wiki/visual-drafts/human-3frame-v2"
ASSET_DIR = ROOT / "public/assets/production/units"
ARTIFACT_DIR = ROOT / "artifacts/human-3frame-v2"
POSES = ("idle", "walk-01", "walk-02", "walk-03", "attack")
PIKEMAN_CANVAS = (384, 512)
PIKEMAN_ANCHOR_Y = 448
PIKEMAN_ATTACK_CANVAS = (1024, 384)


@dataclass(frozen=True)
class BipedSpec:
    unit_id: str
    prefix: str
    expected_equipment: str
    reference_scale_multiplier: float = 1.0


BIPEDS = (
    BipedSpec("stone_slinger", "stone-slinger", "sling"),
    BipedSpec("stone_axeman", "stone-axeman", "stone axe"),
    BipedSpec("bronze_swordsman", "bronze-swordsman", "bronze sword and round shield"),
    BipedSpec("bronze_spearman", "bronze-spearman", "bronze spear and round shield"),
    BipedSpec("archer", "archer", "bow"),
    BipedSpec("iron_swordsman", "iron-swordsman", "iron sword and kite shield"),
    BipedSpec("iron_spearman", "iron-spearman", "iron spear"),
    BipedSpec("musketeer", "musketeer", "matchlock musket"),
    # The pike is much taller than the person. A taller transparent canvas keeps
    # the weapon intact without shrinking the soldier below the infantry scale.
    BipedSpec("pikeman", "pikeman", "long pike; no firearm", 1.65),
    BipedSpec("grenadier", "grenadier", "round hand grenade; no firearm"),
    BipedSpec("rifleman_late", "rifleman-late", "late rifle"),
    BipedSpec("grenadier_late", "grenadier-late", "cylindrical hand grenade; no firearm"),
    BipedSpec("infantry", "infantry", "service rifle"),
    BipedSpec("machine_gunner", "machine-gunner", "machine gun"),
    BipedSpec("shock_trooper", "shock-trooper", "assault weapon"),
    BipedSpec("automatic_rifleman", "automatic-rifleman", "automatic rifle"),
    BipedSpec("support_gunner", "support-gunner", "support weapon"),
    BipedSpec("mobile_infantry", "mobile-infantry", "carbine"),
    BipedSpec("special_forces", "special-forces", "special-operations rifle"),
    BipedSpec("heavy_gunner", "heavy-gunner", "heavy weapon"),
    BipedSpec("breakthrough_trooper", "breakthrough-trooper", "assault rifle"),
)


def split_strip(path: Path, prefix: str) -> list[Image.Image]:
    return extract_strip_figures(Image.open(path).convert("RGBA"), prefix)


def extract_strip_figures(strip: Image.Image, prefix: str) -> list[Image.Image]:
    transparent = remove_background(strip)
    alpha = np.asarray(transparent.getchannel("A")) >= 12
    labels, count = ndimage.label(alpha)
    if count < len(POSES):
        raise ValueError(f"{prefix}: expected at least five separated figures, got {count}")

    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main_labels = np.argsort(sizes)[-len(POSES):]
    main_centers = []
    for label in main_labels:
        xs = np.where(labels == label)[1]
        main_centers.append((float(xs.mean()), int(label)))
    main_centers.sort()

    groups: list[list[int]] = [[label] for _, label in main_centers]
    for label in range(1, count + 1):
        if label in main_labels or sizes[label] < 40:
            continue
        xs = np.where(labels == label)[1]
        center = float(xs.mean())
        nearest = min(range(len(main_centers)), key=lambda index: abs(main_centers[index][0] - center))
        groups[nearest].append(label)

    rgba = np.asarray(transparent).copy()
    figures = []
    for group in groups:
        keep = np.isin(labels, group)
        isolated = rgba.copy()
        isolated[~keep] = 0
        figure = Image.fromarray(isolated, "RGBA")
        bbox = figure.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"{prefix}: empty extracted figure")
        figures.append(figure.crop(bbox))
    return figures


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = np.asarray(image.getchannel("A")) >= 12
    labels, count = ndimage.label(alpha)
    if count == 0:
        return image
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    keep = labels == int(sizes.argmax())
    rgba = np.asarray(image).copy()
    rgba[~keep] = 0
    result = Image.fromarray(rgba, "RGBA")
    bbox = result.getchannel("A").getbbox()
    return result.crop(bbox) if bbox else result


def keep_rightmost_substantial_component(image: Image.Image) -> Image.Image:
    alpha = np.asarray(image.getchannel("A")) >= 12
    labels, count = ndimage.label(alpha)
    if count == 0:
        return image
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    largest = int(sizes.max())
    candidates = []
    for label in range(1, count + 1):
        if sizes[label] < max(40, round(largest * 0.2)):
            continue
        xs = np.where(labels == label)[1]
        candidates.append((float(xs.mean()), label))
    selected = max(candidates)[1] if candidates else int(sizes.argmax())
    keep = labels == selected
    rgba = np.asarray(image).copy()
    rgba[~keep] = 0
    result = Image.fromarray(rgba, "RGBA")
    bbox = result.getchannel("A").getbbox()
    return result.crop(bbox) if bbox else result


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("empty alpha content")
    return bbox


def chroma_source_margins(image: Image.Image) -> dict[str, int]:
    rgb = np.asarray(image.convert("RGB"))
    foreground = ~(
        (rgb[:, :, 1] > rgb[:, :, 0] * 1.25)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.25)
        & (rgb[:, :, 1] > 100)
    )
    labels, count = ndimage.label(foreground)
    if count == 0:
        raise ValueError("empty chroma-key foreground")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    ys, xs = np.where(labels == int(sizes.argmax()))
    left, top, right, bottom = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return {
        "left": int(left),
        "top": int(top),
        "right": int(image.width - right),
        "bottom": int(image.height - bottom),
    }


def silhouette_difference(first: Image.Image, second: Image.Image) -> float:
    diff = ImageChops.difference(first.getchannel("A"), second.getchannel("A"))
    return sum(diff.getdata()) / (255 * first.width * first.height)


def diagnostic_leg_identity_ok(prefix: str) -> tuple[bool, dict[str, float | int | None]]:
    path = SOURCE_DIR / f"{prefix}-e-5slot-leg-chain-diagnostic.png"
    figures = extract_strip_figures(Image.open(path).convert("RGBA"), prefix)

    def stats(slot_index: int) -> dict[str, float | int | None]:
        slot = np.asarray(figures[slot_index].convert("RGB"))
        red = (slot[:, :, 0] > 150) & (slot[:, :, 0] > slot[:, :, 1] * 1.45) & (
            slot[:, :, 0] > slot[:, :, 2] * 1.45
        )
        blue = (slot[:, :, 2] > 140) & (slot[:, :, 2] > slot[:, :, 0] * 1.35) & (
            slot[:, :, 2] > slot[:, :, 1] * 1.15
        )
        red_x = np.where(red)[1]
        blue_x = np.where(blue)[1]
        return {
            "redPixels": int(red_x.size),
            "bluePixels": int(blue_x.size),
            "redCentroidX": float(red_x.mean()) if red_x.size else None,
            "blueCentroidX": float(blue_x.mean()) if blue_x.size else None,
        }

    slot2 = stats(1)
    slot4 = stats(3)
    enough_pixels = min(
        slot2["redPixels"], slot2["bluePixels"], slot4["redPixels"], slot4["bluePixels"]
    ) >= 100
    slot2_swapped = slot2["redCentroidX"] is not None and slot2["blueCentroidX"] is not None and (
        slot2["redCentroidX"] > slot2["blueCentroidX"]
    )
    slot4_swapped = slot4["redCentroidX"] is not None and slot4["blueCentroidX"] is not None and (
        slot4["blueCentroidX"] > slot4["redCentroidX"]
    )
    details = {
        "slot2RedPixels": slot2["redPixels"],
        "slot2BluePixels": slot2["bluePixels"],
        "slot2RedCentroidX": slot2["redCentroidX"],
        "slot2BlueCentroidX": slot2["blueCentroidX"],
        "slot4RedPixels": slot4["redPixels"],
        "slot4BluePixels": slot4["bluePixels"],
        "slot4RedCentroidX": slot4["redCentroidX"],
        "slot4BlueCentroidX": slot4["blueCentroidX"],
    }
    return bool(enough_pixels and slot2_swapped and slot4_swapped), details


def install_unit(spec: BipedSpec) -> dict[str, object]:
    source_path = SOURCE_DIR / f"{spec.prefix}-e-5slot-source.png"
    diagnostic_path = SOURCE_DIR / f"{spec.prefix}-e-5slot-leg-chain-diagnostic.png"
    if not source_path.exists() or not diagnostic_path.exists():
        raise FileNotFoundError(f"missing source pair for {spec.prefix}")
    source_frames = split_strip(source_path, spec.prefix)
    attack_override_path = SOURCE_DIR / f"{spec.prefix}-e-attack-source.png"
    attack_source_margins = None
    if attack_override_path.exists():
        attack_source_image = Image.open(attack_override_path).convert("RGBA")
        attack_source_margins = chroma_source_margins(attack_source_image)
        attack_source = remove_background(attack_source_image)
        source_frames[-1] = keep_largest_component(attack_source)
    locomotion_canvas = PIKEMAN_CANVAS if spec.prefix == "pikeman" else STANDARD_CANVAS
    locomotion_anchor_y = PIKEMAN_ANCHOR_Y if spec.prefix == "pikeman" else 336
    reference_scale = (
        compute_reference_scale(source_frames[0], locomotion_canvas)
        * spec.reference_scale_multiplier
    )
    production: dict[str, Image.Image] = {}
    for pose, frame in zip(POSES, source_frames):
        canvas_size = (
            PIKEMAN_ATTACK_CANVAS
            if spec.prefix == "pikeman" and pose == "attack"
            else WIDE_CANVAS if pose == "attack"
            else locomotion_canvas
        )
        anchor_y = 336 if pose == "attack" else locomotion_anchor_y
        pose_scale = (
            compute_reference_scale(frame, canvas_size)
            if spec.prefix == "pikeman" and pose == "attack"
            else reference_scale
        )
        canvas = normalize_to_canvas(frame, canvas_size, pose_scale, anchor_y)
        production[pose] = canvas
        player = add_team_accent(canvas, "infantry", "player", spec.prefix)
        enemy = add_team_accent(canvas, "infantry", "enemy", spec.prefix)
        player.save(ASSET_DIR / f"{spec.prefix}-e-{pose}.png")
        enemy.save(ASSET_DIR / f"{spec.prefix}-e-{pose}-enemy.png")

    boxes = {pose: alpha_bbox(frame) for pose, frame in production.items()}
    heights = {pose: box[3] - box[1] for pose, box in boxes.items()}
    widths = {pose: box[2] - box[0] for pose, box in boxes.items()}
    walk_difference = silhouette_difference(production["walk-01"], production["walk-03"])
    unclipped = all(
        box[0] >= 8 and box[1] >= 8 and box[2] <= production[pose].width - 8
        for pose, box in boxes.items()
    )
    locomotion_heights = [heights[pose] for pose in POSES[:-1]]
    height_ratio = max(locomotion_heights) / max(1, min(locomotion_heights))
    diagnostic_passed, diagnostic_details = diagnostic_leg_identity_ok(spec.prefix)
    checks = {
        "diagnostic_leg_identity_swap": diagnostic_passed,
        "nonempty": all(value > 0 for value in heights.values()),
        "not_clipped": unclipped,
        "height_consistent": height_ratio <= 1.28,
        "walk_frames_distinct": walk_difference >= 0.0025,
        "attack_source_has_safe_margin": attack_source_margins is None
        or min(attack_source_margins.values()) >= 32,
    }
    return {
        "unitId": spec.unit_id,
        "prefix": spec.prefix,
        "source": str(source_path.relative_to(ROOT)),
        "attackSource": str(attack_override_path.relative_to(ROOT))
        if attack_override_path.exists()
        else None,
        "attackSourceMargins": attack_source_margins,
        "expectedEquipment": spec.expected_equipment,
        "checks": checks,
        "pass": all(checks.values()),
        "heightRatio": round(height_ratio, 4),
        "walkSilhouetteDifference": round(walk_difference, 4),
        "widths": widths,
        "heights": heights,
        "diagnosticLegIdentity": diagnostic_details,
    }


def write_contact_sheet() -> None:
    tile_w, tile_h = 256, 286
    sheet = Image.new("RGBA", (tile_w * 5, tile_h * len(BIPEDS)), (10, 20, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for row, spec in enumerate(BIPEDS):
        for col, pose in enumerate(POSES):
            image = Image.open(ASSET_DIR / f"{spec.prefix}-e-{pose}.png").convert("RGBA")
            image.thumbnail((tile_w - 16, tile_h - 36), Image.Resampling.LANCZOS)
            x = col * tile_w + (tile_w - image.width) // 2
            y = row * tile_h + 24 + (tile_h - 28 - image.height)
            sheet.alpha_composite(image, (x, y))
            if row == 0:
                draw.text((col * tile_w + 8, 4), pose, fill=(220, 232, 242, 255))
        draw.text((8, row * tile_h + 4), spec.prefix, fill=(120, 210, 255, 255))
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(ARTIFACT_DIR / "all-biped-production-contact-sheet.jpg", quality=92)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    results = [install_unit(spec) for spec in BIPEDS]
    write_contact_sheet()
    report = {"contract": ["walk-01", "walk-02", "walk-03", "walk-02"], "units": results}
    (ARTIFACT_DIR / "qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for result in results:
        state = "PASS" if result["pass"] else "FAIL"
        print(f"{state:4} {result['prefix']:<24} height={result['heightRatio']:.3f} diff={result['walkSilhouetteDifference']:.3f}")
    return 0 if all(result["pass"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
