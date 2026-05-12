#!/usr/bin/env python3
"""Просто ресайз логотипов без обработки фона.
Исходники уже прозрачные PNG."""
from PIL import Image
from pathlib import Path

ROOT = Path("/Users/admin/Documents/force_land")
SRC_FULL = ROOT / "assets" / "Монтажная область 15.png"        # ФОРС + ДРОП ЗОНА
SRC_MARK = ROOT / "assets" / "Монтажная область 15 копия.png"  # только ФОРС
OUT = ROOT / "assets"

def resize_save(src: Path, target_w: int, out_path: Path) -> None:
    img = Image.open(src).convert("RGBA")
    # crop transparent margins (если они есть)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    cw, ch = img.size
    scale = target_w / cw
    res = img.resize((target_w, int(ch * scale)), Image.LANCZOS)
    res.save(out_path, optimize=True)
    print(f"  {out_path.name}: {res.size}  ({out_path.stat().st_size // 1024} KB)")

print("FULL logo (hero):")
resize_save(SRC_FULL, 1400, OUT / "logo-hero.png")

print("MARK logo (nav + favicon):")
resize_save(SRC_MARK, 420, OUT / "logo-nav.png")
resize_save(SRC_MARK, 96,  OUT / "logo-favicon.png")
print("Done.")
