#!/usr/bin/env python3
"""Обработка финальных лого (Монтажная область 15 + копия).
Убирает белый фон, сохраняет серебристые буквы и оранжевый контур."""
from PIL import Image
from pathlib import Path

ROOT = Path("/Users/admin/Documents/force_land")
SRC_FULL = ROOT / "assets" / "Монтажная область 15.png"        # ФОРС + ДРОП ЗОНА
SRC_MARK = ROOT / "assets" / "Монтажная область 15 копия.png"  # только ФОРС
OUT = ROOT / "assets"

# soft white-keying: чем светлее пиксель, тем прозрачнее
WHITE_HARD = 248   # >= -> fully transparent
WHITE_SOFT = 215   # <= -> fully opaque

def key_out_white(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m >= WHITE_HARD:
                px[x, y] = (r, g, b, 0)
            elif m > WHITE_SOFT:
                t = (WHITE_HARD - m) / (WHITE_HARD - WHITE_SOFT)
                px[x, y] = (r, g, b, int(a * t))
    return img.crop(img.getbbox())

def resize_save(img: Image.Image, target_w: int, out_path: Path) -> None:
    cw, ch = img.size
    scale = target_w / cw
    res = img.resize((target_w, int(ch * scale)), Image.LANCZOS)
    res.save(out_path, optimize=True)
    print(f"  {out_path.name}: {res.size}  ({out_path.stat().st_size // 1024} KB)")

print("FULL logo (hero):")
full = key_out_white(Image.open(SRC_FULL))
resize_save(full, 1400, OUT / "logo-hero.png")

print("MARK logo (nav + favicon):")
mark = key_out_white(Image.open(SRC_MARK))
resize_save(mark, 420, OUT / "logo-nav.png")
resize_save(mark, 96,  OUT / "logo-favicon.png")
print("Done.")
