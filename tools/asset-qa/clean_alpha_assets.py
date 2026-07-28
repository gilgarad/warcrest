#!/usr/bin/env python3
"""Remove chroma remnants and isolated alpha specks from normalized assets."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def clean(path: Path, minimum_component: int) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 12:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if alpha and red > 90 and blue > 70 and red > green * 1.22 and blue > green * 1.22:
                pixels[x, y] = (0, 0, 0, 0)

    visited: set[tuple[int, int]] = set()
    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y][3] < 12:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while queue:
                current = queue.popleft()
                component.append(current)
                cx, cy = current
                for neighbor in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    nx, ny = neighbor
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    if neighbor in visited or pixels[nx, ny][3] < 12:
                        continue
                    visited.add(neighbor)
                    queue.append(neighbor)
            if len(component) < minimum_component:
                for px, py in component:
                    pixels[px, py] = (0, 0, 0, 0)

    image.save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--directory")
    source.add_argument("--file")
    parser.add_argument("--minimum-component", type=int, default=24)
    args = parser.parse_args()
    if args.file:
        paths = [Path(args.file)]
        location = args.file
    else:
        directory = Path(args.directory)
        paths = sorted(path for path in directory.glob("*.png") if path.is_file())
        location = args.directory
    for path in paths:
        clean(path, args.minimum_component)
    print(f"cleaned {len(paths)} alpha assets in {location}")


if __name__ == "__main__":
    main()
