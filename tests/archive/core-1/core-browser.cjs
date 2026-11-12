'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts/core');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'core/index.html'),'utf8').replace('// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.','window.__core=code=>eval(code);');
let checks=0;function ok(v,msg){checks++;assert.ok(v,msg)}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('http://localhost/**',route=>{requests.push(route.request().url());route.fulfill({contentType:'text/html; charset=utf-8',body:html})});
 const run=code=>page.evaluate(code=>window.__core(code),code);
 await page.goto('http://localhost/core/');await page.screenshot({path:out+'/start.png'});await page.locator('#start').tap();
 await page.waitForFunction(()=>window.__core('s.mode==="fight"&&now()>=s.start'),{},{timeout:8000});
 ok(await run('audio.ctx.state==="running"'),'audio unlocked by touch');await run('s.nextEnemy=1e9');
 async function tapBeat(selector,offset=0){let delta=await run('Math.ceil((now()+110)/500)*500-now()')+offset;await page.waitForTimeout(Math.max(0,delta-25));await page.locator(selector).tap();}
 for(const recipe of ['LLL','LLH','LHLH']){
  await run('game.reset(now());s.start=0;s.nextEnemy=1e9');
  for(const key of recipe)await tapBeat(key==='L'?'#hand':'#foot');
  await page.waitForTimeout(200);
  const result=await run('({combos:s.stats.combos,history:s.history.map(x=>({move:x.move,quality:x.quality})),fills:audio.fills.length,hp:s.enemy.hp})');
  ok(result.combos===1,recipe+' native touch combo: '+JSON.stringify(result));
 }
 await page.screenshot({path:out+'/fight.png'});
 await page.waitForTimeout(650);await run('game.energy(100,now())');await tapBeat('#special');await page.waitForTimeout(180);ok(await run('s.history.at(-1).move==="knee"&&s.enemy.hp<288'),'native special');
 await page.waitForTimeout(700);const client=await context.newCDPSession(page),box=await page.locator('#block').boundingBox();
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
 const hp=await run('s.player.hp');await run('game.enemyImpact({move:"jab"},now())');ok(await run('s.player.hp')===hp-3,'held native touch block');await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});ok(!await run('s.block'),'block touch release');
 await page.locator('#dodge').tap();const hp2=await run('s.player.hp');await page.waitForTimeout(70);await run('game.enemyImpact({move:"bodyKick"},now())');ok(await run('s.player.hp')===hp2,'native dodge');
 await page.locator('#pause').tap();const pausedAt=await run('audio.ctx.currentTime');await page.waitForTimeout(220);ok(await run('audio.ctx.currentTime')===pausedAt,'pause freezes shared audio clock');await page.locator('#resume').tap();await page.waitForTimeout(120);ok(await run('audio.ctx.currentTime')>pausedAt,'resume clock');
 await page.locator('#mute').tap();ok(await run('audio.muted'),'mute on');const cursor=await run('audio.events.at(-1).step');await page.waitForTimeout(300);ok(await run('audio.events.at(-1).step')>cursor,'muted transport continues');await page.locator('#mute').tap();
 await run('game.energy(100,now())');await page.waitForTimeout(950);ok(await run('audio.levelAt(audio.ctx.currentTime)===5&&audio.buses.every(b=>b.gain.value>.99)'),'five active layers');
 const origin=await run('audio.origin'),beforeStep=await run('audio.events.at(-1).step');// Dormant Web Audio buses can expose their last processed .value; a silent
 // probe keeps all five processing while their scheduled fades are measured.
 await run('(()=>{const probe=audio.ctx.createConstantSource();probe.offset.value=.000001;audio.buses.forEach(b=>probe.connect(b));probe.start();probe.stop(audio.ctx.currentTime+1.2)})();game.energy(-100,now())');await page.waitForTimeout(950);ok(await run('audio.levelAt(audio.ctx.currentTime)===1&&audio.buses.slice(1).every(b=>b.gain.value<.001)'),'layers fade out '+JSON.stringify(await run('({level:s.level,energy:s.energy,time:audio.ctx.currentTime,state:audio.ctx.state,plans:audio.plans,gains:audio.buses.map(b=>b.gain.value)})')));
 ok(await run('audio.origin')===origin&&await run('audio.events.at(-1).step')>beforeStep,'layer changes do not restart transport');
 ok(await run('audio.events.every(e=>Math.abs((e.at-audio.origin)/.125-e.step)<1e-6)&&audio.plans.every(p=>Math.abs((p.at-audio.origin)/.5-Math.round((p.at-audio.origin)/.5))<1e-6)'),'music events and layer changes on grid');
 const layouts=[];
 for(const [width,height]of [[320,568],[360,640],[390,844],[412,915],[740,360],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
   const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
   const buttons=[...document.querySelectorAll('.controls button')].map(r),recipes=r(document.querySelector('.recipes')),energy=r(document.querySelector('.energy'));
   return {buttons,recipes,energy,bodyWidth:document.body.scrollWidth,canvas:window.__core('({scale,ground,top:ground-151*scale,auditErrors,particles:s.particles.length,trails:s.trails.length})')};
  });
  ok(result.bodyWidth<=width,'no horizontal overflow');for(const b of result.buttons)ok(b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.right<=width+.5&&b.bottom<=height+.5,'touch target in '+width+'x'+height);
  ok(result.buttons.every(b=>b.y>=result.recipes.bottom+2),'recipes do not overlap controls');ok(result.canvas.top>=result.energy.bottom-4,'fighters clear HUD '+width+'x'+height+JSON.stringify(result));
  for(let i=0;i<result.buttons.length;i++)for(let j=i+1;j<result.buttons.length;j++){const a=result.buttons[i],b=result.buttons[j];ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'buttons do not overlap')}
  ok(!result.canvas.auditErrors,'live bone audits');ok(result.canvas.particles<=40&&result.canvas.trails<=14,'bounded FX');layouts.push({width,height,scale:result.canvas.scale});await page.screenshot({path:out+`/mobile-${width}x${height}.png`});
 }
 // Offline rendering exercises the same instruments and grid scheduler; no audio URL.
 const audioReport=await page.evaluate(async()=>{
  const sr=44100,duration=16,ctx=new OfflineAudioContext(2,sr*duration,sr),e=CoreAudio.create(ctx);
  for(const [t,l]of [[1.5,2],[3.5,3],[5.5,4],[7.5,5],[11.5,1]])e.setLevel(l,e.origin+t);
  e.requestFill(100,true,e.origin+10);const duplicate=e.requestFill(100,true,e.origin+12),bad=e.requestFill(101,false,e.origin+13);
  for(let t=0;t<duration;t+=.025)e.schedule(t);const buffer=await ctx.startRendering();let peak=0,sum=0;const samples=buffer.getChannelData(0),rms=[];
  for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));sum+=samples[i]*samples[i]}
  for(let second=0;second<duration;second++){let a=0;for(let i=second*sr;i<(second+1)*sr;i++)a+=samples[i]**2;rms.push(Math.sqrt(a/sr))}
  const bytes=new Uint8Array(44+samples.length*4),v=new DataView(bytes.buffer);const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sr,true);v.setUint32(28,sr*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes.length-44,true);
  for(let i=0;i<samples.length;i++)for(let c=0;c<2;c++)v.setInt16(44+i*4+c*2,Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(c)[i]))*32767),true);
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {peak,rms,totalRms:Math.sqrt(sum/samples.length),plans:e.plans,fills:e.fills.length,duplicate,bad,wav:btoa(binary)};
 });
 fs.writeFileSync(out+'/music-evolution.wav',Buffer.from(audioReport.wav,'base64'));delete audioReport.wav;
 ok(audioReport.peak<.98&&audioReport.peak>.03,'headroom and audible mix');ok(audioReport.totalRms>.01,'non-silent original track');ok(audioReport.fills===1&&!audioReport.duplicate&&!audioReport.bad,'fill gating and deduplication');
 ok(errors.length===0,'no browser errors: '+errors.join(';'));ok(requests.length===1,'standalone, no external assets');
 const report={checks,errors,layouts,audio:audioReport,androidHardwareTested:false,transport:'real Chromium AudioContext, native touch, OfflineAudioContext render'};
 fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
