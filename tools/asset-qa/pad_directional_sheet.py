#!/usr/bin/env python3
"""Pad a generated 4x8 directional contact sheet to an exact grid size."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def round_up(value: int, divisor: int) -> int:
    return ((value + divisor - 1) // divisor) * divisor


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=8)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    target_width = round_up(source.width, args.columns)
    target_height = round_up(source.height, args.rows)
    if source.width == target_width and source.height == target_height:
        padded = source
    else:
        padded = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        padded.alpha_composite(source, (0, 0))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    padded.save(output)
    print(f"{args.input} -> {output} ({source.width}x{source.height} => {target_width}x{target_height})")


if __name__ == "__main__":
    main()
