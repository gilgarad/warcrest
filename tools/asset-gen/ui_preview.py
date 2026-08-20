"""Shows the frames stretched to the sizes the HUD actually uses."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from ui_chrome import ALL, BUTTON, BUTTON_DANGER, BUTTON_DISABLED, BUTTON_HOVER, PANEL, nine_slice  # noqa: E402


def stretch(frame, width: int, height: int, corner: int = 8) -> Image.Image:
    """Nine-slice by hand, so the preview shows what Phaser will show."""
    src = nine_slice(frame)
    s = src.size[0]
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    c = corner
    parts = {
        "tl": (0, 0, c, c), "tr": (s - c, 0, s, c),
        "bl": (0, s - c, c, s), "br": (s - c, s - c, s, s),
        "t": (c, 0, s - c, c), "b": (c, s - c, s - c, s),
        "l": (0, c, c, s - c), "r": (s - c, c, s, s - c),
        "m": (c, c, s - c, s - c),
    }
    crops = {k: src.crop(v) for k, v in parts.items()}
    mw, mh = max(1, width - 2 * c), max(1, height - 2 * c)
    out.paste(crops["m"].resize((mw, mh), Image.NEAREST), (c, c))
    out.paste(crops["t"].resize((mw, c), Image.NEAREST), (c, 0))
    out.paste(crops["b"].resize((mw, c), Image.NEAREST), (c, height - c))
    out.paste(crops["l"].resize((c, mh), Image.NEAREST), (0, c))
    out.paste(crops["r"].resize((c, mh), Image.NEAREST), (width - c, c))
    out.paste(crops["tl"], (0, 0)); out.paste(crops["tr"], (width - c, 0))
    out.paste(crops["bl"], (0, height - c)); out.paste(crops["br"], (width - c, height - c))
    return out


if __name__ == "__main__":
    out_dir = Path("artifacts/ui-drafts")
    out_dir.mkdir(parents=True, exist_ok=True)
    # A slice of battlefield behind it, because a HUD is judged against what it
    # sits on and never against a neutral grey.
    ground = Image.open("public/assets/production/terrain/field-base.png").convert("RGBA")
    page = Image.new("RGBA", (900, 470))
    for y in range(0, 470, ground.height):
        for x in range(0, 900, ground.width):
            page.alpha_composite(ground, (x, y))

    page.alpha_composite(stretch(PANEL, 860, 120), (20, 20))
    labels = [(BUTTON, "일꾼 고용"), (BUTTON_HOVER, "연구 일꾼"),
              (BUTTON_DISABLED, "즉시 웨이브"), (BUTTON_DANGER, "시대 업")]
    x = 20
    for frame, _ in labels:
        page.alpha_composite(stretch(frame, 200, 102), (x, 168))
        x += 216
    page.alpha_composite(stretch(PANEL, 420, 150), (20, 296))
    page.alpha_composite(stretch(BUTTON, 132, 102), (460, 296))
    page.alpha_composite(stretch(BUTTON, 96, 60), (612, 296))
    page.alpha_composite(stretch(BUTTON, 60, 44), (724, 296))

    draw = ImageDraw.Draw(page)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/nanum/NanumGothic.ttf", 20)
    except OSError:
        font = ImageFont.load_default()
    for (frame, text), sx in zip(labels, range(20, 900, 216)):
        draw.text((sx + 100, 219), text, fill=(244, 232, 205), font=font, anchor="mm")
    draw.text((40, 46), "본진 연구 / 생산", fill=(244, 232, 205), font=font)
    page.convert("RGB").save(out_dir / "chrome.png")
    print("생성 완료")
