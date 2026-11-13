'use strict';
// Real-time native touch bouts. Test hooks only READ state; every action is a UI tap.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=root+'/test-artifacts/roster';fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(root+'/core/index.html','utf8').replace('// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.','window.__core=code=>eval(code);');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});const reports=[];
 try{for(const fighter of ['nova','brick','iris']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:390,height:844}}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('http://localhost');
  const run=code=>page.evaluate(code=>window.__core(code),code);
  await page.locator(`[data-fighter="${fighter}"]`).tap();await page.locator('[data-difficulty="master"]').tap();await page.locator('#start').tap();await page.waitForFunction(()=>window.__core('s.mode==="fight"&&now()>=s.start'),{},{timeout:10000});
  let beat=await run('Math.ceil((now()+150)/500)*500'),cycle=0,nativeTaps=0;
  for(let i=0;i<100;i++,beat+=500){
   const readDelay=await run(`${beat}-now()-180`);if(readDelay>0)await page.waitForTimeout(readDelay);
   const state=await run(`({now:now(),mode:s.mode,ready:s.player.ready,stun:s.player.stun,series:s.series?.prefix??'',recipes:Object.keys(game.book().recipes),charge:s.super,clean:s.series?.clean??true,variety:s.stats.variety,guard:game.getGuard(${beat}),counter:s.counterUntil>${beat},incoming:s.incoming?{at:s.incoming.beatAt,cancelled:s.incoming.cancelled,resolved:s.incoming.resolved}:null,armour:!!(s.player.action?.super&&!s.player.action.resolved),last:s.history.at(-1)?.id??-1})`);
   if(state.mode!=='fight')break;if(state.now>beat+40)continue;
   let selector=null;
   if(state.incoming?.at===beat&&!state.incoming.cancelled&&!state.incoming.resolved&&!state.armour)selector='#defend';
   else if(beat>=state.ready&&beat>=state.stun){const target=state.recipes.find(r=>!state.variety.includes(r))??state.recipes[cycle%3],key=state.charge>=100&&!state.series&&state.variety.length===3?'S':target.startsWith(state.series)?target[state.series.length]:target[0],finish=state.series.length+1===target.length;selector=!state.clean||state.series&&!target.startsWith(state.series)?'#defend':state.guard===key&&!finish&&!state.counter?null:key==='S'?'#special':key==='L'?'#hand':'#foot'}
   const delay=await run(`${beat}-now()`);await page.waitForTimeout(Math.max(0,delay-20));
   if(selector){await page.locator(selector).tap();nativeTaps++;const action=await run('({id:s.history.at(-1)?.id??-1,finish:!!s.player.action?.finish})');if(selector!=='#defend'&&action.id>state.last&&action.finish)cycle++}
   else await page.waitForTimeout(45);
  }
  await page.waitForFunction(()=>window.__core('s.mode==="result"'),{},{timeout:10000});
  const report=await run('({fighter:s.fighterId,opponent:s.enemy.fighter,winner:s.winner,stats:s.stats,rating:s.rating,lateThreats:s.stats.lateThreats})');report.nativeTaps=nativeTaps;report.errors=errors;
  await page.screenshot({path:out+'/live-'+fighter+'-result.png'});const video=page.video();await context.close();const original=await video.path();await video.saveAs(out+'/live-'+fighter+'.webm');if(original!==out+'/live-'+fighter+'.webm')fs.unlinkSync(original);
  reports.push(report);fs.writeFileSync(out+'/live-bouts.json',JSON.stringify({coreSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/core/index.html')).digest('hex'),kind:'real-time native touch policy against active AI; silent Chromium video; not a human or Android recording',reports},null,2));
  assert.equal(report.winner,'player','native reader wins '+fighter);assert.equal(report.stats.variety.length,3,'three distinct finishes in native bout '+fighter);assert.ok(report.stats.supers>=1,'super confirmed in native bout '+fighter);assert.ok(report.stats.dodges>=1,'native defence '+fighter);assert.equal(errors.length,0,errors.join('\n'));console.log(fighter+': native touch win, all 3 finishers, '+report.stats.supers+' supers, '+report.stats.dodges+' dodges.');
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
