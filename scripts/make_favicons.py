#!/usr/bin/env python3
"""Генерирует favicon.ico + apple-touch-icon + 32/192 PNG.
Дизайн: тёмный квадрат с скруглением, оранжевая молния = бренд ФОРС."""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path("/Users/admin/Documents/force_land")

DARK_BG  = (10, 10, 14, 255)
ORANGE_1 = (255, 182, 39, 255)   # верх градиента
ORANGE_2 = (255, 61, 0, 255)     # низ градиента

def make_icon(size: int) -> Image.Image:
    # хайрес → потом resize вниз для антиалиаса
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(s * 0.22)
    draw.rounded_rectangle([(0, 0), (s, s)], radius=radius, fill=DARK_BG)

    # молния — полигон в стиле bolt
    bolt = [
        (s * 0.60, s * 0.18),
        (s * 0.30, s * 0.58),
        (s * 0.46, s * 0.58),
        (s * 0.36, s * 0.84),
        (s * 0.72, s * 0.42),
        (s * 0.54, s * 0.42),
    ]
    # симулируем градиент: рисуем горизонтальные полосы поверх
    bolt_mask = Image.new('L', (s, s), 0)
    mask_draw = ImageDraw.Draw(bolt_mask)
    mask_draw.polygon(bolt, fill=255)

    grad = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    grad_pixels = grad.load()
    for y in range(s):
        t = y / s
        r = int(ORANGE_1[0] + (ORANGE_2[0] - ORANGE_1[0]) * t)
        g = int(ORANGE_1[1] + (ORANGE_2[1] - ORANGE_1[1]) * t)
        b = int(ORANGE_1[2] + (ORANGE_2[2] - ORANGE_1[2]) * t)
        for x in range(s):
            grad_pixels[x, y] = (r, g, b, 255)

    img.paste(grad, (0, 0), bolt_mask)

    return img.resize((size, size), Image.LANCZOS)


# 1) ICO (multi-size)
ico = make_icon(64)
ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print(f"favicon.ico:        {(OUT/'favicon.ico').stat().st_size} bytes")

# 2) PNG 32×32
make_icon(32).save(OUT / "favicon-32.png", optimize=True)
print(f"favicon-32.png:     {(OUT/'favicon-32.png').stat().st_size} bytes")

# 3) PNG 192×192 (для Android и поисковиков)
make_icon(192).save(OUT / "favicon-192.png", optimize=True)
print(f"favicon-192.png:    {(OUT/'favicon-192.png').stat().st_size} bytes")

# 4) Apple Touch Icon 180×180
make_icon(180).save(OUT / "apple-touch-icon.png", optimize=True)
print(f"apple-touch-icon:   {(OUT/'apple-touch-icon.png').stat().st_size} bytes")

print("Done.")
