#!/usr/bin/env python3
"""Strip the BLACK background from the new white-on-black FORCE logo
and save resized variants for hero / nav / favicon."""
from PIL import Image
from pathlib import Path

SRC = Path("/Users/admin/Documents/force_land/images/Логотип_Форс-07.jpg")
OUT_DIR = Path("/Users/admin/Documents/force_land/assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
px = img.load()
w, h = img.size

# soft black-keying: max(R,G,B) → alpha. Чёрные пиксели становятся прозрачными,
# белые — полностью непрозрачными, переходные значения сглаживают края глифов.
BLACK_HARD = 10   # <= this → fully transparent
WHITE_SOFT = 60   # >= this → fully opaque
RANGE = WHITE_SOFT - BLACK_HARD
for y in range(h):
    for x in range(w):
        r, g, b, _ = px[x, y]
        m = max(r, g, b)
        if m <= BLACK_HARD:
            px[x, y] = (255, 255, 255, 0)
        elif m >= WHITE_SOFT:
            px[x, y] = (r, g, b, 255)
        else:
            t = (m - BLACK_HARD) / RANGE
            px[x, y] = (r, g, b, int(255 * t))

# crop transparent margins
bbox = img.getbbox()
cropped = img.crop(bbox)
print(f"Cropped: {cropped.size}")

def resize(target_w: int, name: str) -> None:
    cw, ch = cropped.size
    scale = target_w / cw
    out = cropped.resize((target_w, int(ch * scale)), Image.LANCZOS)
    out.save(OUT_DIR / name, optimize=True)
    print(f"  {name}: {out.size}  ({(OUT_DIR / name).stat().st_size // 1024} KB)")

resize(1400, "logo-hero.png")
resize(420,  "logo-nav.png")
resize(96,   "logo-favicon.png")
print("Done.")
