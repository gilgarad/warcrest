#!/usr/bin/env python3
"""Generate age-family defense tower production assets from authored source art."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public/assets/production/structures"
SOURCE_DIR = ROOT / "art-source/structures/tower-family-v2"
CANVAS = (512, 512)
FAMILIES = ("palisade", "stone", "bastion", "missile")
STATES = ("full", "damaged", "critical", "ruins", "construction")
LAYOUT = {
    "palisade": {"max_w": 300, "max_h": 372, "anchor_y": 448, "shadow": (208, 44, 52)},
    "bastion": {"max_w": 372, "max_h": 314, "anchor_y": 448, "shadow": (250, 58, 58)},
    "missile": {"max_w": 316, "max_h": 296, "anchor_y": 448, "shadow": (226, 52, 58)},
}
LEGACY_STONE = {
    "player": {
        "full": ROOT / "public/assets/production/structures/defense-tower-full.png",
        "damaged": ROOT / "public/assets/production/structures/defense-tower-damaged.png",
        "critical": ROOT / "public/assets/production/structures/defense-tower-critical.png",
        "ruins": ROOT / "public/assets/production/structures/defense-tower-ruins.png",
        "construction": ROOT / "public/assets/production/structures/defense-tower-construction.png",
    },
    "enemy": {
        "full": ROOT / "public/assets/production/structures/defense-tower-full-enemy.png",
        "damaged": ROOT / "public/assets/production/structures/defense-tower-damaged-enemy.png",
        "critical": ROOT / "public/assets/production/structures/defense-tower-critical-enemy.png",
        "ruins": ROOT / "public/assets/production/structures/defense-tower-ruins-enemy.png",
        "construction": ROOT / "public/assets/production/structures/defense-tower-construction-enemy.png",
    },
}


def empty_canvas() -> Image.Image:
    return Image.new("RGBA", CANVAS, (0, 0, 0, 0))


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("image has no visible content")
    return bbox


def crop_content(image: Image.Image) -> Image.Image:
    return image.crop(alpha_bbox(image))


def swap_blue_to_red(image: Image.Image) -> Image.Image:
    rgba = image.copy()
    pixels = list(rgba.getdata())
    out = []
    for red, green, blue, alpha in pixels:
        if alpha == 0:
            out.append((red, green, blue, alpha))
            continue
        if blue > max(72, int(red * 1.12)) and blue > int(green * 1.05):
            brightness = max(red, green, blue)
            new_red = min(255, int(brightness * 0.98))
            new_green = min(255, int(green * 0.66 + 28))
            new_blue = min(255, int(blue * 0.58))
            out.append((new_red, new_green, new_blue, alpha))
        else:
            out.append((red, green, blue, alpha))
    rgba.putdata(out)
    return rgba


def draw_ground_shadow(image: Image.Image, width: int, height: int, alpha: int) -> None:
    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(
        (
            CANVAS[0] // 2 - width // 2,
            450 - height // 2,
            CANVAS[0] // 2 + width // 2,
            450 + height // 2,
        ),
        fill=(8, 10, 14, alpha),
    )
    image.alpha_composite(shadow)


def fit_to_canvas(image: Image.Image, family: str) -> Image.Image:
    spec = LAYOUT[family]
    content = crop_content(image)
    scale = min(spec["max_w"] / content.width, spec["max_h"] / content.height)
    resized = content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )
    out = empty_canvas()
    x = round((CANVAS[0] - resized.width) / 2)
    y = spec["anchor_y"] - resized.height
    draw_ground_shadow(out, spec["shadow"][0], spec["shadow"][1], spec["shadow"][2])
    out.alpha_composite(resized, (x, y))
    return out


def load_full_player_source(family: str) -> Image.Image:
    if family == "stone":
        return Image.open(LEGACY_STONE["player"]["full"]).convert("RGBA")
    return Image.open(SOURCE_DIR / f"{family}-full-player.png").convert("RGBA")


def chip_alpha(mask: Image.Image, shapes: list[tuple[int, int, int, int]]) -> Image.Image:
    chip = Image.new("L", CANVAS, 255)
    draw = ImageDraw.Draw(chip)
    for shape in shapes:
        draw.polygon(shape, fill=0)
    return ImageChops.multiply(mask, chip)


def overlay_damage(base: Image.Image, severity: str) -> Image.Image:
    out = base.copy()
    overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    bbox = alpha_bbox(base)
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    crack = (44, 34, 30, 200)
    smoke = (42, 42, 42, 110 if severity == "damaged" else 156)

    draw.line(
        (
            round(left + width * 0.54),
            round(top + height * 0.12),
            round(left + width * 0.46),
            round(top + height * 0.32),
            round(left + width * 0.57),
            round(top + height * 0.58),
        ),
        fill=crack,
        width=6 if severity == "damaged" else 8,
        joint="curve",
    )
    draw.line(
        (
            round(left + width * 0.66),
            round(top + height * 0.24),
            round(left + width * 0.73),
            round(top + height * 0.42),
            round(left + width * 0.63),
            round(top + height * 0.72),
        ),
        fill=crack,
        width=5 if severity == "damaged" else 7,
        joint="curve",
    )
    draw.ellipse(
        (
            round(left + width * 0.24),
            round(top + height * 0.16),
            round(left + width * 0.42),
            round(top + height * 0.31),
        ),
        fill=smoke,
    )
    if severity == "critical":
        draw.ellipse(
            (
                round(left + width * 0.56),
                round(top + height * 0.28),
                round(left + width * 0.84),
                round(top + height * 0.5),
            ),
            fill=(38, 38, 38, 150),
        )
    out.alpha_composite(overlay)
    alpha = out.getchannel("A")
    if severity == "damaged":
        alpha = chip_alpha(
            alpha,
            [
                (
                    (round(left + width * 0.18), round(top + height * 0.22)),
                    (round(left + width * 0.28), round(top + height * 0.12)),
                    (round(left + width * 0.32), round(top + height * 0.24)),
                ),
                (
                    (round(left + width * 0.7), round(top + height * 0.18)),
                    (round(left + width * 0.78), round(top + height * 0.1)),
                    (round(left + width * 0.8), round(top + height * 0.24)),
                ),
            ],
        )
    else:
        alpha = chip_alpha(
            alpha,
            [
                (
                    (round(left + width * 0.14), round(top + height * 0.22)),
                    (round(left + width * 0.29), round(top + height * 0.06)),
                    (round(left + width * 0.36), round(top + height * 0.22)),
                ),
                (
                    (round(left + width * 0.62), round(top + height * 0.12)),
                    (round(left + width * 0.78), round(top + height * 0.0)),
                    (round(left + width * 0.84), round(top + height * 0.18)),
                ),
                (
                    (round(left + width * 0.22), round(top + height * 0.74)),
                    (round(left + width * 0.31), round(top + height * 0.58)),
                    (round(left + width * 0.38), round(top + height * 0.78)),
                ),
            ],
        )
        out = ImageEnhance.Color(out).enhance(0.88)
        out = ImageEnhance.Brightness(out).enhance(0.92)
    out.putalpha(alpha)
    return out


def build_construction(base: Image.Image) -> Image.Image:
    bbox = alpha_bbox(base)
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    alpha = base.getchannel("A")
    mask = Image.new("L", CANVAS, 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle(
        (
            left,
            round(top + height * 0.32),
            right,
            bottom,
        ),
        radius=18,
        fill=255,
    )
    partial_alpha = ImageChops.multiply(alpha, mask)
    body = ImageEnhance.Color(base).enhance(0.82)
    body.putalpha(partial_alpha)

    out = empty_canvas()
    draw_ground_shadow(out, max(180, round(width * 0.66)), 44, 52)
    out.alpha_composite(body)

    scaffold = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(scaffold)
    wood = (126, 88, 48, 255)
    rope = (166, 136, 88, 255)
    for ratio in (0.16, 0.34, 0.58, 0.8):
        x = round(left + width * ratio)
        draw.rectangle((x, round(top + height * 0.1), x + 10, bottom), fill=wood)
    for ratio in (0.22, 0.4, 0.58, 0.76):
        y = round(top + height * ratio)
        draw.rectangle((round(left - width * 0.02), y, round(right + width * 0.02), y + 8), fill=wood)
    draw.line((round(left + width * 0.06), bottom - 14, round(right - width * 0.06), round(top + height * 0.18)), fill=rope, width=7)
    draw.line((round(left + width * 0.14), round(top + height * 0.12), round(right - width * 0.02), bottom - 20), fill=rope, width=6)
    draw.rectangle((round(left + width * 0.48), round(top - 8), round(left + width * 0.5), round(top + height * 0.18)), fill=(118, 90, 62, 255))
    draw.line((round(left + width * 0.49), round(top + height * 0.02), round(left + width * 0.56), round(top + height * 0.12)), fill=(126, 98, 68, 255), width=4)
    out.alpha_composite(scaffold)
    return out


def build_ruins(base: Image.Image, family: str) -> Image.Image:
    bbox = alpha_bbox(base)
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    content = crop_content(base)
    rubble = content.resize(
        (max(1, round(content.width * 0.62)), max(1, round(content.height * 0.34))),
        Image.Resampling.LANCZOS,
    )
    rubble = ImageEnhance.Brightness(rubble).enhance(0.84)
    rubble = ImageEnhance.Color(rubble).enhance(0.78)
    out = empty_canvas()
    shadow_width = {"palisade": 210, "bastion": 250, "missile": 226}.get(family, 210)
    draw_ground_shadow(out, shadow_width, 46, 54)
    x = round((CANVAS[0] - rubble.width) / 2)
    y = bottom - rubble.height
    out.alpha_composite(rubble, (x, y))

    debris = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(debris)
    fill_a = (94, 76, 54, 255) if family == "palisade" else (122, 116, 108, 255)
    fill_b = (138, 114, 78, 255) if family == "palisade" else (164, 156, 144, 255)
    piles = [
        (round(left + width * 0.08), bottom - 60, round(left + width * 0.36), bottom),
        (round(left + width * 0.32), bottom - 86, round(left + width * 0.62), bottom),
        (round(left + width * 0.56), bottom - 56, round(left + width * 0.88), bottom),
    ]
    for idx, pile in enumerate(piles):
        draw.rounded_rectangle(pile, radius=18, fill=fill_a if idx % 2 == 0 else fill_b)
    out.alpha_composite(debris)
    return out


def build_family_state(family: str, state: str, team: str) -> Image.Image:
    if family == "stone":
        return Image.open(LEGACY_STONE[team][state]).convert("RGBA")

    player_full = fit_to_canvas(load_full_player_source(family), family)
    full = player_full if team == "player" else swap_blue_to_red(player_full)
    if state == "full":
        return full
    if state == "damaged":
        return overlay_damage(full, "damaged")
    if state == "critical":
        return overlay_damage(full, "critical")
    if state == "construction":
        return build_construction(full)
    if state == "ruins":
        return build_ruins(full, family)
    raise ValueError(f"unsupported state: {state}")


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for family in FAMILIES:
        for state in STATES:
            for team in ("player", "enemy"):
                image = build_family_state(family, state, team)
                key = f"defense-tower-{family}-{state}"
                suffix = "-enemy" if team == "enemy" else ""
                image.save(ASSET_DIR / f"{key}{suffix}.png")
    print(f"generated {len(FAMILIES) * len(STATES) * 2} tower family images")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
