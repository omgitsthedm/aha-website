"""Repair existing mockup composites without redrawing the approved artwork.

Requires Pillow, numpy and scipy. Inputs are preserved, full-resolution source
PNGs and the previous white-background master/mask manifest. This command only
creates reviewed lossless masters and a measurement report; export separately.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SIZE = (1122, 1402)
COLORS = {
    'Black': '#000000', 'Forest Green': '#184035', 'Navy': '#111932',
    'Red': '#d60024', 'Heather Grey': '#c1c1c2', 'Royal Blue': '#0647be',
    'Camel': '#a87c48', 'Dark Heather Grey': '#1a171e', 'Gold': '#fec500',
    'Kelly Green': '#45966b', 'Cardinal': '#991313', 'White': '#ffffff',
    'Fuchsia': '#b72657', 'Pink': '#e3b4c6', 'Blaze Orange': '#ff5100',
}
# Measured against the intact originals. Each rectangle surrounds the ENTIRE
# embroidery with spare knit on every side, never a boundary across a letter.
LOGO_BOUNDS = {
    ('cream', 'front'): (220, 940, 800, 1340),
    ('black', 'front'): (230, 880, 790, 1300),
    ('cream', 'folded'): (290, 570, 860, 1000),
    ('black', 'folded'): (290, 580, 820, 990),
}
LABEL = {
    'cream': [(1092, 925), (1226, 972), (1187, 1100), (1049, 1054)],
    'black': [(1085, 869), (1215, 927), (1176, 1067), (1031, 1008)],
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def recolor(source, color, ink, view):
    original = Image.open(source).convert('RGBA')
    pixels = np.array(original)
    rgb = pixels[:, :, :3].astype(float)
    lum = rgb.mean(axis=2) / 255
    components, count = ndimage.label(pixels[:, :, 3] > 100)
    assert count, f'No garment in {source}'
    sizes = np.bincount(components.ravel()); sizes[0] = 0
    silhouette = ndimage.binary_fill_holes(components == sizes.argmax())
    # Remove detached alpha specks without eroding the knit silhouette.
    alpha = np.where(ndimage.binary_dilation(silhouette, iterations=2), pixels[:, :, 3], 0)
    median = np.median(lum[silhouette & ((lum < .3) if ink == 'cream' else (lum > .55))])
    target = np.array([int(color[i:i+2], 16) for i in (1, 3, 5)])
    shade = np.clip(lum / max(median, .025), .25, 1.35)
    out = rgb.copy() if color == '#000000' else np.clip(target * shade[:, :, None] + np.maximum(shade-1, 0)[:, :, None] * 30, 0, 255)

    bounds = LOGO_BOUNDS[(ink, view)]
    roi = np.zeros(lum.shape, dtype=bool)
    x0, y0, x1, y1 = bounds; roi[y0:y1, x0:x1] = True
    # Thread cores remain byte-identical; a soft edge retains antialiased stitches
    # without carrying a rectangular patch of the original garment color.
    thread = np.clip((lum-.18)/.22 if ink == 'cream' else (.58-lum)/.30, 0, 1) * roi
    if view == 'folded':
        label = Image.new('L', original.size)
        ImageDraw.Draw(label).polygon(LABEL[ink], fill=255)
        thread = np.maximum(thread, np.array(label)/255)
    out = np.rint(out * (1-thread[:, :, None]) + rgb * thread[:, :, None]).astype('uint8')
    core = (thread == 1) & roi
    assert np.array_equal(out[core], pixels[:, :, :3][core]), 'Embroidery changed'
    # A regression guard for the previously lost tops of AFTER HOURS.
    upper = core.copy(); upper[1000 if view == 'front' else 680:] = False
    assert upper.sum() > 1000, 'Full upper lettering must be protected'
    assert np.array_equal(out[upper], pixels[:, :, :3][upper])
    result = Image.fromarray(np.dstack((out, alpha.astype('uint8'))))
    result.thumbnail((1010, 1262), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', SIZE, 'white')
    offset = ((SIZE[0]-result.width)//2, (SIZE[1]-result.height)//2)
    canvas.paste(result, offset, result.getchannel('A'))
    mask = Image.new('L', SIZE); mask.paste(result.getchannel('A'), offset)
    return canvas, mask, {'source': str(source), 'source_sha256': sha(source), 'protectedThreadPixels': int(core.sum()), 'protectedUpperThreadPixels': int(upper.sum()), 'changedThreadPixels': 0, 'logoBounds': bounds}


def normalize_camo(row):
    im = Image.open(row['master']).convert('RGB')
    mask = Image.open(row['mask']).convert('L')
    bounds = mask.getbbox()
    assert bounds and row['role'] != 'print-detail'
    # Equal silhouette widths, a common baseline and canvas; uniform scaling only.
    # The source garments have naturally different sleeve arrangements.
    crop = im.crop(bounds); alpha = mask.crop(bounds)
    width = 960 if row['role'] != 'folded' else 940
    height = round(crop.height * width / crop.width)
    crop = crop.resize((width, height), Image.Resampling.LANCZOS)
    alpha = alpha.resize(crop.size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', SIZE, 'white')
    # Full garments share hem baseline; folded garments are centered optically.
    offset = ((SIZE[0]-width)//2, 1240-height if row['role'] != 'folded' else (SIZE[1]-height)//2)
    # Masters already contain white edges; paste them directly to avoid double masking.
    canvas.paste(crop, offset)
    out_mask = Image.new('L', SIZE); out_mask.paste(alpha, offset)
    return canvas, out_mask, {'source': row['master'], 'source_sha256': sha(row['master']), 'originalBounds': bounds, 'normalizedBounds': out_mask.getbbox(), 'uniformScale': width/(bounds[2]-bounds[0])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, required=True)
    parser.add_argument('--previous', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    app = Path(__file__).resolve().parents[2]
    products = json.loads((app/'src/data/products.json').read_text())
    previous = json.loads(args.previous.read_text())
    rows = []

    def save(slug, role, im, mask, checks):
        folder = args.output/slug; folder.mkdir(parents=True, exist_ok=True)
        master = folder/f'{role}.png'; mask_file = folder/f'{role}-mask.png'
        im.save(master); mask.save(mask_file)
        rows.append({'slug': slug, 'role': role, 'master': str(master), 'mask': str(mask_file), 'width': im.width, 'height': im.height, 'master_sha256': sha(master), **checks})

    for product in products:
        slug = product['slug']
        if slug.startswith('after-hours-agenda-heritage-beanie-sp12-'):
            spec = json.loads((app/f'catalog/designs/{slug}.json').read_text())
            ink = spec['local']['ink']
            for view in ['front', 'folded']:
                source = args.sources/f'sp12-{"black" if ink == "cream" else "white"}-{view}.png'
                im, mask, checks = recolor(source, COLORS[product['color']], ink, view)
                save(slug, view, im, mask, checks)
                if view == 'front':
                    box = (180, 730, 940, 1390)
                    detail = im.crop(box).resize(SIZE, Image.Resampling.LANCZOS)
                    detail_mask = mask.crop(box).resize(SIZE, Image.Resampling.LANCZOS)
                    save(slug, 'print-detail', detail, detail_mask, {**checks, 'crop': box})
        elif slug.startswith('camo-sheep-ind4000-'):
            for row in (r for r in previous if r['slug'] == slug):
                if row['role'] == 'print-detail':
                    # Fabric-filled detail stays at its real crop; don't invent missing fabric.
                    continue
                im, mask, checks = normalize_camo(row)
                save(slug, row['role'], im, mask, checks)
    (args.output/'validation.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(f'Prepared {len(rows)} repaired masters, preserving full embroidery and uniform garment scaling.')


if __name__ == '__main__':
    main()
