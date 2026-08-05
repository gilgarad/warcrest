#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public/assets/production/units"
OUTPUT_DIR = ROOT / "artifacts" / "unit-geometry-audit-2026-08-05"
DIRECTIONS = ("n", "ne", "e", "se", "s", "sw", "w", "nw")
POSES = ("idle", "walk-a", "walk-b", "attack")
DEFAULT_VISIBLE_HEIGHT_RATIO = 270 / 384


@dataclass(frozen=True)
class UnitAuditConfig:
    unit_id: str
    prefix: str
    group: str
    scale_factor: float
    canvas_width: int = 384
    canvas_height: int = 384
    reference_visible_height_ratio: float = DEFAULT_VISIBLE_HEIGHT_RATIO
    pose_visible_height_ratios: dict[str, float] | None = None
    exact_frame_visible_height_ratios: dict[str, float] | None = None


UNIT_CONFIGS: tuple[UnitAuditConfig, ...] = (
    UnitAuditConfig("stone_slinger", "stone-slinger", "human", 0.96),
    UnitAuditConfig("stone_axeman", "stone-axeman", "human", 1.04),
    UnitAuditConfig("bronze_swordsman", "bronze-swordsman", "human", 1.0),
    UnitAuditConfig("bronze_spearman", "bronze-spearman", "human", 1.0),
    UnitAuditConfig("archer", "archer", "human", 0.96),
    UnitAuditConfig("iron_swordsman", "iron-swordsman", "human", 1.04),
    UnitAuditConfig("iron_spearman", "iron-spearman", "human", 1.06),
    UnitAuditConfig("musketeer", "musketeer", "human", 0.98),
    UnitAuditConfig(
        "pikeman",
        "pikeman",
        "human",
        1.0,
        exact_frame_visible_height_ratios={
            "pikeman-s-walk-b": 303 / 384,
        },
    ),
    UnitAuditConfig("rifleman", "rifleman", "human", 0.98),
    UnitAuditConfig("grenadier", "grenadier", "human", 1.02),
    UnitAuditConfig("rifleman_late", "rifleman-late", "human", 0.98),
    UnitAuditConfig("grenadier_late", "grenadier-late", "human", 1.04),
    UnitAuditConfig("infantry", "infantry", "human", 0.98),
    UnitAuditConfig("machine_gunner", "machine-gunner", "human", 0.98),
    UnitAuditConfig("shock_trooper", "shock-trooper", "human", 1.0),
    UnitAuditConfig("automatic_rifleman", "automatic-rifleman", "human", 0.98),
    UnitAuditConfig(
        "support_gunner",
        "support-gunner",
        "human",
        0.98,
        pose_visible_height_ratios={
            "idle": 270 / 384,
            "walk-a": 270 / 384,
            "walk-b": 270 / 384,
            "attack": 259 / 384,
        },
    ),
    UnitAuditConfig("mobile_infantry", "mobile-infantry", "human", 0.98),
    UnitAuditConfig("special_forces", "special-forces", "human", 0.98),
    UnitAuditConfig("heavy_gunner", "heavy-gunner", "human", 0.98),
    UnitAuditConfig("breakthrough_trooper", "breakthrough-trooper", "human", 1.0),
    UnitAuditConfig("knight", "knight", "cavalry", 1.16, 512, 384),
    UnitAuditConfig(
        "heavy_cavalry",
        "heavy-cavalry",
        "cavalry",
        1.14,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 292.88 / 384,
            "walk-a": 299.25 / 384,
            "walk-b": 302.75 / 384,
            "attack": 267.25 / 384,
        },
        exact_frame_visible_height_ratios={
            "heavy-cavalry-n-attack": 312 / 384,
            "heavy-cavalry-e-attack": 299 / 384,
            "heavy-cavalry-w-attack": 299 / 384,
        },
    ),
    UnitAuditConfig(
        "light_cavalry",
        "light-cavalry",
        "cavalry",
        1.12,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 293.25 / 384,
            "walk-a": 291.25 / 384,
            "walk-b": 290.5 / 384,
            "attack": 281.62 / 384,
        },
    ),
    UnitAuditConfig(
        "cavalry",
        "cavalry",
        "cavalry",
        1.16,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 290.88 / 384,
            "walk-a": 289.88 / 384,
            "walk-b": 289.88 / 384,
            "attack": 280.75 / 384,
        },
    ),
    UnitAuditConfig(
        "cannon_i",
        "cannon-i",
        "artillery",
        1.02,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 268.62 / 384,
            "walk-a": 254.5 / 384,
            "walk-b": 255.75 / 384,
            "attack": 244.88 / 384,
        },
        exact_frame_visible_height_ratios={
            "cannon-i-e-walk-a": 242 / 384,
            "cannon-i-w-walk-a": 242 / 384,
            "cannon-i-e-walk-b": 246 / 384,
            "cannon-i-w-walk-b": 246 / 384,
            "cannon-i-e-attack": 197 / 384,
            "cannon-i-se-attack": 197 / 384,
            "cannon-i-w-attack": 197 / 384,
            "cannon-i-nw-attack": 197 / 384,
        },
    ),
    UnitAuditConfig(
        "cannon_ii",
        "cannon-ii",
        "artillery",
        1.02,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 269.5 / 384,
            "walk-a": 253.88 / 384,
            "walk-b": 254.62 / 384,
            "attack": 254.75 / 384,
        },
        exact_frame_visible_height_ratios={
            "cannon-ii-e-walk-a": 206 / 384,
            "cannon-ii-w-walk-a": 206 / 384,
            "cannon-ii-e-walk-b": 209 / 384,
            "cannon-ii-w-walk-b": 209 / 384,
            "cannon-ii-e-attack": 218 / 384,
            "cannon-ii-se-attack": 218 / 384,
            "cannon-ii-w-attack": 218 / 384,
            "cannon-ii-nw-attack": 218 / 384,
        },
    ),
    UnitAuditConfig(
        "artillery_i",
        "artillery-i",
        "artillery",
        1.04,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 263.5 / 384,
            "walk-a": 259.75 / 384,
            "walk-b": 259.75 / 384,
            "attack": 260.62 / 384,
        },
        exact_frame_visible_height_ratios={
            "artillery-i-e-walk-a": 230 / 384,
            "artillery-i-w-walk-a": 230 / 384,
            "artillery-i-e-walk-b": 230 / 384,
            "artillery-i-w-walk-b": 230 / 384,
            "artillery-i-se-attack": 233 / 384,
            "artillery-i-nw-attack": 233 / 384,
        },
    ),
    UnitAuditConfig(
        "artillery_ii",
        "artillery-ii",
        "artillery",
        1.04,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 265.38 / 384,
            "walk-a": 253.75 / 384,
            "walk-b": 254.88 / 384,
            "attack": 257.75 / 384,
        },
        exact_frame_visible_height_ratios={
            "artillery-ii-e-idle": 233 / 384,
            "artillery-ii-w-idle": 233 / 384,
            "artillery-ii-e-walk-a": 222 / 384,
            "artillery-ii-w-walk-a": 222 / 384,
            "artillery-ii-e-walk-b": 225 / 384,
            "artillery-ii-w-walk-b": 225 / 384,
            "artillery-ii-e-attack": 224 / 384,
            "artillery-ii-w-attack": 224 / 384,
        },
    ),
    UnitAuditConfig(
        "tank",
        "tank",
        "vehicle",
        1.06,
        512,
        384,
        exact_frame_visible_height_ratios={
            "tank-se-attack": 243 / 384,
            "tank-nw-attack": 243 / 384,
        },
    ),
    UnitAuditConfig("mobile_artillery", "mobile-artillery", "vehicle", 1.14, 512, 384),
    UnitAuditConfig("modern_tank", "modern-tank", "vehicle", 1.06, 512, 384),
    UnitAuditConfig("supply_wagon_ancient", "supply-wagon-ancient", "support", 1.0, 512, 384),
    UnitAuditConfig("supply_wagon_iron", "supply-wagon-iron", "support", 1.0, 512, 384),
    UnitAuditConfig("supply_wagon_renaissance", "supply-wagon-renaissance", "support", 1.0, 512, 384),
    UnitAuditConfig(
        "supply_wagon_industrial",
        "supply-wagon-industrial",
        "support",
        1.0,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 270 / 384,
            "walk-a": 268.25 / 384,
            "walk-b": 269.25 / 384,
            "attack": 257.25 / 384,
        },
    ),
    UnitAuditConfig(
        "supply_wagon_modern",
        "supply-wagon-modern",
        "support",
        1.0,
        512,
        384,
        pose_visible_height_ratios={
            "idle": 265.75 / 384,
            "walk-a": 266 / 384,
            "walk-b": 268.75 / 384,
            "attack": 269.25 / 384,
        },
    ),
)


