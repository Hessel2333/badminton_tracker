#!/usr/bin/env python3
"""Process the explicitly listed import using existing tube/shaft geometry.
Requires Pillow, NumPy, and the gear-import-geometry Swift helper.
Originals are never overwritten. Inspect generated previews before shipping.
"""
import argparse,json,subprocess,shutil,tempfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--geometry',required=True);p.add_argument('--manifest',default='catalog/imports/2026-10-08-downloads.json');args=p.parse_args()
manifestpath=root/args.manifest;manifest=json.loads(manifestpath.read_text())
imagepath=root/'ios/BadmintonTracker/BadmintonTracker/Resources/GearImages/gear-image-manifest.json';images=json.loads(imagepath.read_text())
webpath=root/'src/lib/data/project-gear-catalog.ts';web=webpath.read_text()
previews=[]
for row in manifest['items']:
 key=row['imageKey'];category='shuttlecocks' if '_shuttlecock_' in key else 'rackets'
 original=root/'assets/gear_image/original'/category/row['fileName']
 output=root/'assets/gear_image/cutout'/category/(key+'.png');output.parent.mkdir(parents=True,exist_ok=True)
 if category=='shuttlecocks':
  result=subprocess.run([args.geometry,'tube',str(original),str(output)],capture_output=True)
  if result.returncode:
   # Solid tube fallback: keep its row envelope, including white print inside.
   pixels=np.array(Image.open(original).convert('RGBA'))
   mask=np.zeros(pixels.shape[:2],dtype=bool)
   for y,rowPixels in enumerate(pixels):
    xs=np.flatnonzero(np.min(rowPixels[:,:3],axis=1)<220)
    if len(xs)>8:mask[y,xs[0]:xs[-1]+1]=True
   pixels[:,:,3]=mask.astype(np.uint8)*255
   out=Image.fromarray(pixels);out=out.crop(out.getbbox());out.save(output)
  angle=0
 else:
  im=Image.open(original).convert('RGBA')
  draft=np.array(im);draft[:,:,3]=np.where(np.all(draft[:,:,:3]>=246,axis=2),0,255)
  with tempfile.NamedTemporaryFile(suffix='.png') as temp:
   Image.fromarray(draft).save(temp.name)
   axis=float(subprocess.check_output([args.geometry,'angle',temp.name],text=True))
  angle=-((90-axis+90)%180-90)
  if abs(angle)>.4:im=im.rotate(angle,Image.Resampling.BICUBIC,expand=True,fillcolor=(255,255,255,255))
  pixels=np.array(im);rgb=pixels[:,:,:3];h,w=rgb.shape[:2]
  # Existing resolver's light-background threshold, with an opaque shaft/grip envelope.
  foreground=~np.all(rgb>=246,axis=2)
  yy,xx=np.where(foreground);top,bottom=int(yy.min()),int(yy.max())
  # Below the head, preserve white paint between the edges of the slender shaft/grip.
  center=float(np.median(xx[yy>top+(bottom-top)*.5]))
  for y in range(top+int((bottom-top)*.42),bottom+1):
   xs=np.flatnonzero(foreground[y]);xs=xs[np.abs(xs-center)<(bottom-top)*.055]
   if len(xs)>1:
    foreground[y,xs[0]:xs[-1]+1]=True
  # Remove the floor shadow beside the green 99 Pro grip.
  if 'astrox99pro_green' in key:
   lower=top+int((bottom-top)*.78)
   columns=np.arange(w)
   foreground[lower:,np.abs(columns-center)>(bottom-top)*.025]=False
  pixels[:,:,3]=foreground.astype(np.uint8)*255
  out=Image.fromarray(pixels);bounds=out.getbbox()
  if not bounds:raise RuntimeError(f'Empty cutout: {key}')
  out=out.crop(bounds);out.save(output)
 for destination in [root/'public/gear-images/cutout'/output.name,root/'ios/BadmintonTracker/BadmintonTracker/Resources/GearImages'/output.name]:shutil.copy2(output,destination)
 images['images'][key]=output.name
 web=web.replace('/gear-images/original/'+row['fileName'],'/gear-images/cutout/'+output.name)
 row.update(processedFileName=output.name,rotationDegrees=round(angle,3),processing='existing-geometry-and-light-background-mask')
 im=Image.open(output).convert('RGBA');im.thumbnail((210,340))
 tile=Image.new('RGB',(240,390),(80,87,95));tile.paste(im,((240-im.width)//2,10),im)
 ImageDraw.Draw(tile).text((8,360),key.replace('yonex_racket_','').replace('_main_01',''),fill='white')
 previews.append(tile)
images['version']+=1;imagepath.write_text(json.dumps(images,ensure_ascii=False,indent=2)+'\n');webpath.write_text(web)
manifestpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
preview=Image.new('RGB',(1200,780),'white')
for i,tile in enumerate(previews):preview.paste(tile,((i%5)*240,(i//5)*390))
outdir=root/'output/gear-import-2026-10-08';outdir.mkdir(parents=True,exist_ok=True);preview.save(outdir/'preview.jpg')
print('Processed',len(previews),'images. Preview:',outdir/'preview.jpg')
