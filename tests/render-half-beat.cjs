/* Input-driven old/new comparison at the same mobile size and distance.
   No audio track; frame captions expose the original input and planned contact. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const dir=path.resolve(process.env.ARTIFACT_DIR||'test-artifacts');fs.mkdirSync(dir,{recursive:true});const frames=fs.mkdtempSync(path.join(dir,'.half-reel-'));
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('})();</script>','window.__test=code=>eval(code);})();</script>');
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(source)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:640}});await page.route('https://opengameart.org/**',r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port);await page.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});const run=c=>page.evaluate(c=>__test(c),c);
  const scenes=[['legacy','L',1],['half','L',1],['legacy','H',1],['half','H',1],['legacy','LHHL',1],['half','LHHL',1],['half','LHHL',.5],['half','LHL',1],['half','LHHH',1],['half','HLH',1],['half','HLL',1],['half','HHLL',1],['half','LLH',1]];
  let frame=0;const review=[];
  for(const [model,sequence,speed] of scenes){
   await run(`started=true;selectedFighter='kickboxer';selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;practiceMode=true;kickTimingMode='${model}';rhythmDifficulty='easy';fresh();sound=false;player.x=.46;enemy=makeFighter(true,.65,'boxer');enemy.nextThink=Infinity;window.reel={first:rhythmStart+BEAT_MS*${model==='half'?3.5:4},index:0,sequence:'${sequence}'};reel.begin=reel.first-BEAT_MS*.25;reel.at=reel.begin;paused=true;`);
   const duration=(sequence.length+1.25)*500,count=Math.ceil(duration/speed/1000*24),startFrame=frame;
   for(let i=0;i<count;i++){
    const value=await page.evaluate(({i,speed,model})=>__test(`(()=>{
     const end=reel.begin+${i}*1000/24*${speed};paused=false;
     while(reel.at<end){const input=reel.first+reel.index*BEAT_MS;let t=Math.min(end,reel.at+4);if(reel.index<reel.sequence.length&&input>reel.at)t=Math.min(t,input);now=t;
      if(reel.index<reel.sequence.length&&t>=input){const kind=reel.sequence[reel.index]==='L'?'light':'heavy';if(!startAction(player,kind,t,input,true))throw Error('Rejected comparison input '+reel.index);reel.index++;}
      update(t,t-reel.at);reel.at=t;
     }
     paused=true;now=end;render(now);ctx.textAlign='center';ctx.fillStyle='#f6dbaa';ctx.font='bold 18px system-ui';ctx.fillText('${model==='half'?'НОВАЯ · ½ ДОЛИ':'СТАРАЯ МОДЕЛЬ'} · ${speed}×',W/2,36);ctx.font='14px system-ui';ctx.fillText('120 BPM · '+comboText(reel.sequence),W/2,60);
     const phase=(now-rhythmStart)/BEAT_MS,active=player.action==='light'||player.action==='heavy'||halfBeatAttack(player,now);ctx.font='12px system-ui';ctx.fillStyle='#bbd9d0';ctx.fillText('Введено: '+comboText(reel.sequence.slice(0,reel.index))+' · '+(active?rigPose(player,now).animationPhase:'стойка'),W/2,85);
     const impact=player.hitAt,delta=active?Math.round(impact-now):0;ctx.fillText(active?(delta>0?'До контакта: '+delta+' мс':'После контакта: '+(-delta)+' мс'):'Серия завершена',W/2,108);
     const x=24,y=H-70,width=W-48;ctx.fillStyle='#203936';ctx.fillRect(x,y,width,18);for(let beat=0;beat<4;beat++){ctx.fillStyle='#b7ebc5';ctx.fillRect(x+beat/4*width,y,2,8);ctx.fillStyle='#ffc26e';ctx.fillRect(x+(beat+${model==='half'?'.5':'0'})/4*width,y+10,4,8);}ctx.fillStyle='#fff0bc';ctx.fillRect(x+((phase%4+4)%4)/4*width,y-3,3,24);ctx.fillStyle='#d1d8c6';ctx.fillText('ЗЕЛЁНЫЙ: ДОЛЯ · ОРАНЖЕВЫЙ: НАЖАТИЕ',W/2,y+40);
     return RIG_INTEGRITY.violations;
    })()`),{i,speed,model});
    if(value)throw Error('Anatomy violation in comparison');await page.screenshot({path:path.join(frames,String(frame++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:84});
   }
   review.push({model,sequence,speed,startSeconds:startFrame/24,endSeconds:frame/24});
  }
  const output=path.join(dir,'half-beat-comparison-silent.webm'),result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(frames,'%05d.jpg'),'-c:v','libvpx-vp9','-crf','30','-b:v','0','-pix_fmt','yuv420p',output],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'ffmpeg unavailable');fs.writeFileSync(path.join(dir,'half-beat-reel-scenes.json'),JSON.stringify(review,null,2));console.log('Saved',output,'('+frame+' frames, 24 FPS, no audio)');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(frames,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
