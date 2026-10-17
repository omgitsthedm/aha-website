"""Shared 1972 look for every shot in the film: handheld path, faded warm stock, grain,
vignette, dust, and (for the city) a tilt-shift focus band seen from a high angle."""
import numpy as np
from PIL import Image, ImageFilter

W, H = 768, 960
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
VIGNETTE = (1 - 0.28 * np.clip(_r - 0.35, 0, None) ** 1.6)[..., None]
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


def tone(x):
    # Darks and mids stay put (colours read true); only highlights get squashed, so nothing is bright.
    knee = 0.5
    s = np.where(x < knee, x, knee + 0.3 * (1 - np.exp(-(x - knee) / 0.3)))
    return 0.035 + 0.965 * s


def stock(im, rng, soften=1.15, grain=0.05):
    """Tired lens, washed warm stock, uneven exposure, grain, vignette, the odd speck of dust."""
    if soften:
        im = im.filter(ImageFilter.GaussianBlur(soften))
    x = np.asarray(im, np.float32) / 255
    luma = x @ np.array([0.299, 0.587, 0.114], np.float32)
    x = luma[..., None] + (x - luma[..., None]) * 0.82
    x = x * np.array([1.03, 1.0, 0.96], np.float32)
    x = tone(np.clip(x * rng.uniform(0.93, 1.03), 0, 1))
    x = x + np.array([0.0, 0.008, -0.002], np.float32) * (1 - x)
    g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
    g = np.asarray(Image.fromarray(g).resize((W, H), Image.BILINEAR), np.float32)
    x = x + g[..., None] * grain * (0.6 + 0.4 * (1 - x))
    x = x * VIGNETTE
    for _ in range(rng.poisson(0.6)):
        cy, cx, rad = rng.uniform(0, H), rng.uniform(0, W), rng.uniform(1, 3.5)
        x[((yy - cy) ** 2 + (xx - cx) ** 2) < rad ** 2] *= 0.35
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)
