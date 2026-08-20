"""Cuts the chosen visual language into the game's terrain folder."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from languages import ALL, field_texture, vignette, write_set  # noqa: E402
from ui_chrome import write_all as write_chrome  # noqa: E402

OUT = Path("public/assets/production/terrain")
CHROME_OUT = Path("public/assets/production/ui")

if __name__ == "__main__":
    wanted = sys.argv[1] if len(sys.argv) > 1 else "pixel"
    language = next((l for l in ALL if l.name == wanted), None)
    if language is None:
        raise SystemExit(f"unknown language {wanted!r}; have {[l.name for l in ALL]}")
    count = write_set(language, OUT)
    field_texture(language).save(OUT / "field-base.png")
    vignette().save(OUT / "world-vignette.png")
    frames = write_chrome(CHROME_OUT)
    print(f"{language.name}: {count} tiles + field + vignette -> {OUT}")
    print(f"ui: {frames} frames -> {CHROME_OUT}")
