"""Cut a collection film from treated shots (768x960, 18 fps) with hard cuts, bake the brief's amber
time stamp per shot (the hour moves through one night, 18:00 to 04:00), and encode the web files.
usage: reel.py <name>   (reads the shot list from /tmp/aha-video/films.json)"""
import sys, subprocess, os, json, numpy as np
sys.path.insert(0, '/tmp/aha-video/bin')
from look72 import apply_stamp

WORK = '/tmp/aha-video'
HOURS = ['18:00', '19:15', '20:30', '21:45', '23:00', '00:15', '01:30', '02:45', '04:00']
name = sys.argv[1]
film = next(f for f in json.load(open(f'{WORK}/films.json')) if f['name'] == name)
paths = [f'{WORK}/city/{s}.mp4' if s.startswith('c') and s[1:].isdigit() else f'{WORK}/film/{s}.mp4' for s in film['shots']]
hours = film.get('hours', HOURS)
assert len(hours) == len(paths)


def frames_of(path, w, h):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True, stdin=subprocess.DEVNULL).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


# Where the stamp sits, per file, so it stays visible and off the print in each crop:
# - 800: desktop, uncropped 4:5, lower-right corner.
# - 600: phone hero and collection hero; the home hero trims the top and bottom slightly, so the stamp
#   sits at the right edge, beside the print and above the trimmed bottom.
# - 600t: the full-screen phone lookbook shows only the middle 58% of the width and its Shop chip
#   covers the lower right, so the stamp sits at the bottom edge on the left, under the print.
outputs = [('800', 640, 800, 30, lambda w, h: (w - 0.05 * w, h - 0.045 * h)),
           ('600', 480, 600, 31, lambda w, h: (0.955 * w, 0.895 * h)),
           ('600t', 480, 600, 31, lambda w, h: (0.36 * w, 0.965 * h))]
os.makedirs(f'{WORK}/web', exist_ok=True)
common = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-movflags', '+faststart',
          '-tag:v', 'avc1', '-g', '36', '-map_metadata', '-1']
sizes = {}
for suffix, w, h, crf, where in outputs:
    out = f'{WORK}/web/{name}-{suffix}.mp4'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '18', '-i', '-',
                            *common, '-crf', str(crf), '-r', '18', out], stdin=subprocess.PIPE)
    right, bottom = where(w, h)
    total = 0
    for path, hour in zip(paths, hours):
        for frame in frames_of(path, w, h):
            enc.stdin.write(apply_stamp(frame, hour, right, bottom, round(0.028 * h)).tobytes())
            total += 1
    enc.stdin.close(); enc.wait()
    sizes[suffix] = (os.path.getsize(out), total)
print(name, f"{sizes['800'][1] / 18:.2f} s", sizes['800'][0], sizes['600'][0], sizes['600t'][0])
