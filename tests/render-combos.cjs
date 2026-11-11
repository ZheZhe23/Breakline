/* Reproducible input-driven combo reel. Actors are brought back into range at
   each input for a fixed-distance fixture; this is not a collision benchmark. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const dir=path.resolve(process.env.ARTIFACT_DIR||'test-artifacts');fs.mkdirSync(dir,{recursive:true});const frames=fs.mkdtempSync(path.join(dir,'.combo-reel-'));
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('})();</script>','window.__test=code=>eval(code);})();</script>');
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(source)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:800,height:500}});await page.route('https://opengameart.org/**',r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port);await page.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
  const run=code=>page.evaluate(code=>__test(code),code);await run('started=true;sound=false;paused=true');let frame=0;
  const scenes=[['boxer','LLL'],['kickboxer','LHL'],['kickboxer','LHHL'],['kickboxer','LHHH'],['power','HLLH'],['acrobat','LHHLL'],['acrobat','HLHHLH']];
  for(const [id,sequence] of scenes)for(const speed of [1,.5]){
   await run(`selectedFighter='${id}';practiceMode=false;rhythmDifficulty='easy';selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;fresh();sound=false;enemy.nextThink=Infinity;player.x=.37;enemy.x=.50;window.reel={start:rhythmStart+BEAT_MS*4,at:rhythmStart+BEAT_MS*4-4,index:0,sequence:'${sequence}'};paused=true;`);
   const duration=sequence.length*500+500,n=Math.ceil(duration/speed/1000*24);
   for(let i=0;i<n;i++){
    const result=await page.evaluate(({i,speed})=>__test(`(()=>{
     const end=reel.start+${i}*1000/24*${speed};paused=false;
     while(reel.at<end){const nextInput=reel.start+reel.index*BEAT_MS;let at=Math.min(end,reel.at+4);if(reel.index<reel.sequence.length&&nextInput>reel.at)at=Math.min(at,nextInput);now=at;
      if(reel.index<reel.sequence.length&&at>=nextInput){enemy.x=player.x+.13;enemy.guard=false;const key=reel.sequence[reel.index];if(!startAction(player,key==='L'?'light':'heavy',at,nextInput,true))throw Error('Input rejected in visual reel');reel.index++;}
      update(at,at-reel.at);reel.at=at;
     }
     paused=true;now=end;render(now);ctx.fillStyle='#ffe7ac';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(FIGHTERS[player.fighterId].name+' · '+comboText(reel.sequence)+' · ${speed}×',W/2,32);ctx.font='13px system-ui';ctx.fillText('Введено: '+comboText(reel.sequence.slice(0,reel.index))+' · '+(player.finisher?player.finisherName:player.comboSeq?choreographyClip(player).name:'базовый удар / выход'),W/2,54);return RIG_INTEGRITY.violations;
    })()`),{i,speed});
    if(result)throw Error('Skeleton violation during combo reel');await page.screenshot({path:path.join(frames,String(frame++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:82});
   }
  }
  const output=path.join(dir,'combo-prefixes-silent.webm'),result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(frames,'%05d.jpg'),'-c:v','libvpx-vp9','-crf','32','-b:v','0','-pix_fmt','yuv420p',output],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'ffmpeg unavailable');console.log('Saved',output,'('+frame+' frames, 24 FPS, 1×/0.5×; no audio track)');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(frames,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
