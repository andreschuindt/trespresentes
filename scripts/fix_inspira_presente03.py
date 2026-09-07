import base64, io, re, math
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageChops, ImageStat, ImageDraw, ImageFont

REF_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoAGQDASIAAhEBAxEB/8QAHAAAAQQDAQAAAAAAAAAAAAAAAAMEBQcBAgYI/8QAORAAAQMDAgMFAwsEAwAAAAAAAQIDBAAFEQYhEjFBBxMiUWFVcZIIFBUWFyMyQoGh0SYzkfA1Y8H/xAAZAQACAwEAAAAAAAAAAAAAAAAAAgMEBQH/xAAlEQACAQQBBAEFAAAAAAAAAAAAAQIDBBFRExIhMUGhFDJxweH/2gAMAwEAAhEDEQA/AKPNW52J6LtN8gTbleYyZfA8GGmVk8A8IJUQOZ3AqvdIJgv3lEW5tIXHkJLYKtuFfNJB6b7frV/dksCPabFcGWFr7pMpSjx7lPgG2etLc3SjLh7p+TTt4qVRJi6dH6MUT/TzAwATmOsf7zrZOjdGkp/p6OM4Aywsc8evqP38qVk6rWl5zu21htBIOGVKG3PJ9OtdFBmCXGbeRtxZyM9aoqvJ+2bFSzVNZlFHOMaI0e+paW7BDyg4OWlJ6kdT6GlToDSfsCD8J/mouRqa7xJU5pbSpDzN0UwhlTJQPmy+ANrKgk5AKicjnwnPI1vB1pPk21D7llU08uS2wEkucCQtnvMqPBkeL7vlgKIzUmZ7Kq49fBIfUDSnsGD8J/mj6gaU9gwfhP8ANQadd3d19hpGnFp7wN5LinAAVloFH4OaC4eI8vArHojL1tfWJMZ76Ee7l2Oh1cbullaVYeygEJ/EVNpG+2CDjejM9/IZpa+CSnaX0RBXwSbLCQrHEB3Tits46Z8qTcsGhWXChdnhBQODhlw7/wCK6izTHJ9sYlPNpaccBJShRIxk4IyAdxg7jrT3b/TUbqT2TqlTazgrzVWhNNztKzJVpgNRH22VPsus8Sc4BOCD0OOorz6B4iD0r13dY65dqmxmcBx5laEknAyUkDJryhe7dLs90kQbiwuPKaVhSFfsR5g8wRV60k5Jpsz7yChJdKG3FRSfFRVzBTLD7Hp+m/nj1q1DZGpkiSrMeT83U8oHG6CBkgdQoDbfNXpaLdHhJnNR2y2265kpJz+UDr6V5w7PtbK0W9Mfj2uNMkSEhHeuuKSpCR+UY6E7n3Crt7LtUSdV2qdNmpYbfTJ4e7ZBAQnhGOe5671g3dpV+r512hjec/hejQtJx+1+fQtJ03IVIWEKUWXD94kKAS57+o9cc66SEwIsdtoHJGSSPOnGa0J3FcUUjWqVpVFiRwUu1avmzbo5DujkJoyX0MIfeVgoOC2tAAIAG4x1zvyFP7bZtSRrnb35N3LzCXnHJaFPrVxpJc4UJSU4ACVN+W6TUs+hoPvYbbyV8SstLJJ33yNutN0NJKjhLYKU8I+6d2HQc6m6mU1TSf8ATmLbZNayLey6/e5EZTkchbDrx7xt7GAsq4SMEjdA2AOQc06+rOpmpDxi311LTyEklUlZX3gZQnOSkjh40qOBjIX0IFT5S2lGA2nIyR9y5j1yKyxED7WUtxyArPiQ4nHuBPrQ5sFSXj9nPIsGr0NvoVfuPPApol9YKcEcaSeHfiHFg/l2xmp/TNvulvXJ+lZypqXFqUla31LKQD4EhPCANs5I5nG1Om4KkuIUExxhQVtx7Y8t6kuufKkc8kkaSTyKJVuMnHoKrX5RtmZcsNtvKUhMlh4Rlq6qbUCQD7lD9zVjtfjFVZ8ozUTCosDT0dYW+FiVJAP9sBJCEn1OSceQHnVi0z1LBVvcJFG0Ui46UqwBmitUyjY1J2K/XGxPqdtkp1hShhXArGR60UV1pPsxk8PsT32l6lxj6Re9/FWD2l6l9ovfFRRUfFDQ3JPZg9pepPaD/wAVYPaVqT2jI+KiijihoOSezH2k6k9ov/FQntJ1Jn/kX/ioornFDRzlns2+0jUntF//ADUvZu129w/BMbanN/8AYSlQ/Uf+0UUcMH6DlnseXTtiu0hhTduhx4SyP7vEXFJ92dgf0NVpJfdlSHZElxbrziitbi1ZUonmSTzoopowjHwhZScvLGBOST50UUUwp//Z"

