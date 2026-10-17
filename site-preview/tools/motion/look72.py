"""Shared look for every shot in the films: the drunk-1972 handheld path and 18 fps cadence (owner's film
direction), the FW26 brief's fixed post pass (stock), its amber time stamp, and for the city a tilt-shift
focus band seen from a high angle."""
import numpy as np
from PIL import Image, ImageFilter

W, H = 768, 960
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / np.hypot(W / 2, H / 2)
_v = np.clip((_r - 0.6) / 0.4, 0, 1)
VIGNETTE = (1 - 0.12 * _v * _v * (3 - 2 * _v))[..., None]  # 12% at the corners, starting at 60% of the radius
OVERSCAN = 1.07  # constant for a whole shot so edges never show; never a zoom move


def handheld(rng, count, strength=1.0, fps=18):
    """A slow lurch in one direction, a sway and jitter, in pixels at 768 wide, plus tilt in degrees."""
    t = np.arange(count) / fps
    span = max(t[-1], 1e-6)
    drift = rng.uniform(-1, 1, 2) * rng.uniform(10, 18)
    f, p = rng.uniform(0.6, 1.1), rng.uniform(0, 2 * np.pi)
    jit = rng.normal(0, 1.6, (count, 2)).cumsum(0) * 0.6
    dx = drift[0] * t / span + 7 * np.sin(2 * np.pi * f * t + p) + jit[:, 0]
    dy = drift[1] * t / span + 4 * np.sin(2 * np.pi * f * 0.7 * t + p + 1) + jit[:, 1]
    tilt = rng.uniform(-1, 1) * 1.2 * t / span + rng.normal(0, 0.15, count)
    return dx * strength, dy * strength, tilt * strength


def place(im, dx, dy, tilt):
    big = im.resize((round(W * OVERSCAN), round(H * OVERSCAN)), Image.BICUBIC).rotate(float(tilt), Image.BICUBIC)
    left = (big.width - W) / 2 + dx
    top = (big.height - H) / 2 + dy
    return big.crop((round(left), round(top), round(left) + W, round(top) + H))


