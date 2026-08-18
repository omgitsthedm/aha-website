#!/usr/bin/env python3
"""Campaign tiles: each capsule graphic on one of the brand's soft grounds with
the title in Poppins Black — the "brutal type, soft color" rule from
Brand Kit 2026-07/BRAND-GUIDELINES.md, rendered as 4:5 editorial images.

    python3 scripts/imagery/render-campaign-tiles.py

Reads data/apliiq-capsule.json for the product list, public/art/<slug>.png for
the graphic, and writes public/editorial/tiles/<slug>.jpg. Fonts come from the
brand kit (SIL OFL). Re-run after adding a product; the lookbook and home page
read the tile paths from data/brand-imagery.json.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KIT = "/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Brand Kit 2026-07/fonts"
FONT_DISPLAY = os.path.join(KIT, "Poppins-Black.ttf")
FONT_MONO = os.path.join(KIT, "JetBrainsMono-Bold.ttf")
W, H = 1200, 1500
INK = (26, 26, 26)
GROUNDS = {  # token: hex from the brand kit
    "rose": (255, 107, 107),
    "sage": (168, 213, 186),
    "sky": (135, 206, 235),
    "cream": (240, 201, 135),
    "paper": (250, 250, 250),
}
# One soft ground per composition; rotate so neighbouring tiles never repeat.
ORDER = ["rose", "sage", "sky", "cream", "paper", "rose", "sage", "sky"]


def render(slug: str, title: str, ground: str, out: str) -> None:
    tile = Image.new("RGBA", (W, H), GROUNDS[ground] + (255,))
    art = Image.open(os.path.join(ROOT, "public", "art", f"{slug}.png")).convert("RGBA")
    bbox = art.getchannel("A").getbbox()
    if bbox:
        art = art.crop(bbox)
    # A white graphic disappears on paper; put it on ink instead.
    if ground == "paper":
        sample = art.resize((16, 16)).convert("RGB").getcolors(256) or []
        bright = sum(c for c, (r, g, b) in sample if r > 200 and g > 200 and b > 200)
        if bright > 128:
            tile = Image.new("RGBA", (W, H), INK + (255,))
    scale = min(W * 0.66 / art.width, H * 0.5 / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    tile.alpha_composite(art, ((W - art.width) // 2, int(H * 0.16) + (int(H * 0.5) - art.height) // 2))

    draw = ImageDraw.Draw(tile)
    text_ink = (250, 250, 250) if tile.getpixel((10, 10))[:3] == INK else INK
    display = ImageFont.truetype(FONT_DISPLAY, 96)
    mono = ImageFont.truetype(FONT_MONO, 26)
    # Title, left-aligned, uppercase, tight leading, up to three lines.
    words = title.upper().split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=display) > W - 160 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    y = H - 120 - 92 * len(lines)
    for line in lines[:3]:
        draw.text((80, y), line, font=display, fill=text_ink)
        y += 92
    draw.text((80, H - 96), "AFTER HOURS AGENDA  ·  PRINTED TO ORDER", font=mono, fill=text_ink)
    tile.convert("RGB").save(out, quality=86, optimize=True, progressive=True)


def main() -> None:
    spec = json.load(open(os.path.join(ROOT, "data", "apliiq-capsule.json")))
    out_dir = os.path.join(ROOT, "public", "editorial", "tiles")
    os.makedirs(out_dir, exist_ok=True)
    for index, product in enumerate(spec["products"]):
        ground = ORDER[index % len(ORDER)]
        out = os.path.join(out_dir, f"{product['slug']}.jpg")
        render(product["slug"], product["title"], ground, out)
        print(f"  {product['slug']:36} {ground:6} -> {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
