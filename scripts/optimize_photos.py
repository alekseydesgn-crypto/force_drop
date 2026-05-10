#!/usr/bin/env python3
"""Convert big JPGs in images/interior to webp at sane dimensions."""
from pathlib import Path
from PIL import Image, ImageOps

SRC = Path("/Users/admin/Documents/force_land/images/interior")
MAX_W = 1800
QUALITY = 82

for jpg in sorted(SRC.glob("*.JPG")) + sorted(SRC.glob("*.jpg")):
    img = Image.open(jpg)
    img = ImageOps.exif_transpose(img)
    if img.width > MAX_W:
        ratio = MAX_W / img.width
        img = img.resize((MAX_W, int(img.height * ratio)), Image.LANCZOS)
    out = SRC / (jpg.stem.replace(" ", "_") + ".webp")
    img.save(out, "WEBP", quality=QUALITY, method=6)
    src_kb = jpg.stat().st_size // 1024
    out_kb = out.stat().st_size // 1024
    print(f"{jpg.name} ({src_kb} KB) -> {out.name} ({out_kb} KB)")
    jpg.unlink()
print("Done.")