def alpha_bbox(path: Path) -> dict[str, int | float | bool | str]:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
      return {
          "exists": True,
          "opaque": False,
          "width": 0,
          "height": 0,
          "left": 0,
          "top": 0,
          "right_margin": image.width,
          "bottom_margin": image.height,
      }
    left, top, right, bottom = bbox
    return {
        "exists": True,
        "opaque": True,
        "width": right - left,
        "height": bottom - top,
        "left": left,
        "top": top,
        "right_margin": image.width - right,
        "bottom_margin": image.height - bottom,
    }


def safe_load(path: Path) -> dict[str, int | float | bool | str]:
    if not path.exists():
        return {"exists": False}
    return alpha_bbox(path)


def median_or_zero(values: Iterable[float]) -> float:
    items = list(values)
    return median(items) if items else 0.0


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    group_heights: dict[str, list[float]] = {}

    for config in UNIT_CONFIGS:
        displayed_heights: list[float] = []
        unit_rows: list[dict[str, object]] = []
        for direction in DIRECTIONS:
            for pose in POSES:
                path = ASSET_DIR / f"{config.prefix}-{direction}-{pose}.png"
                stats = safe_load(path)
                row: dict[str, object] = {
                    "unit_id": config.unit_id,
                    "prefix": config.prefix,
                    "group": config.group,
                    "direction": direction,
                    "pose": pose,
                    "path": str(path.relative_to(ROOT)),
                    **stats,
                }
                if stats.get("exists") and stats.get("opaque"):
                    texture_key = f"{config.prefix}-{direction}-{pose}"
                    frame_ratio = (
                        (config.exact_frame_visible_height_ratios or {}).get(texture_key)
                        or (config.pose_visible_height_ratios or {}).get(pose)
                        or config.reference_visible_height_ratio
                    )
                    normalization_factor = DEFAULT_VISIBLE_HEIGHT_RATIO / frame_ratio
                    displayed_height = float(stats["height"]) * config.scale_factor * normalization_factor
                    row["displayed_height"] = round(displayed_height, 2)
                    row["displayed_width"] = round(float(stats["width"]) * config.scale_factor * normalization_factor, 2)
                    row["touch_top"] = int(stats["top"]) <= 2
                    row["touch_bottom"] = int(stats["bottom_margin"]) <= 2
                    row["touch_left"] = int(stats["left"]) <= 2
                    row["touch_right"] = int(stats["right_margin"]) <= 2
                    displayed_heights.append(displayed_height)
                unit_rows.append(row)
        unit_median = median_or_zero(displayed_heights)
        group_heights.setdefault(config.group, []).extend(displayed_heights)
        for row in unit_rows:
            if row.get("exists") and row.get("opaque"):
                row["unit_height_median"] = round(unit_median, 2)
                row["height_vs_unit_pct"] = round((float(row["displayed_height"]) / unit_median) * 100, 1) if unit_median else 0
            rows.append(row)

    group_medians = {group: median_or_zero(values) for group, values in group_heights.items()}
    failures: list[dict[str, object]] = []
    for row in rows:
        if not row.get("exists"):
            failures.append({**row, "failure": "missing-file"})
            continue
        if not row.get("opaque"):
            failures.append({**row, "failure": "empty-alpha"})
            continue
        group_median = group_medians.get(str(row["group"]), 0.0)
        unit_median = float(row.get("unit_height_median", 0.0) or 0.0)
        displayed_height = float(row["displayed_height"])
        if any(bool(row[key]) for key in ("touch_top", "touch_bottom", "touch_left", "touch_right")):
            failures.append({**row, "failure": "edge-touch"})
        if group_median and abs(displayed_height - group_median) / group_median > 0.18:
            failures.append({**row, "failure": "group-size-outlier"})
        if unit_median and abs(displayed_height - unit_median) / unit_median > 0.12:
            failures.append({**row, "failure": "pose-size-jump"})

    summary = {
        "group_medians": {key: round(value, 2) for key, value in group_medians.items()},
        "failure_count": len(failures),
        "rows": len(rows),
    }

    (OUTPUT_DIR / "report.json").write_text(
        json.dumps({"summary": summary, "failures": failures, "rows": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# Unit Geometry Audit (2026-08-05)",
        "",
        "## Group Medians",
        "",
        "| Group | Displayed height median |",
        "| --- | ---: |",
    ]
    for group, value in summary["group_medians"].items():
        lines.append(f"| {group} | {value} |")
    lines.extend([
        "",
        f"- Total rows: {summary['rows']}",
        f"- Failure rows: {summary['failure_count']}",
        "",
        "## Failures",
        "",
        "| Unit | Group | Dir | Pose | Failure | Displayed H | Margins (L/T/R/B) |",
        "| --- | --- | --- | --- | --- | ---: | --- |",
    ])
    for failure in failures:
        if not failure.get("exists"):
            lines.append(
                f"| {failure['unit_id']} | {failure['group']} | {failure['direction']} | {failure['pose']} | missing-file | - | - |"
            )
            continue
        lines.append(
            f"| {failure['unit_id']} | {failure['group']} | {failure['direction']} | {failure['pose']} | "
            f"{failure['failure']} | {failure.get('displayed_height', '-')} | "
            f"{failure.get('left', '-')} / {failure.get('top', '-')} / {failure.get('right_margin', '-')} / {failure.get('bottom_margin', '-')} |"
        )
    (OUTPUT_DIR / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote {OUTPUT_DIR / 'report.md'}")
    print(f"Wrote {OUTPUT_DIR / 'report.json'}")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
