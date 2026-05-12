#!/usr/bin/env python3
"""Обработка двух новых лого (форс лого1 = full, форс лого2 = mark).
Удаляет чёрный фон, ресайзит в разные размеры."""
from PIL import Image
from pathlib import Path

ROOT = Path("/Users/admin/Documents/force_land")
SRC_FULL = ROOT / "images" / "форс лого1.png"  # full: ФОРС + ДРОП ЗОНА
SRC_MARK = ROOT / "images" / "форс лого2.png"  # short: just ФОРС
OUT = ROOT / "assets"

BLACK_HARD = 10
WHITE_SOFT = 60
RANGE = WHITE_SOFT - BLACK_HARD

def key_out_black(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            m = max(r, g, b)
            if m <= BLACK_HARD:
                px[x, y] = (r, g, b, 0)
            elif m >= WHITE_SOFT:
                px[x, y] = (r, g, b, 255)
            else:
                t = (m - BLACK_HARD) / RANGE
                px[x, y] = (r, g, b, int(255 * t))
    return img.crop(img.getbbox())

def resize_save(img: Image.Image, target_w: int, out_path: Path) -> None:
    cw, ch = img.size
    scale = target_w / cw
    res = img.resize((target_w, int(ch * scale)), Image.LANCZOS)
    res.save(out_path, optimize=True)
    print(f"  {out_path.name}: {res.size}  ({out_path.stat().st_size // 1024} KB)")

print("FULL logo (hero):")
full = key_out_black(Image.open(SRC_FULL))
resize_save(full, 1400, OUT / "logo-hero.png")

print("MARK logo (nav + favicon):")
mark = key_out_black(Image.open(SRC_MARK))
resize_save(mark, 420, OUT / "logo-nav.png")
resize_save(mark, 96,  OUT / "logo-favicon.png")
print("Done.")
