/* Reproducible silent visual review, at normal speed and explicitly labelled
   slow motion. Uses the shipping display animator; combat tests are separate. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const dir=path.resolve(process.env.ARTIFACT_DIR||'test-artifacts');fs.mkdirSync(dir,{recursive:true});
 const frames=fs.mkdtempSync(path.join(dir,'.reel-'));
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('})();</script>','window.__test=code=>eval(code);})();</script>');
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(source)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:800,height:500}});await page.goto('http://127.0.0.1:'+server.address().port);await page.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
  let frame=0;
  for(const id of ['boxer','kickboxer','power','acrobat'])for(const speed of [1,.35]){
   await page.evaluate(id=>__test(`paused=true;rhythmStart=500;BEAT_MS=500;window.actor=makeFighter(false,.5,'${id}');actor.action='light';actor.actionStart=1000;actor.hitAt=1043;actor.actionEnd=1380;actor.actionVariant=6;window.changed=false;`),id);
   const length=speed===1?30:60;
   for(let i=0;i<length;i++){
    const t=1000+i*1000/30*speed;
    const violations=await page.evaluate(({t,speed})=>__test(`(()=>{now=${t};const f=window.actor;if(now>=1250&&!window.changed){Object.assign(f,{action:'heavy',actionStart:1250,hitAt:1305,actionEnd:1660,actionVariant:6});window.changed=true;}if(now>1660)f.action='idle';bg();const skeleton=fighter(f,now);ctx.fillStyle='#f0e9cd';ctx.font='bold 21px system-ui';ctx.textAlign='center';ctx.fillText(FIGHTERS[f.fighterId].name,W/2,34);ctx.font='13px system-ui';ctx.fillText('${speed===1?'1×':'0.35×'} · '+skeleton.pose.animationPhase,W/2,59);return RIG_INTEGRITY.violations;})()`),{t,speed});
    if(violations)throw Error('Skeleton violation while recording');
    await page.screenshot({path:path.join(frames,String(frame++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:82});
   }
  }
  const output=path.join(dir,'biomechanics-silent.webm');
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','30','-i',path.join(frames,'%05d.jpg'),'-c:v','libvpx-vp9','-crf','32','-b:v','0','-pix_fmt','yuv420p',output],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'ffmpeg unavailable');console.log('Saved',output,'('+frame+' frames, 30 FPS; no audio track)');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(frames,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
