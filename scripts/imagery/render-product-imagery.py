#!/usr/bin/env python3
"""Studio product imagery from the print file alone.

    python3 scripts/imagery/render-product-imagery.py [slug ...]

For each product in data/apliiq-capsule.json (or the slugs given) this renders
three 1200×1500 images into public/products/<slug>/:

    front.jpg   the garment on a warm studio backdrop with a soft shadow
    detail.jpg  a crop on the print, as a product photographer would shoot it
    art.jpg     the flat artwork on ink

The garment comes from APLIIQ's own base image for the product's front
location (`https://blob.apliiq.com/sitestorage/base/<frontLocationId>.png`,
944×1440: translucent shading over an opaque-white outside), composited over a
solid colour fill; the print file is public/art/<slug>.png. Real photography
replaces these files one-for-one — same folder, same names.

Requires Pillow. Base images are cached in .cache/apliiq-base/.
"""
import json
import os
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".cache", "apliiq-base")
OUT_W, OUT_H = 1200, 1500
BACKDROP = (243, 241, 236)
FILL = {50: (12, 12, 14)}  # APLIIQ colour id → garment fill; black is the only capsule colour today

# Print box on the 944×1440 base and how much to lift the base's shading, per garment kind.
KINDS = {
    "tee":    {"box": (280, 462, 664, 940), "shade": 1.0},
    "hoodie": {"box": (300, 556, 644, 884), "shade": 1.0},
    "crew":   {"box": (290, 420, 654, 900), "shade": 1.5},
}


def fetch(url: str, name: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return path


def garment_mask(base: Image.Image) -> Image.Image:
    px = base.load()
    mask = Image.new("L", base.size, 0)
    mp = mask.load()
    for y in range(base.height):
        for x in range(base.width):
            r, g, b, a = px[x, y]
            mp[x, y] = 0 if (a == 255 and r > 245 and g > 245 and b > 245) else 255
    return mask.filter(ImageFilter.MinFilter(3))


def render(product: dict) -> None:
    slug = product["slug"]
    kind = KINDS[product.get("imageKind", "tee")]
    base = Image.open(fetch(f"https://blob.apliiq.com/sitestorage/base/{product['frontLocationId']}.png",
                            f"{product['frontLocationId']}.png")).convert("RGBA")
    if kind["shade"] != 1.0:
        r, g, b, a = base.split()
        a = a.point(lambda v: v if v >= 250 else min(249, int(v * kind["shade"])))
        base = Image.merge("RGBA", (r, g, b, a))
    mask = garment_mask(base)
    bbox = mask.getbbox()
    fill = FILL.get(product.get("colorId", 50), (12, 12, 14))
    canvas = Image.new("RGBA", base.size, fill + (255,))

    art = Image.open(os.path.join(ROOT, "public", "art", f"{slug}.png")).convert("RGBA")
    ab = art.getchannel("A").getbbox()
    if ab:
        art = art.crop(ab)
    x0, y0, x1, y1 = kind["box"]
    s = min((x1 - x0) / art.width, (y1 - y0) / art.height)
    art = art.resize((max(1, round(art.width * s)), max(1, round(art.height * s))), Image.LANCZOS)
    art.putalpha(art.getchannel("A").point(lambda v: int(v * 0.96)))
    ax, ay = x0 + ((x1 - x0) - art.width) // 2, y0
    canvas.alpha_composite(art, (ax, ay))
    garment = Image.alpha_composite(canvas, base)
    cut = Image.new("RGBA", base.size, (0, 0, 0, 0))
    cut.paste(garment, (0, 0), mask)

    # Studio front
    gx0, gy0, gx1, gy1 = bbox
    gw, gh = gx1 - gx0, gy1 - gy0
    scale = min(OUT_W * 0.86 / gw, OUT_H * 0.84 / gh)
    tw, th = round(gw * scale), round(gh * scale)
    g = cut.crop(bbox).resize((tw, th), Image.LANCZOS)
    m = mask.crop(bbox).resize((tw, th), Image.LANCZOS)
    bg = Image.new("RGBA", (OUT_W, OUT_H), BACKDROP + (255,))
    vignette = Image.new("L", (OUT_W, OUT_H), 0)
    ImageDraw.Draw(vignette).ellipse((-OUT_W * 0.2, -OUT_H * 0.1, OUT_W * 1.2, OUT_H * 1.05), fill=255)
    bg = Image.composite(bg, Image.new("RGBA", (OUT_W, OUT_H), (226, 223, 216, 255)), vignette.filter(ImageFilter.GaussianBlur(220)))
    ox, oy = (OUT_W - tw) // 2, (OUT_H - th) // 2 + 10
    shadow = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", (tw, th), (20, 18, 16, 110)), (ox + 6, oy + 26), m)
    bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(28)))
    bg.alpha_composite(g, (ox, oy))
    out_dir = os.path.join(ROOT, "public", "products", slug)
    os.makedirs(out_dir, exist_ok=True)
    front = bg.convert("RGB")
    front.resize((960, 1200), Image.LANCZOS).save(os.path.join(out_dir, "front.jpg"), quality=82, optimize=True, progressive=True)

    # Print detail: a 4:5 window ~1.5× the art, centred on it
    sx0, sy0 = ox + (ax - gx0) * scale, oy + (ay - gy0) * scale
    sx1, sy1 = ox + (ax + art.width - gx0) * scale, oy + (ay + art.height - gy0) * scale
    cx, cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2
    cw = max(sx1 - sx0, (sy1 - sy0) * 0.8) * 1.5
    ch = max(cw * 1.25, (sy1 - sy0) * 1.3)
    cw = ch * 0.8
    left = max(0, min(OUT_W - cw, cx - cw / 2))
    top = max(0, min(OUT_H - ch, cy - ch / 2))
    front.crop((int(left), int(top), int(left + cw), int(top + ch))).resize((960, 1200), Image.LANCZOS) \
        .save(os.path.join(out_dir, "detail.jpg"), quality=82, optimize=True, progressive=True)

    # Flat art on ink
    card = Image.new("RGBA", (OUT_W, OUT_H), (20, 20, 22, 255))
    flat = Image.open(os.path.join(ROOT, "public", "art", f"{slug}.png")).convert("RGBA")
    fb = flat.getchannel("A").getbbox()
    if fb:
        flat = flat.crop(fb)
    fs = min(OUT_W * 0.72 / flat.width, OUT_H * 0.72 / flat.height)
    flat = flat.resize((round(flat.width * fs), round(flat.height * fs)), Image.LANCZOS)
    card.alpha_composite(flat, ((OUT_W - flat.width) // 2, (OUT_H - flat.height) // 2))
    card.convert("RGB").resize((960, 1200), Image.LANCZOS).save(os.path.join(out_dir, "art.jpg"), quality=82, optimize=True, progressive=True)
    print(f"  {slug:36} -> public/products/{slug}/{{front,detail,art}}.jpg")


def main() -> None:
    spec = json.load(open(os.path.join(ROOT, "data", "apliiq-capsule.json")))
    wanted = set(sys.argv[1:])
    for product in spec["products"]:
        if wanted and product["slug"] not in wanted:
            continue
        render(product)


if __name__ == "__main__":
    main()
