#!/usr/bin/env python3
"""Strip the white background from the FORCE logo and save resized variants."""
from PIL import Image
from pathlib import Path

SRC = Path("/Users/admin/Documents/force_land/images/Логотип_Форс-01.png")
OUT_DIR = Path("/Users/admin/Documents/force_land/assets")
OUT_DIR.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
px = img.load()
w, h = img.size

# soft white-keying: fully transparent on near-white pixels,
# linear alpha falloff in the antialiased edge zone
WHITE_HARD = 248   # >= -> fully transparent
WHITE_SOFT = 215   # <= -> fully opaque
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        m = min(r, g, b)
        if m >= WHITE_HARD:
            px[x, y] = (r, g, b, 0)
        elif m > WHITE_SOFT:
            t = (WHITE_HARD - m) / (WHITE_HARD - WHITE_SOFT)  # 0..1
            px[x, y] = (r, g, b, int(a * t))

img.save(OUT_DIR / "logo-force.png", optimize=True)

# crop transparent border before resizing
bbox = img.getbbox()
cropped = img.crop(bbox)

def resize(target_w: int, name: str) -> None:
    cw, ch = cropped.size
    scale = target_w / cw
    out = cropped.resize((target_w, int(ch * scale)), Image.LANCZOS)
    out.save(OUT_DIR / name, optimize=True)
    print(f"  {name}: {out.size}")

print("Cropped:", cropped.size)
resize(1400, "logo-hero.png")
resize(420,  "logo-nav.png")
resize(96,   "logo-favicon.png")
print("Done.")
