"""Candidate art directions for the battlefield surface.

Three directions, all keeping the concept: a top-down retro RTS field with a
road running between two keeps. They differ in how hard they push contrast,
which is the axis that actually matters here -- the game is now framed to fit a
phone, where a tile is a few dozen pixels across and subtlety disappears.
"""
from terrain_tiles import Material, Style

#: Sampled from the tiles in use today, so this direction is the current look
#: cleaned up rather than replaced.
HERITAGE = Style(
    name="heritage",
    label="A. 현행 계승 — 지금 팔레트를 정리",
    edge_width=1.6,
    edge_alpha=60,
    edge_blur=0.4,
    materials={
        "grass": Material("grass", "#53683a", "#3f5029", "#6d8449", "#8aa15c", grain=0.11, speckle=0.010),
        "dirt": Material("dirt", "#765638", "#5b4029", "#8f6b46", "#a98255", grain=0.12, speckle=0.008),
        "road": Material("road", "#8b7458", "#6d5a43", "#a48d6c", "#b9a37f", grain=0.10, speckle=0.006),
        "stone": Material("stone", "#666760", "#4d4e48", "#7d7e75", "#94958a", grain=0.13, speckle=0.010),
        "water": Material("water", "#33566e", "#264255", "#456f8c", "#7fb0c8", grain=0.05, speckle=0.004, speckle_size=(1, 3)),
    },
)

#: Pushed for a small screen: deeper shadows, brighter tops, a firm rim on every
#: cut so shapes hold together when the whole field is a few hundred pixels wide.
LEGIBLE = Style(
    name="legible",
    label="B. 명료 — 대비를 올려 작은 화면에서 형태 유지",
    edge_width=2.4,
    edge_alpha=105,
    edge_blur=0.0,
    materials={
        "grass": Material("grass", "#4f7233", "#33501f", "#74a04a", "#9ac45f", grain=0.16, speckle=0.010,
                          decor="tuft", decor_density=0.006),
        "dirt": Material("dirt", "#7d5330", "#573820", "#a06f42", "#c08b55", grain=0.17, speckle=0.008,
                         decor="pebble", decor_density=0.005),
        "road": Material("road", "#9a7f5c", "#6f5a3f", "#bda183", "#d6bf9c", grain=0.14, speckle=0.006,
                         decor="rut", decor_density=0.030),
        "stone": Material("stone", "#6b6d63", "#474941", "#8e9083", "#adafa0", grain=0.18, speckle=0.010,
                          decor="crack", decor_density=0.020),
        "water": Material("water", "#2b5f80", "#1b4159", "#3f86ab", "#8fd0e8", grain=0.07, speckle=0.004,
                          speckle_size=(1, 3), decor="ripple", decor_density=0.020),
    },
)

#: Calmer and cooler, with soft edges. Reads as a modern mobile board rather
#: than a nineties RTS.
SOFT = Style(
    name="soft",
    label="C. 부드러움 — 채도를 낮추고 경계를 완만하게",
    edge_width=1.2,
    edge_alpha=38,
    edge_blur=1.1,
    materials={
        "grass": Material("grass", "#6d8a5c", "#5a7449", "#84a271", "#9db98a", grain=0.07, speckle=0.006),
        "dirt": Material("dirt", "#9c7d5e", "#83654a", "#b39a7d", "#c9b193", grain=0.07, speckle=0.005),
        "road": Material("road", "#ab967a", "#907d65", "#c4b096", "#d8c8b1", grain=0.06, speckle=0.004),
        "stone": Material("stone", "#8b8d84", "#74766d", "#a3a59b", "#bcbeb3", grain=0.08, speckle=0.006),
        "water": Material("water", "#5b8ba6", "#48738c", "#79a8c0", "#a9cfe0", grain=0.04, speckle=0.003, speckle_size=(1, 3)),
    },
)

ALL = [HERITAGE, LEGIBLE, SOFT]