def tiltshift(im, center, half, max_radius):
    """Sharp band at `center` (fraction of height); blur grows away from it, like a tilted lens."""
    levels = [0, 1.5, 3, 5, 8, 12]
    levels = [l * max_radius / 12 for l in levels]
    stack = [np.asarray(im, np.float32)] + [np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) for r in levels[1:]]
    d = np.clip((np.abs(yy / H - center) - half) / (1 - half), 0, 1) ** 1.3 * max_radius
    out = np.zeros_like(stack[0])
    for a in range(len(levels) - 1):
        lo, hi = levels[a], levels[a + 1]
        w = np.clip((d - lo) / (hi - lo), 0, 1)
        inside = ((d >= lo) & (d <= hi))[..., None]
        out = np.where(inside, stack[a] * (1 - w[..., None]) + stack[a + 1] * w[..., None], out)
    out = np.where((d > levels[-1])[..., None], stack[-1], out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def crush(x):
    """Black point: input 10% goes to 0 with a soft knee up to 20%, so backgrounds fall to true black."""
    lin = (x - 0.10) / 0.90
    t = np.clip((x - 0.10) / 0.10, 0, 1)
    knee = (0.10 / 0.90) * (-t ** 3 + 2 * t ** 2)
    return np.where(x >= 0.20, lin, np.where(x <= 0.10, 0.0, knee))


def stock(im, rng):
    """The brief's fixed post pass (filmpost v3 numbers), the same on every frame: crushed blacks, then
    0.45 px softness, a shoulder above 85% at 0.7, saturation 0.90, cool shadows and warm highlights,
    halation above 88%, grain 2.2% plus 1.8% in the shadows with 3 px colour clumps, black held below 4%,
    a 12% vignette beyond 60% of the radius, the odd speck of dust. Never sharpened, never lifted."""
    x = crush(np.asarray(im, np.float32) / 255)
    x = np.asarray(Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.45)), np.float32) / 255
    x = np.where(x > 0.85, 0.85 + (x - 0.85) * 0.7, x)
    luma = x @ np.array([0.299, 0.587, 0.114], np.float32)
    x = luma[..., None] + (x - luma[..., None]) * 0.90
    shadow = np.clip(1 - luma / 0.5, 0, 1)[..., None]
    high = np.clip((luma - 0.5) / 0.5, 0, 1)[..., None]
    x = x + shadow * np.array([-0.010, 0.006, 0.010], np.float32) + high * np.array([0.012, 0.0, -0.008], np.float32)
    glow_mask = np.clip((luma - 0.88) / 0.12, 0, 1)
    if glow_mask.any():
        glow = np.asarray(Image.fromarray((glow_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
        x = x + glow[..., None] * np.array([0.10, 0.045, 0.02], np.float32)
    black = (luma < 0.04)[..., None]
    g = rng.normal(0, 1, (H, W)).astype(np.float32)[..., None] * (0.022 + 0.018 * shadow)
    clumps = rng.normal(0, 1, (H // 3, W // 3, 3)).astype(np.float32)
    clumps = np.stack([np.asarray(Image.fromarray(clumps[..., c]).resize((W, H), Image.BICUBIC), np.float32) for c in range(3)], -1)
    x = x + np.where(black, 0, g + clumps * 0.011 * shadow)
    x = x * VIGNETTE
    for _ in range(rng.poisson(0.5)):
        cy, cx, rad = rng.uniform(0, H), rng.uniform(0, W), rng.uniform(1, 3)
        x[((yy - cy) ** 2 + (xx - cx) ** 2) < rad ** 2] *= 0.35
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


# Seven-segment amber time stamp, the brief's signature device: 24-hour, about 2.8% of frame height,
# camera amber (255, 170, 60) with a faint glow, baked into the frame.
SEGMENTS = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg'}


def stamp_layer(text, height):
    """Greyscale masks (crisp, glow) of the stamp text, digits `height` px tall, slanted like a camera's
    date stamp. Drawn at 4x and reduced so the segments have clean edges."""
    from PIL import ImageDraw
    k = 4
    h = float(height) * k; w = h * 0.5; th = h * 0.15; gap = h * 0.24; colon = h * 0.3; pad = h * 0.75
    width = int(sum(colon if c == ':' else w + gap for c in text) + pad * 2)
    img = Image.new('L', (width, int(h + pad * 2)), 0)
    d = ImageDraw.Draw(img)
    x0 = pad
    top, mid, bot = pad, pad + h / 2, pad + h
    for c in text:
        if c == ':':
            for cy in (top + h * 0.3, top + h * 0.72):
                d.rectangle([x0 + colon * 0.2, cy - th / 2, x0 + colon * 0.2 + th, cy + th / 2], fill=255)
            x0 += colon
            continue
        e = th * 0.55  # small gaps where segments meet, as on a real display
        seg = {'a': (x0 + e, top - th / 2, x0 + w - e, top + th / 2), 'g': (x0 + e, mid - th / 2, x0 + w - e, mid + th / 2),
               'd': (x0 + e, bot - th / 2, x0 + w - e, bot + th / 2), 'f': (x0 - th / 2, top + e, x0 + th / 2, mid - e),
               'b': (x0 + w - th / 2, top + e, x0 + w + th / 2, mid - e), 'e': (x0 - th / 2, mid + e, x0 + th / 2, bot - e),
               'c': (x0 + w - th / 2, mid + e, x0 + w + th / 2, bot - e)}
        for s in SEGMENTS[c]:
            d.rectangle(seg[s], fill=255)
        x0 += w + gap
    slant = 0.12
    img = img.transform(img.size, Image.AFFINE, (1, slant, -slant * img.height / 2, 0, 1, 0), resample=Image.BICUBIC)
    img = img.resize((max(1, img.width // k), max(1, img.height // k)), Image.LANCZOS)
    soft = img.filter(ImageFilter.GaussianBlur(max(0.4, height * 0.02)))
    glow = img.filter(ImageFilter.GaussianBlur(height * 0.22))
    return soft, glow


def apply_stamp(frame, text, right, bottom, height):
    """Bake the stamp so its lower-right corner sits at (right, bottom) in pixels."""
    soft, glow = stamp_layer(text, height)
    fh, fw = frame.shape[:2]
    pad = int(height * 0.75)
    x1, y1 = int(right - soft.width + pad), int(bottom - soft.height + pad)
    out = frame.astype(np.float32) / 255
    amber = np.array([255, 170, 60], np.float32) / 255
    for layer, strength in ((glow, 0.5), (soft, 0.95)):
        a = np.zeros((fh, fw), np.float32)
        src = np.asarray(layer, np.float32) / 255
        ys, xs = max(0, -y1), max(0, -x1)
        a[max(0, y1):min(fh, y1 + layer.height), max(0, x1):min(fw, x1 + layer.width)] = src[ys:ys + min(fh, y1 + layer.height) - max(0, y1), xs:xs + min(fw, x1 + layer.width) - max(0, x1)]
        a = (a * strength)[..., None]
        out = out * (1 - a) + amber * a
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
