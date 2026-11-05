#!/usr/bin/env python3
"""Extract non-interactive frame artwork from USER-SUPPLIED reference screenshot.

IMPORTANT: The image has no true transparency. This extraction deliberately takes
only the frame-adjacent bands and mechanical corner reactors; it is NOT a perfect
alpha decomposition of unseen layers.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json, math

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'reference.png'
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
im = Image.open(SOURCE).convert('RGBA')

# Exact screenshot-space ROIs, manually grounded in the user-supplied 1801x873 reference.
# Coordinates [left, top, right, bottom]. `ring` is distance of retained trim bands.
FRAMES = {
 'header': {'box': [286, 6, 1780, 105], 'ring': [23, 22, 23, 24], 'reactors': [[49, 49, 48]], 'band_kind': 'header'},
 'sidebar': {'box': [0, 81, 264, 864], 'ring': [48, 24, 34, 24], 'reactors': [[40, 43, 39]], 'band_kind': 'sidebar'},
 'today': {'box': [256, 122, 888, 443], 'ring': [37, 38, 34, 34], 'reactors': [[39, 38, 39], [581, 272, 48]], 'band_kind': 'main'},
 'boss': {'box': [894, 122, 1365, 443], 'ring': [36, 33, 37, 31], 'reactors': [[36, 39, 39]], 'band_kind': 'main'},
 'ai': {'box': [1358, 122, 1782, 446], 'ring': [37, 31, 34, 30], 'reactors': [[46, 38, 38]], 'band_kind': 'main'},
 'skills': {'box': [260, 437, 898, 865], 'ring': [39, 40, 34, 32], 'reactors': [[47, 39, 41]], 'band_kind': 'main'},
 'character': {'box': [892, 436, 1367, 712], 'ring': [41, 34, 35, 30], 'reactors': [[39, 40, 39]], 'band_kind': 'main'},
 'achievements': {'box': [892, 681, 1367, 863], 'ring': [36, 35, 32, 30], 'reactors': [[39, 29, 30]], 'band_kind': 'main'},
 'rewards': {'box': [1361, 435, 1782, 863], 'ring': [40, 35, 33, 32], 'reactors': [[43, 42, 40]], 'band_kind': 'main'},
}

for key, spec in FRAMES.items():
 l,t,r,b=spec['box']; w,h=r-l,b-t
 crop=im.crop((l,t,r,b))
 # Hand-specified frame bands, purposely transparent in middle to expose live DOM.
 mask=Image.new('L',(w,h),0)
 d=ImageDraw.Draw(mask)
 tb,lb,bb,rb=spec['ring']
 if key=='header':
  # The header is a connected, highly irregular chrome/neon ribbon.
  d.rectangle((0,0,w-1,tb),fill=255)
  d.rectangle((0,h-bb,w-1,h-1),fill=255)
  d.rectangle((0,0,34,h-1),fill=255)
  d.rectangle((w-rb,0,w-1,h-1),fill=255)
 elif key=='sidebar':
  d.rectangle((0,39,w-1,70),fill=255)
  d.rectangle((0,0,lb,h-1),fill=255)
  d.rectangle((w-rb,0,w-1,h-1),fill=255)
  d.rectangle((0,h-bb,w-1,h-1),fill=255)
 else:
  d.rectangle((0,10,w-1,tb),fill=255)
  d.rectangle((0,h-bb,w-1,h-1),fill=255)
  d.rectangle((0,0,lb,h-1),fill=255)
  d.rectangle((w-rb,0,w-1,h-1),fill=255)
  # Metallic edge-caps extend farther into corners in the reference.
  d.polygon([(0,0),(85,0),(52,55),(0,62)],fill=255)
  d.polygon([(w-84,0),(w,0),(w,65),(w-46,48)],fill=255)
  d.polygon([(0,h),(74,h),(44,h-57),(0,h-35)],fill=255)
  d.polygon([(w-80,h),(w,h),(w,h-60),(w-51,h-49)],fill=255)
 for cx,cy,rad in spec['reactors']:
  d.ellipse((cx-rad,cy-rad,cx+rad,cy+rad),fill=255)
 # Minor feather only at alpha boundaries prevents hard rectangular clipping artifacts.
 # Composite base alpha at 91% near rim. This ensures city bleed is not fully opaque.
 mask=mask.filter(ImageFilter.GaussianBlur(1.25))
 crop.putalpha(mask)
 crop.save(OUT/f'{key}.png', optimize=True)
 spec['size']=[w,h]

(ROOT/'frame-coordinates.json').write_text(json.dumps({'referenceSize':[im.width,im.height],'frames':FRAMES},indent=2,ensure_ascii=False),encoding='utf8')
print('Extracted',len(FRAMES),'visual frame overlays from',SOURCE.name)
