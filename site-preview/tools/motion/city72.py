"""City shot: a 4:5 window from high-angle footage, tilt-shift focus band, 18 fps cadence,
a gentle rooftop sway and the shared 1972 stock.
usage: city72.py <in.mp4> <out.mp4> <seed> <start_s> <crop_cx> <focus_y> [frames=29] [speed=1.0] [blur=11]"""
import sys, subprocess, numpy as np
from PIL import Image
sys.path.insert(0, '/tmp/aha-video/bin')
from look72 import W, H, handheld, place, tiltshift, stock

src, dst, seed = sys.argv[1], sys.argv[2], int(sys.argv[3])
start, cx, focus = float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
count = int(sys.argv[7]) if len(sys.argv) > 7 else 29
speed = float(sys.argv[8]) if len(sys.argv) > 8 else 1.0
blur = float(sys.argv[9]) if len(sys.argv) > 9 else 11
rng = np.random.default_rng(seed)

sw, sh = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True, check=True).stdout.strip().split(','))
cw = min(sw, round(sh * 0.8)) // 2 * 2
ch = round(cw * 1.25) // 2 * 2
x0 = int(min(max(cx * sw - cw / 2, 0), sw - cw))
y0 = (sh - ch) // 2
span = count / 18 * speed
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', f'{span + 0.2:.3f}', '-i', src,
                      '-vf', f'crop={cw}:{ch}:{x0}:{y0},scale={W}:{H}:flags=lanczos,fps=60', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
dx, dy, tilt = handheld(rng, count, strength=0.4)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '18', '-i', '-',
                        '-c:v', 'libx264', '-crf', '10', '-preset', 'medium', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
for k in range(count):
    i = min(len(frames) - 1, round(k / 18 * speed * 60))
    im = tiltshift(Image.fromarray(frames[i]), focus, 0.07, blur)
    im = place(im, dx[k], dy[k], tilt[k])
    enc.stdin.write(stock(im, rng, soften=0.6).tobytes())
enc.stdin.close(); enc.wait()
print('city72', dst, count, 'frames', f'{span:.2f}s of source from {start}s', f'crop {cw}x{ch}+{x0}+{y0}')
