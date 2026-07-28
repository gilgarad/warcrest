#!/usr/bin/env python3
"""Remove detached effects from one contact-sheet cell while preserving the actor."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--columns", type=int, default=2)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--column", type=int, required=True)
    parser.add_argument("--row", type=int, required=True)
    parser.add_argument("--alpha-threshold", type=int, default=12)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    cell_width = image.width // args.columns
    cell_height = image.height // args.rows
    left = args.column * cell_width
    top = args.row * cell_height
    right = left + cell_width
    bottom = top + cell_height
    pixels = image.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []

    for y in range(top, bottom):
        for x in range(left, right):
            if (x, y) in visited or pixels[x, y][3] < args.alpha_threshold:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    neighbor = (nx, ny)
                    if not (left <= nx < right and top <= ny < bottom):
                        continue
                    if neighbor in visited or pixels[nx, ny][3] < args.alpha_threshold:
                        continue
                    visited.add(neighbor)
                    queue.append(neighbor)
            components.append(component)

    if not components:
        raise RuntimeError("selected cell has no opaque component")
    largest = max(components, key=len)
    keep = set(largest)
    for component in components:
        if component is largest:
            continue
        for x, y in component:
            pixels[x, y] = (0, 0, 0, 0)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    print(f"kept {len(keep)} pixels; removed {sum(map(len, components)) - len(keep)} pixels")


if __name__ == "__main__":
    main()
