/* Experimental kickboxer contract: real input -> planned impact, independent
   rendering, quarter-note judgement on every difficulty and legacy isolation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({page,run,artifactDir})=>{
 const report=await run(`(()=>{
  sound=false;const failures=[],stats={judgements:0,combos:0,specials:0,frames:0,transitions:0,buffers:0,maxLengthError:0,maxJointStep:0,worstStep:null},check=(ok,m)=>{if(!ok&&failures.length<25)failures.push(m)},near=(a,b)=>Math.abs(a-b)<1e-6;
  function setup(bpm=120,difficulty='easy',id='kickboxer'){
   selectedFighter=id;selectedTrack=({100:'terrace',120:'neon',140:'orbit'})[bpm];RHYTHM_BPM=bpm;BEAT_MS=60000/bpm;rhythmDifficulty=difficulty;practiceMode=true;kickTimingMode='half';pendingKickTimingMode=null;fresh();enemy.nextThink=Infinity;player.x=.4;enemy.x=.54;return rhythmStart+7.5*BEAT_MS;
  }
  function visible(f,t){const frozen=photoStop?.frames.get(f);return frozen&&t<photoStop.until?fighter(f,t,frozen):displayFighterSkeleton(f,t);}
  function audit(s,previous,label,t){
   const a=measureFighterSkeleton(s);check(a.valid,label+' fixed bones / joint bounds');stats.maxLengthError=Math.max(stats.maxLengthError,a.maxRelativeError);stats.frames++;
   if(s.pose.p.support[0]>0&&!s.pose.transition&&s.pose.lift===0){const foot=s.limbs.leftLeg.end,goal=s.pose.p.lf;check(Math.hypot(foot[0]-goal[0],foot[1]-goal[1])<4.5,label+' planted support foot');}
   if(previous)for(const [name,l] of Object.entries(s.limbs)){
    const old=previous.limbs[name],step=Math.max(Math.abs(l.root-old.root),Math.abs(l.flex-old.flex));
    if(step>stats.maxJointStep){stats.maxJointStep=step;stats.worstStep={label,t,name,phase:s.pose.animationPhase};}
    check(step<.26,label+' abrupt joint '+name+' '+step+' at '+t+' '+s.pose.animationPhase);
   }
  }
  for(const bpm of [100,120,140])for(const difficulty of ['easy','medium','hard']){
   for(const [offset,expected] of [[0,'perfect'],[difficulty==='easy'?60000/bpm*.20:difficulty==='medium'?65:60,'good'],[60000/bpm*.4,'off']]){
    const at=setup(bpm,difficulty)+offset,beforeHp=enemy.hp;check(startAction(player,'light',at),bpm+'/'+difficulty+' accepts input');
    check(player.attackGrade===expected,'judge '+bpm+'/'+difficulty+'/'+offset+' expected '+expected+' got '+player.attackGrade);stats.judgements++;
    const clock=player.attackTiming,deadline=at+BEAT_MS*.5;
    check(near(clock.inputAt,at)&&near(clock.animationStart,at)&&near(clock.plannedImpactAt,deadline),'independent time fields');
    check(near(player.hitAt,deadline),'half beat travel, no beat snapping');
    strike(player,enemy,deadline-.01);check(!player.hitDone&&enemy.hp===beforeHp,'no contact before scheduled impact');
    update(deadline,1);const score=player.score,hp=enemy.hp,streak=player.hitStreak;
    check(player.hitDone&&near(player.resolvedImpactAt,deadline),'one scheduled contact');check((score>0)===(expected!=='off'),'score follows planned contact accuracy');
    strike(player,enemy,deadline+1);check(player.score===score&&enemy.hp===hp&&player.hitStreak===streak,'direct repeated resolution is idempotent');
    check(Object.isFrozen(clock),'clock is immutable');
   }
   const at=setup(bpm,difficulty);check(strikeJudge(player,at+BEAT_MS*.5)==='off','press on accent is OFF in new model');check(strikeJudge(player,at+BEAT_MS*.25)!=='perfect','dense subdivision is never a false PERFECT');
   const signatures=new Map();
   for(const [recipe] of FIGHTERS.kickboxer.combos){
    const first=setup(bpm,difficulty);let previous=null,lastAt=first-4;
    for(let i=0;i<recipe.length;i++){
     const input=first+i*BEAT_MS;
     for(let t=lastAt+4;t<input;t+=4){enemy.x=player.x+.14;update(t,4);const s=visible(player,t);audit(s,previous,recipe+' bridge @'+bpm,t);previous=s;lastAt=t;}
     enemy.x=player.x+.14;update(input,4);const before=visible(player,input);
     check(startAction(player,recipe[i]==='L'?'light':'heavy',input),recipe+' accepted step '+i+' @'+bpm+'/'+difficulty);
     const start=visible(player,input);for(let bone=0;bone<start.bones.length;bone++)check(Math.hypot(start.bones[bone].end[0]-before.bones[bone].end[0],start.bones[bone].end[1]-before.bones[bone].end[1])<1e-5,recipe+' C0 on input');stats.transitions++;
     const prefix=recipe.slice(0,i+1);check(player.comboSeq===prefix,recipe+' recognized prefix '+prefix);check(near(player.hitAt,input+BEAT_MS*.5),recipe+' contact deadline');
     const signature=JSON.stringify([choreographyClip(player).id,...[.2,.5,.7,.95].map(phase=>buildFighterSkeleton(player,input+phase*BEAT_MS).bones.map(b=>b.end.map(x=>Math.round(x*1e6)/1e6)))]);
     if(signatures.has(prefix))check(signatures.get(prefix)===signature,'shared prefix trajectory '+prefix+' @'+bpm);else signatures.set(prefix,signature);
     const frozenTimes=JSON.stringify(player.attackTiming);previous=start;
     for(let t=input+4;t<input+BEAT_MS*.99;t+=4){enemy.x=player.x+.14;update(t,4);const s=visible(player,t);audit(s,previous,recipe+'/'+prefix+' @'+bpm,t);previous=s;lastAt=t;}
     check(JSON.stringify(player.attackTiming)===frozenTimes,'animation did not mutate gameplay clock');
    }
    check(player.finisher,recipe+' terminal');const ready=player.recoveryEnd;
    check(!startAction(player,'light',ready-BEAT_MS*.5),recipe+' no recovery bypass');enemy.x=player.x+.14;update(ready,4);check(startAction(player,'light',ready),recipe+' next input ready');check(player.attackGrade==='perfect'&&near(player.hitAt,ready+BEAT_MS*.5),'next strike contacts third impact beat');stats.combos++;
   }
  }
  // Full, uninterrupted recovery and meaningful post-contact continuation of
  // every kickboxer technique used by the shared-prefix tree and specials.
  const nodes=Object.values(COMBO_TREES.kickboxer.nodes).filter(n=>n.prefix);
  for(const bpm of [100,120,140])for(const node of nodes){
   const at=setup(bpm),kind=node.prefix.at(-1)==='L'?'light':'heavy';startAction(player,kind,at);
   Object.assign(player,{comboSeq:node.prefix,comboMotionPrefix:node.prefix,finisher:!!node.recipe,powerFinisher:!!node.recipe,finisherStyle:node.finisherIndex??-1});planHalfBeatAttack(player,at,at);
   const before=JSON.stringify(player.attackTiming),hit=buildFighterSkeleton(player,player.hitAt);
   check(hit.pose.animationPhase==='contact',node.prefix+' correct contact phase');
   const shortly=buildFighterSkeleton(player,player.hitAt+BEAT_MS*.07);check(shortly.pose.animationPhase==='followThrough',node.prefix+' does not instantly retract');
   const limb=hit.pose.m.leg?'rightLeg':['cross','backfist'].includes(hit.pose.move)?'leftArm':'rightArm';
   check(Math.hypot(hit.limbs[limb].end[0]-shortly.limbs[limb].end[0],hit.limbs[limb].end[1]-shortly.limbs[limb].end[1])<14,node.prefix+' controlled follow-through');
   let previous=null;
   for(let t=at;t<Math.max(player.attackTiming.animationEnd,player.recoveryEnd)+160;t+=4){if(t>=player.actionEnd)player.action='idle';const s=displayFighterSkeleton(player,t);audit(s,previous,'full '+node.prefix+' @'+bpm,t);previous=s;}
   check(before===JSON.stringify(player.attackTiming),'visual recovery has no clock side effects');
  }
  for(const bpm of [100,120,140]){
   const at=setup(bpm);startAction(player,'light',at);enemy.x=player.x+.14;update(player.hitAt,4);const ready=player.recoveryEnd;enemy.x=player.x+.14;update(ready,4);
   check(player.action==='idle'&&halfBeatAttack(player,ready),'game ready while visual tail continues @'+bpm);check(player.guard,'ordinary guard returns at gameplay recovery @'+bpm);
   check(beginJump(player,ready),'jump is not delayed by visual tail @'+bpm);check(!halfBeatAttack(player,ready),'takeoff interrupts only visual tail @'+bpm);
  }
  for(const bpm of [100,120,140]){
   const at=setup(bpm);startAction(player,'light',at);enemy.x=player.x+.14;update(player.hitAt,4);
   const queued=at+BEAT_MS*.92;check(!startAction(player,'heavy',queued),'early attack queues');check(player.pendingAttacks.length===1,'queue retained');
   const ready=at+BEAT_MS*.95;enemy.x=player.x+.14;update(ready,4);
   check(player.comboSeq==='LH'&&near(player.inputAt,queued)&&near(player.animationStart,ready)&&near(player.plannedImpactAt,queued+BEAT_MS*.5),'buffer keeps ORIGINAL impact deadline');check(player.attackGrade==='perfect','buffer grade from original input');stats.buffers++;
   const stale=setup(bpm);startAction(player,'light',stale);startAction(player,'heavy',stale+BEAT_MS*.2);enemy.x=player.x+.14;update(stale+BEAT_MS*.96,4);check(player.pendingAttacks.length===0&&near(player.actionStart,stale),'stale input cannot become compressed windup');
   const wrong=setup(bpm);for(let i=0;i<4;i++){const t=wrong+i*BEAT_MS;enemy.x=player.x+.14;update(t,4);startAction(player,i?'heavy':'light',t);enemy.x=player.x+.14;update(player.hitAt,4);}check(!player.comboSeq&&!player.finisher&&player.actionVariant===0,'LHHH breaks into stable standalone');
   // Throw and other fighters still use their original timing and judging.
   const grab=setup(bpm);startAction(player,'grab',grab+BEAT_MS*.5);check(player.attackTiming===null&&near(player.hitAt-(grab+BEAT_MS*.5),BEAT_MS*.09*rhythmSpeed(player,grab+BEAT_MS*.5)),'throw unchanged');
   for(const id of ['boxer','power','acrobat']){const first=setup(bpm,'easy',id),onBeat=first+BEAT_MS*.5;startAction(player,'light',onBeat);check(player.attackTiming===null&&player.attackGrade==='perfect'&&player.hitAt-onBeat<BEAT_MS*.12,'legacy fighter unchanged '+id);}
   for(const id of Object.keys(SPECIALS))for(const outcome of ['hit','block','miss','parry','off']){
    const first=setup(bpm),spec=SPECIALS[id];motionHistory=spec.motion.map((dir,i)=>({dir,t:first-BEAT_MS*.16*(spec.motion.length-i)}));
    check(trySpecial(spec.kind,first),'special available '+id);check(near(player.hitAt,first+BEAT_MS*.5),'special half-beat contact '+id);const hit=player.hitAt;
    enemy.x=outcome==='miss'?.9:player.x+.12;enemy.guard=outcome==='block'||outcome==='parry';enemy.guardAt=outcome==='parry'?hit-BEAT_MS*.2:hit-BEAT_MS*2;if(outcome==='off')player.attackGrade='off';
    strike(player,enemy,hit);check(!!photoStop===(outcome==='hit'),'photo gating '+id+'/'+outcome);if(photoStop){check(photoStop.frames.get(player).skeleton.pose.animationPhase==='contact','photo freezes scheduled contact');check(audio.state==='running','photo never stops music');}stats.specials++;
   }
  }
  for(const bpm of [100,120,140])for(const difficulty of ['easy','medium','hard']){
   const at=setup(bpm,difficulty);player.crouch=true;player.stanceRequest=true;check(startAction(player,'light',at),'low opener available');enemy.x=player.x+.14;update(player.hitAt,4);
   const second=at+BEAT_MS;enemy.x=player.x+.14;update(second,4);check(startAction(player,'heavy',second)&&player.lowSweep,'low follow remains available '+bpm+'/'+difficulty);check(near(player.recoveryEnd,second+2*BEAT_MS),'sweep retains long recovery');enemy.x=player.x+.14;update(player.hitAt,4);check(enemy.action==='down','low sweep keeps knockdown outcome');
  }
  for(const bpm of [100,120,140]){
   const at=setup(bpm);startAction(player,'light',at);enemy.x=player.x+.14;update(player.hitAt,4);const ready=player.recoveryEnd;
   motionHistory=SPECIALS.upper.motion.map((dir,i)=>({dir,t:ready-BEAT_MS*.16*(2-i)}));check(trySpecial('light',ready)&&player.specialId==='upper','special readiness independent of next RAF @'+bpm);
   const jump=setup(bpm);startAction(player,'light',jump);enemy.x=player.x+.14;update(player.hitAt,4);check(beginJump(player,player.recoveryEnd),'jump readiness independent of next RAF @'+bpm);
  }
  for(const bpm of [100,120,140]){
   const at=setup(bpm);startAction(player,'light',at);const planned=player.plannedImpactAt,late=at+BEAT_MS*1.2;enemy.x=player.x+.14;update(late,BEAT_MS*1.2);
   check(player.hitDone&&player.score>0&&near(player.resolvedImpactAt,late)&&near(player.plannedImpactAt,planned),'late RAF resolves once without moving planned impact @'+bpm);const score=player.score;update(late+10,10);check(player.score===score,'late frame cannot repeat impact @'+bpm);
  }
  const duel=setup(120);practiceMode=false;startAction(player,'light',duel+BEAT_MS*.5);check(player.attackTiming===null&&player.attackGrade==='perfect'&&player.hitAt-(duel+BEAT_MS*.5)<BEAT_MS*.12,'normal duel remains legacy even with experiment selected');
  kickTimingMode='legacy';pendingKickTimingMode=null;selectedFighter='kickboxer';selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;practiceMode=true;rhythmDifficulty='easy';fresh();return {failures,stats};
 })()`);
 assert.deepEqual(report.failures,[]);console.log('Half-beat kickboxer:',report.stats);
 if(artifactDir){fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,'half-beat.json'),JSON.stringify(report,null,2));}
 if(artifactDir){
  const context=await page.context().browser().newContext();
  try{
   const gallery=await context.newPage();await gallery.setViewportSize({width:1536,height:960});await gallery.goto(page.url());await gallery.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
   const violations=await gallery.evaluate(()=>__test(`(()=>{paused=true;practiceMode=true;rhythmStart=500;BEAT_MS=500;ctx.fillStyle='#102132';ctx.fillRect(0,0,1536,960);W=600;H=240;const rows=[['legacy','light'],['half','light'],['legacy','heavy'],['half','heavy']],times=[0,.15,.32,.50,.62,.82,1.03,1.35];
    rows.forEach(([model,kind],row)=>times.forEach((beat,col)=>{ctx.save();ctx.translate(col*192,row*240);ctx.beginPath();ctx.rect(0,0,192,240);ctx.clip();kickTimingMode=model;
     const f=makeFighter(false,.12,'kickboxer');Object.assign(f,{action:kind,actionStart:1000,hitAt:1000+(kind==='light'?42.5:55),actionEnd:1000+(kind==='light'?345:380),comboSeq:kind==='light'?'L':'H',comboMotionPrefix:kind==='light'?'L':'H',comboPoseUntil:1625});if(model==='half')planHalfBeatAttack(f,1000,1000);
     const t=1000+beat*BEAT_MS;if(t>f.actionEnd)f.action='idle';fighter(f,t);ctx.fillStyle='#ead8aa';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText((model==='half'?'НОВАЯ':'СТАРАЯ')+' · '+(kind==='light'?'РУКА':'НОГА')+' · '+beat+' beat',7,19);ctx.fillStyle='#9fc9be';ctx.fillText(rigPose(f,t).animationPhase,7,224);ctx.restore();
    }));return RIG_INTEGRITY.violations;})()`));assert.equal(violations,0);await gallery.screenshot({path:path.join(artifactDir,'half-beat-intermediate-frames.png')});
  }finally{await context.close()}
 }

 // First launch through the shared experimental URL must show the correct
 // lane immediately, before bar 1 and without relying on a previous player.
 const touch=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{
  const mobile=await touch.newPage(),errors=[];mobile.on('pageerror',e=>errors.push(e.message));await mobile.route('https://opengameart.org/**',r=>r.abort());
  const url=new URL(page.url());url.searchParams.set('timing','half');
  for(const [width,height] of [[360,640],[390,844],[412,915],[844,390],[667,375],[320,568]]){
   await mobile.setViewportSize({width,height});await mobile.goto(url.toString());assert.equal(await mobile.locator('#modePractice').getAttribute('class'),'difficultyBtn selected');await mobile.locator('#start').tap();
   assert.equal(await mobile.locator('.inputSlot').count(),4,'first-bar half-beat cues');assert.equal(await mobile.locator('.rhythmSlot').count(),4);
   const hud=await mobile.locator('#rhythmHud').boundingBox(),label=await mobile.locator('#rhythmPatternLabel').boundingBox();assert.ok(label.y+label.height<=hud.y+hud.height+.5,'new legend fits rhythm panel '+width+'x'+height+' '+JSON.stringify({hud,label}));
   if(artifactDir)await mobile.screenshot({path:path.join(artifactDir,'half-hud-'+width+'x'+height+'.png')});
  }
  await mobile.goto(url.toString());await mobile.locator('[data-fighter="boxer"]').first().tap();await mobile.locator('#start').tap();assert.equal(await mobile.locator('.inputSlot').count(),0,'other fighters keep original lane');assert.deepEqual(errors,[]);
 }finally{await touch.close()}
 // Public controls switch safely without resetting transport or swallowing an
 // unfinished windup. Actual WebAudio runs across pause and model changes.
 await page.locator('#pauseBtn').click();const origin=await run('({...transport})');await page.locator('#kickTiming').selectOption('half');assert.equal(await run('kickTimingMode'),'half');
 const frozen=await run('gameClock()');await page.waitForTimeout(130);assert.equal(await run('gameClock()'),frozen);await page.locator('#pauseResume').click();await page.waitForFunction(()=>document.querySelectorAll('.inputSlot').length===4);
 assert.deepEqual(await run('({...transport})'),origin);assert.equal(await page.locator('.inputSlot').count(),4);assert.equal(await run('audio.state'),'running');
 for(const track of ['neon','terrace','orbit']){
  await run(`selectedTrack='${track}';RHYTHM_BPM=TRACKS[selectedTrack].bpm;BEAT_MS=60000/RHYTHM_BPM;kickTimingMode='half';rhythmDifficulty='hard';fresh()`);
  for(const recipe of [1,4]){
   await page.locator('#pauseBtn').click();await page.locator('#practiceCombo').selectOption(String(recipe));await page.locator('#comboPreview').click();
   await page.waitForFunction(()=>!__test('practicePreview')&&__test('player.finisher'),null,{timeout:6500}).catch(async e=>{throw Error(e.message+' '+JSON.stringify(await run('({track:selectedTrack,preview:practicePreview,status:$("practicePreviewStatus").textContent,seq:player.comboSeq,action:player.action})')))});assert.equal(await run('player.attackGrade'),'perfect');assert.equal(await run('player.finisherStyle'),recipe);
  }
 }
 // Mid-action request is deferred; the original immutable contract survives.
 await run("selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;rhythmDifficulty='easy';kickTimingMode='half';fresh();launchPracticePreview({mode:'step',sequence:'L',index:0,reset:true})");
 await page.waitForFunction(()=>__test('player.action')==='light'&&!__test('player.hitDone'));
 const pendingOrigin=await run('({...transport})');await page.locator('#pauseBtn').click();const timing=await run('({...player.attackTiming})');await page.locator('#kickTiming').selectOption('legacy');assert.equal(await run('pendingKickTimingMode'),'legacy');assert.deepEqual(await run('({...player.attackTiming})'),timing);
 await page.locator('#pauseResume').click();await page.waitForFunction(()=>__test('kickTimingMode')==='legacy',null,{timeout:4000});assert.deepEqual(await run('({...transport})'),pendingOrigin);
 await run("kickTimingMode='legacy';pendingKickTimingMode=null;practiceMode=true;selectedFighter='kickboxer';selectedTrack='neon';RHYTHM_BPM=120;BEAT_MS=500;rhythmDifficulty='easy';fresh()");
};
