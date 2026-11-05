#!/usr/bin/env python3
"""Compare user reference vs ACTUAL app screenshot at the same viewport.

Usage:
  python verification/pixel_diff.py reference.png actual.png --out verification/compare

Two images must have identical pixel dimensions: resizing a wrong screenshot
would conceal layout errors. Handles RGB/RGBA, exports three artifacts.
"""
import sys, argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

def main():
 p=argparse.ArgumentParser()
 p.add_argument('reference',type=Path)
 p.add_argument('actual',type=Path)
 p.add_argument('--out',type=Path,default=Path('verification/compare'))
 args=p.parse_args()
 ref=Image.open(args.reference).convert('RGB')
 actual=Image.open(args.actual).convert('RGB')
 if ref.size != actual.size:
  sys.exit(f'ERROR: expected images at same viewport. reference={ref.size}, actual={actual.size}')
 args.out.mkdir(parents=True,exist_ok=True)
 ar=np.asarray(ref,dtype=np.float32)
 ac=np.asarray(actual,dtype=np.float32)
 diff=np.abs(ar-ac)
 mae=float(diff.mean()); rmse=float(np.sqrt(np.mean((ar-ac)**2)))
 Image.blend(ref,actual,0.5).save(args.out/'overlay_50pct.png')
 heat=(diff.mean(axis=2).clip(0,255)).astype('uint8')
 # Warm heat map: black=unchanged, bright=large error
 colors=np.zeros((heat.shape[0],heat.shape[1],3),dtype=np.uint8)
 colors[:,:,0] = np.clip(heat.astype(np.float32)*2.7,0,255).astype(np.uint8)
 colors[:,:,1] = np.clip((heat.astype(np.float32)-65)*1.7,0,255).astype(np.uint8)
 colors[:,:,2] = np.clip((heat.astype(np.float32)-145)*1.8,0,255).astype(np.uint8)
 Image.fromarray(colors,'RGB').save(args.out/'difference_heatmap.png')
 side=Image.new('RGB',(ref.width*2,ref.height))
 side.paste(ref,(0,0)); side.paste(actual,(ref.width,0))
 side.save(args.out/'side_by_side.jpg',quality=92)
 print(f'viewport={ref.width}x{ref.height}; MAE={mae:.3f}/255; RMSE={rmse:.3f}/255')
 print('Saved',args.out)

if __name__=='__main__':main()
