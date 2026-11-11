const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({page,run,artifactDir})=>{
 const report=await run(`(()=>{
  const failures=[],counts=[],check=(v,m)=>{if(!v)failures.push(m)};let minimumPeakDifference=Infinity;
  for(const id of Object.keys(RIGS))for(const kind of ['light','heavy']){
   const tracks=[];
   for(let index=0;index<15;index++){
    const f=makeFighter(false,.4,id);Object.assign(f,{action:kind,actionVariant:index,archivePreview:true,actionStart:1000,hitAt:1055,actionEnd:1380});
    const track=[];
    for(let ms=0;ms<=380;ms+=10){const s=buildFighterSkeleton(f,1000+ms);track.push(s.bones.map(b=>b.end));}
    tracks.push(track);
   }
   for(const [level,count] of ANIMATION_COUNTS.entries()){
    check(CHOREOGRAPHY[id][kind].slice(0,count).length===count,id+' count level '+level);
    for(let a=0;a<count;a++)for(let b=a+1;b<count;b++){
     let peak=0;for(let t=0;t<tracks[a].length;t++)for(let bone=0;bone<tracks[a][t].length;bone++)peak=Math.max(peak,Math.hypot(tracks[a][t][bone][0]-tracks[b][t][bone][0],tracks[a][t][bone][1]-tracks[b][t][bone][1]));
     minimumPeakDifference=Math.min(minimumPeakDifference,peak);check(peak>=10,id+'/'+kind+' visually duplicate '+a+'/'+b+' peak='+peak);
    }
    counts.push({id,kind,level:level+1,unique:count});
   }
  }
  return {failures,minimumPeakDifference,counts};
 })()`);
 assert.deepEqual(report.failures,[]);console.log('Distinct choreography:',{levels:report.counts.length,minimumPeakDifference:report.minimumPeakDifference});
 await run('practiceMode=true;practiceLevel=5;practiceVariant=-1;fresh()');
 for(const [level,count] of [[1,1],[2,3],[3,5],[4,9],[5,15]]){
  await page.locator('#pauseBtn').click();await page.locator('#practiceLabMode').selectOption('archive');if(level>=3)await page.locator('#practicePauseDifficulty [data-difficulty="hard"]').click();await page.locator('#practiceLevel').selectOption(String(level));
  assert.equal(await page.locator('#practiceVariant option').count(),count+1);
  await page.locator('#practiceVariant').selectOption(String(count-1));
  await page.locator('[data-preview="heavy"]').click();
  await page.waitForFunction(index=>__test('player.action')==='heavy'&&__test('player.actionVariant')===index,count-1,{timeout:6000});
  assert.equal(await run('rhythmLevel(player)'),level);assert.equal(await run('player.attackGrade'),'perfect');
 }
 await run("practiceLevel=5;practiceVariant=-1;practicePreview=null;practiceLabMode='combo';rhythmDifficulty='easy';fresh()");
 if(artifactDir){
  fs.writeFileSync(path.join(artifactDir,'choreography-counts.json'),JSON.stringify(report,null,2));
  const context=await page.context().browser().newContext();
  try{
   const gallery=await context.newPage();await gallery.setViewportSize({width:1000,height:750});
   for(const id of ['boxer','kickboxer','power','acrobat'])for(const kind of ['light','heavy']){
    const url=new URL(page.url());url.searchParams.set('rig','0');await gallery.goto(url.toString());await gallery.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
    await gallery.evaluate(({id,kind})=>__test(`(()=>{paused=true;ctx.fillStyle='#102132';ctx.fillRect(0,0,W,H);W=360;H=240;rhythmStart=500;BEAT_MS=500;const id='${id}',kind='${kind}';for(let i=0;i<15;i++){
     ctx.save();ctx.translate((i%5)*200,Math.floor(i/5)*250);ctx.fillStyle='#e7e1c3';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText((i+1)+' · '+CHOREOGRAPHY[id][kind][i].name,7,20,185);
     ctx.save();ctx.translate(0,35);for(const [x,t] of [[.11,1055],[.36,1285]]){const f=makeFighter(false,x,id);Object.assign(f,{action:kind,actionVariant:i,archivePreview:true,actionStart:1000,hitAt:1055,actionEnd:1380});fighter(f,t);}ctx.restore();
     ctx.fillStyle='#93b9ad';ctx.fillText('КОНТАКТ',10,220);ctx.fillText('ВОЗВРАТ',120,220);ctx.restore();
    }return RIG_INTEGRITY.violations;})()`),{id,kind}).then(n=>assert.equal(n,0));
    await gallery.screenshot({path:path.join(artifactDir,'variants-'+id+'-'+kind+'.png')});
   }
  }finally{await context.close()}
 }
};
