import sys, os
from PIL import Image
lst=[l.split() for l in open('/tmp/aha-video/campaign-list.txt')]
out=[]
for line in open('/tmp/aha-video/shots.txt'):
    name, idx, cx, cy, wf = line.split(); idx=int(idx); cx,cy,wf=float(cx),float(cy),float(wf)
    p=lst[idx][2]
    im=Image.open(p).convert('RGB'); W,H=im.size
    cw=int(W*wf); ch=int(cw*1.25)
    x=max(0,min(W-cw,int(W*cx-cw/2))); y=max(0,min(H-ch,int(H*cy-ch/2)))
    im.crop((x,y,x+cw,y+ch)).resize((768,960),Image.LANCZOS).save(f'/tmp/aha-video/torso/{name}.jpg',quality=95)
    out.append(name)
sheet=Image.new('RGB',(8*200,2*250))
for i,n in enumerate(out):
    sheet.paste(Image.open(f'/tmp/aha-video/torso/{n}.jpg').resize((200,250)),((i%8)*200,(i//8)*250))
sheet.save('/tmp/aha-video/torso-sheet.jpg',quality=85); print(out)
