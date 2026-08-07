#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PREFIX = ROOT / "public/assets/production/units/rifleman-e"
FRAME_NAMES = tuple(f"walk-{index:02d}" for index in range(1, 4))
FOOT_REGION_START_RATIO = 0.75
LEG_REGION_START_RATIO = 0.45
MIN_OPPOSITE_LEAD_DIFF_THRESHOLD = 16.0


@dataclass(frozen=True)
class FrameMetrics:
    pose: str
    foot_width: int
    left_mass: float
    right_mass: float
    foot_centroid_x: float
    bbox: tuple[int, int, int, int] | None


def load_frame(prefix: Path, pose: str) -> Image.Image:
    path = prefix.parent / f"{prefix.name}-{pose}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def measure_foot_metrics(image: Image.Image) -> FrameMetrics:
    bbox = alpha_bbox(image)
    if bbox is None:
        return FrameMetrics("unknown", 0, 0.0, 0.0, 0.0, None)
    x0, y0, x1, y1 = bbox
    height = y1 - y0
    region_top = y0 + int(height * FOOT_REGION_START_RATIO)
    foot_alpha = image.getchannel("A").crop((x0, region_top, x1, y1))
    foot_bbox = foot_alpha.getbbox()
    width = 0 if foot_bbox is None else foot_bbox[2] - foot_bbox[0]
    pixels = foot_alpha.load()
    half = foot_alpha.width // 2
    left_mass = 0.0
    right_mass = 0.0
    weighted_sum_x = 0.0
    total_mass = 0.0
    for y in range(foot_alpha.height):
        for x in range(foot_alpha.width):
            alpha = pixels[x, y]
            if alpha <= 0:
                continue
            total_mass += alpha
            weighted_sum_x += x * alpha
            if x < half:
                left_mass += alpha
            else:
                right_mass += alpha
    centroid_x = weighted_sum_x / total_mass if total_mass else 0.0
    return FrameMetrics("unknown", width, left_mass, right_mass, centroid_x, bbox)


def leg_region_crop(image_a: Image.Image, image_b: Image.Image) -> tuple[Image.Image, Image.Image]:
    union_alpha = ImageChops.lighter(image_a.getchannel("A"), image_b.getchannel("A"))
    bbox = union_alpha.getbbox()
    if bbox is None:
        return image_a.crop((0, 0, 1, 1)), image_b.crop((0, 0, 1, 1))
    x0, y0, x1, y1 = bbox
    height = y1 - y0
    region_top = y0 + int(height * LEG_REGION_START_RATIO)
    return image_a.crop((x0, region_top, x1, y1)), image_b.crop((x0, region_top, x1, y1))


def mean_absolute_diff(image_a: Image.Image, image_b: Image.Image) -> float:
    alpha_a = image_a.getchannel("A")
    alpha_b = image_b.getchannel("A")
    diff = ImageChops.difference(alpha_a, alpha_b)
    return ImageStat.Stat(diff).mean[0]


def validate(prefix: Path) -> int:
    frames = {pose: load_frame(prefix, pose) for pose in FRAME_NAMES}
    metrics: list[FrameMetrics] = []
    for pose in FRAME_NAMES:
        metric = measure_foot_metrics(frames[pose])
        metrics.append(FrameMetrics(pose, metric.foot_width, metric.left_mass, metric.right_mass, metric.foot_centroid_x, metric.bbox))

    widths = {metric.pose: metric.foot_width for metric in metrics}
    lead_diff_13 = mean_absolute_diff(*leg_region_crop(frames["walk-01"], frames["walk-03"]))
    walk01 = next(metric for metric in metrics if metric.pose == "walk-01")
    walk03 = next(metric for metric in metrics if metric.pose == "walk-03")
    centroid_delta_13 = abs(
        walk01.foot_centroid_x - walk03.foot_centroid_x
    )
    lead_mass_inverted = (
        walk01.left_mass < walk01.right_mass
        and walk03.left_mass > walk03.right_mass
    ) or (
        walk01.left_mass > walk01.right_mass
        and walk03.left_mass < walk03.right_mass
    )

    width_checks = {
        "walk-01 wider than walk-02": widths["walk-01"] > widths["walk-02"],
        "walk-03 wider than walk-02": widths["walk-03"] > widths["walk-02"],
    }
    diff_checks = {
        "walk-01 vs walk-03 opposite-lead diff": lead_diff_13 >= MIN_OPPOSITE_LEAD_DIFF_THRESHOLD,
        "walk-01 vs walk-03 left-right mass inversion": lead_mass_inverted,
    }

    overall_pass = all(width_checks.values()) and all(diff_checks.values())

    print("Rifleman 3-frame walk validation")
    print(f"Prefix: {prefix}")
    print("")
    print("| Pose | Foot width (px) | Left mass | Right mass | Foot centroid x | Alpha bbox |")
    print("| --- | ---: | ---: | ---: | ---: | --- |")
    for metric in metrics:
        print(f"| {metric.pose} | {metric.foot_width} | {metric.left_mass:.0f} | {metric.right_mass:.0f} | {metric.foot_centroid_x:.2f} | {metric.bbox} |")
    print("")
    print("| Check | Result | Detail |")
    print("| --- | --- | --- |")
    print(f"| walk-01 wider than walk-02 | {'PASS' if width_checks['walk-01 wider than walk-02'] else 'FAIL'} | {widths['walk-01']} > {widths['walk-02']} |")
    print(f"| walk-03 wider than walk-02 | {'PASS' if width_checks['walk-03 wider than walk-02'] else 'FAIL'} | {widths['walk-03']} > {widths['walk-02']} |")
    print(
        f"| walk-01 vs walk-03 opposite-lead diff | {'PASS' if diff_checks['walk-01 vs walk-03 opposite-lead diff'] else 'FAIL'} | "
        f"MAD {lead_diff_13:.2f} >= {MIN_OPPOSITE_LEAD_DIFF_THRESHOLD:.2f}, centroid delta {centroid_delta_13:.2f} |"
    )
    print(
        f"| walk-01 vs walk-03 left-right mass inversion | {'PASS' if diff_checks['walk-01 vs walk-03 left-right mass inversion'] else 'FAIL'} | "
        f"walk-01 L/R = {walk01.left_mass:.0f}/{walk01.right_mass:.0f}, walk-03 L/R = {walk03.left_mass:.0f}/{walk03.right_mass:.0f} |"
    )
    print("")
    print(f"Overall: {'PASS' if overall_pass else 'FAIL'}")
    return 0 if overall_pass else 1


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate rifleman E-direction 3-frame walk frames.")
    parser.add_argument(
        "--prefix",
        type=Path,
        default=DEFAULT_PREFIX,
        help="Frame prefix without the trailing pose, e.g. public/assets/production/units/rifleman-e",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    return validate(args.prefix.resolve())


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
