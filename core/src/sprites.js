/* Decoded illustrated atlases. Rendering selects whole drawings; never scales limbs. */
const CoreSprites=(()=>{
'use strict';
const assets=/* CORE_ASSET_DATA */{};
const decoded=new Map(),pending=new Map();
function loadOne(id){if(decoded.has(id))return Promise.resolve(decoded.get(id));if(pending.has(id))return pending.get(id);const p=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{pending.delete(id);decoded.set(id,im);resolve(im)};im.onerror=()=>{pending.delete(id);reject(Error('Не загрузилась иллюстрация '+id))};im.src=assets[id].url});pending.set(id,p);return p}
function load(id){return Promise.all([loadOne(id),...(assets[id+'Flow']?[loadOne(id+'Flow')]:[])]).then(x=>x[0])}
function draw(ctx,token,rootX,rootY,scale,facing,alpha=1){const id=token.frame>=36?token.fighter+'Flow':token.fighter,image=decoded.get(id);if(!image)return false;const f=assets[id],frame=token.frame%36,c=frame%6,r=Math.floor(frame/6),unit=.68,box=f.bounds[frame],bw=box[2]-box[0],bh=box[3]-box[1];ctx.save();ctx.globalAlpha*=alpha;ctx.translate(rootX+token.x*scale*facing,rootY+token.y*scale);ctx.scale(scale*facing,scale);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,c*f.cell+box[0],r*f.cell+box[1],bw,bh,(box[0]-f.anchor[0])*unit,(box[1]-f.anchor[1])*unit,bw*unit,bh*unit);ctx.restore();return true}
function retain(ids){const keep=new Set(['stage',...ids,...ids.map(id=>id+'Flow')]);for(const id of decoded.keys())if(!keep.has(id))decoded.delete(id)}
return {assets,load,draw,retain,diagnostics:()=>({resident:[...decoded.keys()],pending:pending.size}),ready:id=>decoded.has(id)&&(!assets[id+'Flow']||decoded.has(id+'Flow')),image:id=>decoded.get(id)};
})();
