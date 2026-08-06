#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public/assets/production/units"
LEGACY_PREFIXES = (
    "stone-slinger",
    "stone-axeman",
    "bronze-swordsman",
    "bronze-spearman",
    "archer",
    "iron-swordsman",
    "iron-spearman",
    "musketeer",
    "knight",
)
POSES = ("idle", "walk-a", "walk-b", "attack")
TEAM_SUFFIXES = ("", "-enemy")


def mirror(image: Image.Image) -> Image.Image:
    return image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def normalize_family(prefix: str, team_suffix: str) -> None:
    for pose in POSES:
      source_e = Image.open(ASSET_DIR / f"{prefix}-e-{pose}{team_suffix}.png").convert("RGBA")
      source_ne = Image.open(ASSET_DIR / f"{prefix}-ne-{pose}{team_suffix}.png").convert("RGBA")
      source_se = Image.open(ASSET_DIR / f"{prefix}-se-{pose}{team_suffix}.png").convert("RGBA")
      source_n = Image.open(ASSET_DIR / f"{prefix}-n-{pose}{team_suffix}.png").convert("RGBA")
      source_s = Image.open(ASSET_DIR / f"{prefix}-s-{pose}{team_suffix}.png").convert("RGBA")

      desired = {
          "w": source_e,
          "e": mirror(source_e),
          "nw": source_ne,
          "ne": mirror(source_ne),
          "sw": source_se,
          "se": mirror(source_se),
          "n": source_n,
          "s": source_s,
      }
      for direction, image in desired.items():
          image.save(ASSET_DIR / f"{prefix}-{direction}-{pose}{team_suffix}.png")


def main() -> None:
    for prefix in LEGACY_PREFIXES:
        for team_suffix in TEAM_SUFFIXES:
            normalize_family(prefix, team_suffix)
    print(f"normalized {len(LEGACY_PREFIXES)} legacy asset families to direct direction naming")


if __name__ == "__main__":
    main()
