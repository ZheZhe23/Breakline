"""Pack original illustrated figures, not grid fragments. No anatomy deformation.
Connected-component slicing preserves complete bodies where source rows drift.
Every base frame keeps its original pixel scale; all extra frames share one scale.
"""
from PIL import Image
from scipy import ndimage
from pathlib import Path
import numpy as np,json,hashlib,shutil
root=Path(__file__).resolve().parents[1];cell=336;anchor=[164,260];paddingX=60
inputs={'nova':'exec-a2db202e-28a9-4a82-801e-9cf38885cadd.png','iris':'exec-df9bb2cb-deaf-4315-8e2e-49c2e1f3ae52.png','brick':'exec-426ca777-56a6-4cd3-893b-6d953df584d8.png'}
def figures(im,columns,rows):
 a=np.asarray(im.getchannel('A'));labels,n=ndimage.label(a>20);areas=np.bincount(labels.ravel());objects=ndimage.find_objects(labels);chosen={}
 for i,b in enumerate(objects,1):
  if b is None or areas[i]<1500:continue
  yy,xx=np.where(labels[b]==i);cx=xx.mean()+b[1].start;cy=yy.mean()+b[0].start;key=(min(rows-1,int(cy/(im.height/rows))),min(columns-1,int(cx/(im.width/columns))))
  if key not in chosen or areas[i]>chosen[key][0]:chosen[key]=(areas[i],i,b)
 assert len(chosen)==columns*rows,('Missing complete figure',len(chosen),columns*rows)
 out={}
 for key,(_,i,b) in chosen.items():
  # One pixel of anti-aliasing around the complete connected illustration.
  region=ndimage.binary_dilation(labels==i,iterations=1);mask=np.where(region,a,0).astype('uint8');mask[mask<8]=0;rgba=im.copy();rgba.putalpha(Image.fromarray(mask));bbox=rgba.getchannel('A').getbbox();out[key]=(rgba.crop(bbox),bbox)
 return out
extra=root/'core/art-source/crosses.png'
if not extra.exists():shutil.copy2('/workspace/generated_images/exec-73f69b08-499a-4806-938d-063d8db481cb.png',extra)
extraImage=Image.open(extra).convert('RGBA');extraFigures=figures(extraImage,6,3)
manifest={'format':'36 complete illustrated frames per fighter, connected-component sliced','cell':cell,'columns':6,'rows':6,'origin':'Original generated illustrations commissioned for BREAKLINE, 2026-11-13. No third-party game assets.','fighters':{}}
for fighter,name in inputs.items():
 src=root/'core/art-source'/f'{fighter}.png'
 if not src.exists():shutil.copy2(Path('/workspace/generated_images')/name,src)
 im=Image.open(src).convert('RGBA');base=figures(im,6,5);atlas=Image.new('RGBA',(cell*6,cell*6));frames=[];side=im.width/6
 for frame in range(36):
  c,r=frame%6,frame//6
  if frame<30:
   tile,b=base[(r,c)];x=round(paddingX+b[0]-c*side)
  else:
   er=['nova','brick','iris'].index(fighter);tile,b=extraFigures[(er,c)];ratio=side/(extraImage.width/6);tile=tile.resize((round(tile.width*ratio),round(tile.height*ratio)),Image.Resampling.LANCZOS);x=round(paddingX+(b[0]-c*extraImage.width/6)*ratio)
  y=anchor[1]-tile.height;assert x>=3 and y>=3 and x+tile.width<cell-3,(fighter,frame,x,y,tile.size)
  atlas.paste(tile,(c*cell+x,r*cell+y));frames.append({'index':frame,'bbox':[x,y,x+tile.width,y+tile.height]})
 atlas.save(root/'core/assets'/f'atlas-{fighter}.webp','WEBP',quality=91,method=6)
 guard,b=base[(0,0)];portrait=guard.crop((0,0,guard.width,round(guard.height*.68)));portrait.save(root/'core/assets'/f'portrait-{fighter}.webp','WEBP',quality=92,method=6)
 manifest['fighters'][fighter]={'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'atlas_sha256':hashlib.sha256((root/'core/assets'/f'atlas-{fighter}.webp').read_bytes()).hexdigest(),'anchor':anchor,'frames':frames}
stage=root/'core/art-source/stage.png'
if not stage.exists():shutil.copy2('/workspace/generated_images/exec-86c486fb-467a-4ed9-a1e4-9c4082122b07.png',stage)
Image.open(stage).convert('RGB').save(root/'core/assets/stage.webp','WEBP',quality=88,method=6)
(root/'core/assets/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print({p.name:p.stat().st_size for p in (root/'core/assets').glob('*.webp')})