path = Path('index.html')
html = path.read_text(encoding='utf-8')
ref = Image.open(io.BytesIO(base64.b64decode(REF_B64))).convert('RGB').resize((100,40))
pat = re.compile(r'data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)', re.I)
matches = list(pat.finditer(html))
print('data images:', len(matches))
best = None
for i,m in enumerate(matches):
    try:
        raw = base64.b64decode(m.group(2)); im = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception:
        continue
    w,h = im.size
    if not h or not (2.2 <= w/h <= 2.8):
        continue
    sample = im.resize((100,40))
    rms = math.sqrt(sum(v*v for v in ImageStat.Stat(ImageChops.difference(sample,ref)).rms)/3)
    print(i, w, h, m.group(1), round(rms,2))
    if best is None or rms < best[0]: best = (rms,i,m,im)
if best is None or best[0] > 45:
    raise SystemExit('Correspondência segura da arte não encontrada: ' + repr(best[:2] if best else None))
rms,idx,m,pil = best
print('alvo:', idx, pil.size, m.group(1), 'rms=', rms)
arr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR); gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
H,W = gray.shape; sx,sy = W/500.0,H/200.0; mask = np.zeros_like(gray)
def erase_text(x1,y1,x2,y2,thr=175):
    X1,Y1,X2,Y2=int(x1*sx),int(y1*sy),int(x2*sx),int(y2*sy)
    roi=np.zeros_like(mask); roi[Y1:Y2,X1:X2]=255
    sel=((gray<thr)&(roi>0)).astype(np.uint8)*255
    k=max(1,round(min(sx,sy))); return cv2.dilate(sel,np.ones((k+1,k+1),np.uint8),iterations=1)
mask=np.maximum(mask,erase_text(330,24,411,45)); mask=np.maximum(mask,erase_text(229,124,328,146))
arr=cv2.inpaint(arr,mask,max(2,round(2*min(sx,sy))),cv2.INPAINT_TELEA)
out=Image.fromarray(cv2.cvtColor(arr,cv2.COLOR_BGR2RGB)); draw=ImageDraw.Draw(out)
font_b=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',max(8,round(10*sy)))
font_r=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',max(8,round(10*sy)))
badge='INSPIRA'; bb=draw.textbbox((0,0),badge,font=font_b); tw=bb[2]-bb[0]; th=bb[3]-bb[1]
draw.text((371*sx-tw/2,35*sy-th/2-1*sy),badge,font=font_b,fill=(123,42,40))
draw.text((231*sx,129*sy),'INSPIRA',font=font_r,fill=(108,72,76))
buf=io.BytesIO(); fmt=m.group(1).lower()
if fmt=='png': out.save(buf,'PNG',optimize=True)
elif fmt in ('jpg','jpeg'): out.save(buf,'JPEG',quality=94,optimize=True)
else: out.save(buf,'WEBP',quality=94,method=6)
replacement='data:image/'+m.group(1)+';base64,'+base64.b64encode(buf.getvalue()).decode()
path.write_text(html[:m.start()]+replacement+html[m.end():],encoding='utf-8')
print('Arte corrigida no index.html')
