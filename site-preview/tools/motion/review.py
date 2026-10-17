"""Review a raw take: per-frame shift of the print area vs frame 0 and a print-crop strip."""
import sys, subprocess, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H = 768, 960
raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
def shift(a, b):
    A=np.fft.fft2(a-a.mean()); B=np.fft.fft2(b-b.mean()); R=A*np.conj(B); R/=np.abs(R)+1e-6
    r=np.fft.ifft2(R).real; y,x=np.unravel_index(r.argmax(), r.shape)
    return int(y-(r.shape[0] if y>r.shape[0]//2 else 0)), int(x-(r.shape[1] if x>r.shape[1]//2 else 0))
g = lambda i: f[i, 160:800, 120:648].mean(2).astype(np.float32)
print('frames', len(f), 'shift vs 0:', [shift(g(0), g(i)) for i in range(0, len(f), 4)])
idx = [0, len(f)//2, len(f)-1]
strip = Image.new('RGB', (3*384, 480))
for k, i in enumerate(idx): strip.paste(Image.fromarray(f[i]).resize((384, 480)), (k*384, 0))
strip.save(out, quality=88)
