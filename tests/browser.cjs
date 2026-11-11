/* Chromium regression checks. The HTTP fixture injects private inspection hooks;
   the shipped game never exposes these hooks. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
new(require('node:vm').Script)(source.match(/<script>([\s\S]*)<\/script>/)[1]);
const hook=`const scheduled=[];const originalBeat=playRhythmBeat;playRhythmBeat=(i,at)=>{scheduled.push({i,at,actual:audio.currentTime});if(scheduled.length>100)scheduled.shift();return originalBeat(i,at)};window.__test=code=>eval(code);`;
const html=source.replace('})();</script>',hook+'})();</script>');
const errors=[];let checks=0;
(async()=>{
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  await page.route('https://opengameart.org/**',r=>r.abort());
  page.on('pageerror',e=>errors.push(e.message));
  const run=code=>page.evaluate(code=>window.__test(code),code);
  for(const [track,bpm] of [['neon',120],['terrace',100],['orbit',140]]){
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.locator(`[data-track="${track}"]`).click();
   await page.locator('#modePractice').click();await page.locator('#start').click();
   await page.waitForTimeout(700);
   const state=await run(`({bpm:RHYTHM_BPM,beat:BEAT_MS,audio:audio.state,drift:Math.abs(gameClock()-(transport.gameOrigin+(audio.currentTime-transport.audioOrigin)*1000)),scheduled:scheduled.slice(),level:player.rhythm})`);
   assert.equal(state.bpm,bpm);assert.equal(state.audio,'running');assert.ok(state.drift<2);assert.equal(state.level,100);
   assert.ok(state.scheduled.length>=2);assert.ok(state.scheduled.every(n=>n.at>=n.actual&&n.at-n.actual<=.16));
   const delta=state.scheduled[1].at-state.scheduled[0].at;assert.ok(Math.abs(delta-60/bpm)<.003);checks+=6;
   await page.locator('#pauseBtn').click();const frozen=await run('gameClock()');await page.waitForTimeout(150);assert.equal(await run('gameClock()'),frozen);
   await page.locator('#pauseResume').click();await page.waitForTimeout(180);assert.ok((await run('gameClock()'))>frozen+90);checks+=2;
   const before=await run('nextMusicIndex');await page.locator('#soundBtn').click();await page.waitForTimeout(750);
   assert.ok((await run('nextMusicIndex'))>before);assert.equal(await run('audio.state'),'running');checks+=2;
  }
  assert.deepEqual(errors,[]);console.log(`PASS: syntax and ${checks} transport/music checks; no browser exceptions.`);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
