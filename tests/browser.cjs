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
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
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
   await run('window.testAnalyser=audio.createAnalyser();musicBus.connect(window.testAnalyser)');
   await page.waitForTimeout(150);
   const rms=await page.evaluate(()=>{const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length)});
   assert.ok(rms>1e-5,'music graph generates an audio signal');checks++;
   const before=await run('nextMusicIndex');await page.locator('#soundBtn').click();await page.waitForTimeout(750);
   assert.ok((await run('nextMusicIndex'))>before);assert.equal(await run('audio.state'),'running');checks+=2;
  }

  // Exercise the real combo/action/update functions at exact transport beats.
  // Simulation stays inside one JS task, so RAF cannot race the state fixture.
  const combat=await run(`(()=>{
   sound=false;const failures=[],stats={combos:0,specials:0,poses:0};
   const check=(ok,label)=>{if(!ok)failures.push(label)};
   function setup(id='kickboxer',bpm=120){selectedFighter=id;RHYTHM_BPM=bpm;BEAT_MS=60000/bpm;practiceMode=false;fresh();enemy.nextThink=Infinity;player.x=.38;enemy.x=.51;enemy.guard=false;}
   for(const bpm of [100,120,140])for(const id of Object.keys(FIGHTERS))for(const [recipe,,type] of FIGHTERS[id].combos){
    setup(id,bpm);const start=rhythmStart+BEAT_MS*4;
    for(let i=0;i<recipe.length;i++){
     const at=start+i*BEAT_MS;update(at-1,16);enemy.x=player.x+.13;enemy.guard=false;
     check(startAction(player,recipe[i]==='L'?'light':'heavy',at),id+' '+recipe+' input '+i+' @'+bpm);
     update(player.hitAt+1,16);
    }
    const last=start+(recipe.length-1)*BEAT_MS;
    check(player.finisher,id+' '+recipe+' finisher @'+bpm);
    check(Math.abs(player.powerReadyAt-(last+2*BEAT_MS))<.01,'third-beat recovery '+id+' '+recipe);
    check(!startAction(player,'light',last+BEAT_MS),'recovery beat rejects input');
    const ready=player.powerReadyAt;update(ready,16);check(startAction(player,'light',ready),'third beat accepts input '+id+' '+recipe);
    stats.combos++;
   }
   for(const bpm of [100,120,140])for(const id of Object.keys(SPECIALS))for(const outcome of ['hit','block','miss','parry','off']){
    setup('kickboxer',bpm);const spec=SPECIALS[id],at=rhythmStart+BEAT_MS*4;
    practiceMode=true;player.rhythm=100;motionHistory=spec.motion.map((dir,i)=>({dir,t:at-BEAT_MS*.16*(spec.motion.length-i)}));
    check(trySpecial(spec.kind,at),'special command '+id);check(player.specialId===id,'special identity '+id);
    const hit=player.hitAt;enemy.x=outcome==='miss'?.88:player.x+.12;
    enemy.guard=outcome==='block'||outcome==='parry';enemy.guardAt=outcome==='parry'?hit-BEAT_MS*.2:hit-BEAT_MS*2;
    if(outcome==='off')player.attackGrade='off';
    const hp=enemy.hp;strike(player,enemy,hit);
    check(!!photoStop===(outcome==='hit'),'photo only on hit '+id+' '+outcome+' @'+bpm);
    if(outcome==='hit')check(enemy.hp<hp,'special damage '+id);
    check(audio.state==='running','photo never suspends audio');stats.specials++;
   }
   setup();const at=rhythmStart+BEAT_MS*4;
   startAction(player,'light',at+BEAT_MS*.48);const hp=enemy.hp;strike(player,enemy,player.hitAt);
   check(enemy.hp===hp&&player.score===0,'offbeat cannot damage or score');
   // Buffered input retains original rhythm timestamp and combo continuation.
   setup();startAction(player,'light',rhythmStart+BEAT_MS*4);
   const buffered=rhythmStart+BEAT_MS*4+30;startAction(player,'heavy',buffered);
   check(player.pendingAttacks.length===1,'early input is queued');update(player.hitAt+1,16);update(rhythmStart+BEAT_MS*4+BEAT_MS*.12,16);
   check(player.lastComboInputAt===buffered&&player.comboSeq==='LH','queued input preserves combo/time');
   // Collision separation, aerial crossing, jump, crouch, throw and parry.
   setup();player.x=.5;enemy.x=.52;update(rhythmStart+BEAT_MS*4,16);check(Math.abs(enemy.x-player.x)>=.0719,'standing bodies separate');
   setup();player.jumpStart=rhythmStart;player.jumpUntil=rhythmStart+920;player.x=.5;enemy.x=.52;update(rhythmStart+400,16);check(Math.abs(enemy.x-player.x)<.072,'airborne fighters can cross');
   setup();const jumpAt=rhythmStart+BEAT_MS*4;check(beginJump(player,jumpAt),'jump starts');update(player.jumpPendingAt+1,16);check(player.jumpUntil>jumpAt,'takeoff resolves');
   setup();player.stanceRequest=true;update(rhythmStart+1000,16);update(player.stanceUntil+1,16);check(player.crouch,'crouch resolves');
   setup();const grabAt=rhythmStart+BEAT_MS*4;enemy.x=player.x+.08;startAction(player,'grab',grabAt);strike(player,enemy,player.hitAt);check(!!clinch,'throw connects');if(clinch){clinch.aiCounterAt=Infinity;updateClinch(clinch.slamBeat+1);check(enemy.action==='down','throw knocks down')}
   // Every recipe uses a distinct final move within its fighter's repertoire.
   for(const [id,rig] of Object.entries(RIGS))check(new Set(rig.finals).size===FIGHTERS[id].combos.length,'distinct finishers '+id);
   // Anatomical invariants across all moves and states, including inverted poses.
   for(const id of Object.keys(RIGS))for(const level of [1,2,3,4,5])for(const kind of ['idle','light','heavy','down','grab','celebrate','defeated']){
    const f=makeFighter(false,.4,id);f.rhythm=(level-1)*20;f.action=kind;f.actionStart=1000;f.hitAt=1055;f.actionEnd=1800;f.actionVariant=level*3-3;f.downStart=1000;f.downUntil=2400;
    for(const t of [1000,1020,1055,1120,1320,1799]){
     const {p}=rigPose(f,t);for(const v of Object.values(p))check(v.every(Number.isFinite),'finite pose '+id+' '+kind);
     const r=RIGS[id],limb=solveLimb(p.rs,p.rh,r.arm,r.forearm,[40,-90]);
     check(Math.abs(Math.hypot(limb.joint[0]-p.rs[0],limb.joint[1]-p.rs[1])-r.arm)<.001,'upper arm length');
     check(Math.abs(Math.hypot(limb.end[0]-limb.joint[0],limb.end[1]-limb.joint[1])-r.forearm)<.001,'forearm length');
     fighter(f,t);stats.poses++;
    }
   }
   practiceMode=true;fresh();return {failures,stats};
  })()`);
  assert.deepEqual(combat.failures,[]);console.log('Combat/rig coverage:',combat.stats);

  const duels=await run(`(()=>{
   sound=false;const results=[];
   for(const track of Object.keys(TRACKS)){
    selectedTrack=track;RHYTHM_BPM=TRACKS[track].bpm;BEAT_MS=60000/RHYTHM_BPM;selectedFighter='kickboxer';practiceMode=false;fresh();
    let nextInput=rhythmStart,i=0;
    for(let elapsed=0;elapsed<=roundDuration+1000&&!ended;elapsed+=16){
     const t=rhythmStart+elapsed;now=t;player.moveHeld=Math.abs(enemy.x-player.x)>.17?player.facing:0;
     if(t>=nextInput){startAction(player,i++%3===2?'heavy':'light',t);nextInput+=BEAT_MS;}
     update(t,16);if(elapsed%160===0)render(t);
     if(![player.hp,enemy.hp,player.x,enemy.x].every(Number.isFinite))throw Error('nonfinite duel state');
     if(player.x<.099||player.x>.901||enemy.x<.099||enemy.x>.901)throw Error('fighter escaped arena');
    }
    if(!ended||!finale)throw Error('duel failed to end '+track);
    if(!enemy.aiAttacks)throw Error('AI never attacked '+track);
    updateFinale(finale.start+2100);if(!finale.shown)throw Error('result overlay missing');
    results.push({track,aiAttacks:enemy.aiAttacks,playerScore:player.score,enemyScore:enemy.score});
   }
   practiceMode=true;fresh();now=rhythmStart+90000;update(now,16);if(ended||player.rhythm!==100)throw Error('practice must stay infinite');
   selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;fresh();return results;
  })()`);
  console.log('Simulated full duels:',duels);

  // Native pointer/touch input and rectangle checks at narrow mobile sizes.
  const layouts=[[360,640],[390,844],[412,915],[844,390],[667,375],[320,568]];
  const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1;
  for(const [width,height] of layouts){
   await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.locator('#start').scrollIntoViewIfNeeded();assert.ok(await page.locator('#start').isVisible());
   await page.locator('#modePractice').click();await page.locator('#start').click();await page.waitForTimeout(250);
   if(process.env.ARTIFACT_DIR){fs.mkdirSync(process.env.ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ARTIFACT_DIR,`game-${width}x${height}.png`)})}
   const ids=['joystick','attack','heavy','grab','soundBtn','pauseBtn','rhythmHud','distance','streakScore'];
   const boxes={};for(const id of ids){boxes[id]=await page.locator('#'+id).boundingBox();assert.ok(boxes[id].x>=0&&boxes[id].x+boxes[id].width<=width+.5,id+' fits width '+width);assert.ok(boxes[id].y>=0&&boxes[id].y+boxes[id].height<=height+.5,id+' fits height '+height)}
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)assert.ok(!overlap(boxes[ids[i]],boxes[ids[j]]),`${ids[i]} overlaps ${ids[j]} at ${width}x${height}`);
   const innerIds=['beatLabel','rhythmGrade','flowLabel','beatTrack','rhythmPatternLabel'];
   for(const id of innerIds){const b=await page.locator('#'+id).boundingBox();assert.ok(b.y+b.height<=boxes.rhythmHud.y+boxes.rhythmHud.height+.5,id+' stays inside rhythm panel '+width);assert.ok(!overlap(b,boxes.streakScore),id+' avoids streak '+width)}
   const meters=await page.locator('.meter').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
   for(const b of meters)assert.ok(!overlap(b,boxes.distance),'health label avoids distance '+width);
   const bars=await page.locator('#hud .bar').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert.ok(Math.abs(bars[0]-bars[1])<1,'health bars align');
   await page.locator('#pauseBtn').click();await page.locator('#pauseMoves').click();assert.ok((await page.locator('#movesBook').innerText()).includes('СПЕЦПРИЁМЫ'));await page.locator('#pauseBack').click();await page.locator('#pauseResume').click();checks++;
  }
  // Real pointer events (including cancellation) on the mobile joystick.
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3});
  const tp=await touch.newPage();tp.on('pageerror',e=>errors.push(e.message));await tp.route('https://opengameart.org/**',r=>r.abort());
  await tp.goto(`http://127.0.0.1:${server.address().port}/`);await tp.locator('#modePractice').tap();await tp.locator('#start').tap();await tp.waitForTimeout(250);
  assert.equal(await tp.evaluate(()=>document.querySelector('canvas').width),780,'DPR capped at two');checks++;
  const joy=await tp.locator('#joystick').boundingBox();const session=await touch.newCDPSession(tp);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x+joy.width*.8,y:joy.y+joy.height*.5}]});
  await tp.waitForTimeout(300);assert.equal(await tp.evaluate(()=>__test('player.moveHeld')),1);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await tp.evaluate(()=>__test('player.moveHeld')),0);checks+=2;
  await touch.close();
  // Desktop Chromium renderer timing only; this is not an Android benchmark.
  const renderTiming=await run(`(()=>{const samples=[];for(let i=0;i<120;i++){const begin=performance.now();render(gameClock()+i*16);samples.push(performance.now()-begin)}samples.sort((a,b)=>a-b);return {meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[114],dpr}})()`);
  console.log('Desktop Chromium render CPU timing:',renderTiming);

  assert.deepEqual(errors,[]);console.log(`PASS: syntax and ${checks} transport/music/layout/touch checks; no browser exceptions.`);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
