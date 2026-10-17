"""Garment shot: torso take at 18 fps cadence with the drunk 1972 handheld and shared stock,
applied after generation so the model never gets to polish it.
usage: film72.py <in.mp4> <out.mp4> <seed> [frames=14] [start=0] [rate=1.0]
rate is source frames per output frame; 1.0 plays the first frames slightly slowed, before any late drift."""
import sys, subprocess, numpy as np
from PIL import Image
sys.path.insert(0, '/tmp/aha-video/bin')
from look72 import W, H, handheld, place, stock

src, dst, seed = sys.argv[1], sys.argv[2], int(sys.argv[3])
count = int(sys.argv[4]) if len(sys.argv) > 4 else 14
first = int(sys.argv[5]) if len(sys.argv) > 5 else 0
rate = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
rng = np.random.default_rng(seed)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
picks = [min(len(frames) - 1, first + round(k * rate)) for k in range(count)]
dx, dy, tilt = handheld(rng, count)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '18', '-i', '-',
                        '-c:v', 'libx264', '-crf', '10', '-preset', 'medium', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
for k, i in enumerate(picks):
    enc.stdin.write(stock(place(Image.fromarray(frames[i]), dx[k], dy[k], tilt[k]), rng).tobytes())
enc.stdin.close(); enc.wait()
print('film72', dst, count, 'frames at 18 fps from', picks[0], 'to', picks[-1])
