"""Cut a collection film from treated shots (all 768x960 at 18 fps) with hard cuts, then
encode the web files. usage: reel.py <name> <shot.mp4> [<shot.mp4> ...]"""
import sys, subprocess, os
name, shots = sys.argv[1], sys.argv[2:]
out = '/tmp/aha-video/web'
os.makedirs(out, exist_ok=True)
listing = f'/tmp/aha-video/{name}-concat.txt'
with open(listing, 'w') as f:
    for s in shots:
        f.write(f"file '{os.path.abspath(s)}'\n")
master = f'/tmp/aha-video/{name}-master.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listing, '-c:v', 'libx264', '-crf', '12', '-r', '18', '-pix_fmt', 'yuv420p', master], check=True)
common = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-movflags', '+faststart', '-tag:v', 'avc1', '-g', '36', '-map_metadata', '-1', '-r', '18']
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-vf', 'scale=640:800:flags=lanczos', *common, '-crf', '30', f'{out}/{name}-800.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-vf', 'scale=480:600:flags=lanczos', *common, '-crf', '31', f'{out}/{name}-600.mp4'], check=True)
dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{out}/{name}-800.mp4'], capture_output=True, text=True).stdout.strip()
print(name, dur, 's', os.path.getsize(f'{out}/{name}-800.mp4'), os.path.getsize(f'{out}/{name}-600.mp4'))
