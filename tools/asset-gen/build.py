"""Cuts the chosen direction into the game's terrain folder."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from terrain_tiles import write_set  # noqa: E402
from styles import ALL  # noqa: E402

OUT = Path("public/assets/production/terrain")

if __name__ == "__main__":
    wanted = sys.argv[1] if len(sys.argv) > 1 else "legible"
    style = next((s for s in ALL if s.name == wanted), None)
    if style is None:
        raise SystemExit(f"unknown style {wanted!r}; have {[s.name for s in ALL]}")
    count = write_set(style, OUT)
    print(f"{style.name}: {count} tiles -> {OUT}")
