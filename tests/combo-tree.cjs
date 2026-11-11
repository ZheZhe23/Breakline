/* Recognizer, animation graph and frame-by-frame continuity on the shipping
   combat path. Archive variants remain covered separately. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({page,run,artifactDir})=>{
 const report=await run(`(()=>{
  const failures=[],stats={recipes:0,prefixes:0,sharedComparisons:0,frames:0,transitions:0,invalidEdges:0,stableSingles:0,brokenInputs:0,timeouts:0,maxJointStep:0},check=(ok,message)=>{if(!ok&&failures.length<20)failures.push(message)};
  sound=false;practiceMode=false;rhythmDifficulty='easy';
  function frameStep(a,b,label){for(const [name,l] of Object.entries(b.limbs)){const old=a.limbs[name],step=Math.max(Math.abs(l.root-old.root),Math.abs(l.flex-old.flex));stats.maxJointStep=Math.max(stats.maxJointStep,step);check(step<.85,label+' frame angle jump '+name+' '+step);}}
  function setup(id,bpm){selectedFighter=id;RHYTHM_BPM=bpm;BEAT_MS=60000/bpm;fresh();enemy.nextThink=Infinity;player.x=.38;enemy.x=.51;enemy.guard=false;return rhythmStart+4*BEAT_MS;}
  for(const [id,tree] of Object.entries(COMBO_TREES)){
   const seen=new Map();
   for(const [seq] of FIGHTERS[id].combos){
    let prefix='';
    for(const key of seq){prefix=comboNext(prefix,key,tree);const node=tree.nodes[prefix];check(!!node,id+'/'+seq+' reachable');
     if(seen.has(prefix)){check(seen.get(prefix)===node.motion,id+'/'+prefix+' is the SAME shared motion');stats.sharedComparisons++;}else seen.set(prefix,node.motion);
    }
    check(tree.nodes[prefix].recipe[0]===seq,id+'/'+seq+' terminal');check(comboNext(prefix,'L',tree)===''&&comboNext(prefix,'H',tree)==='',id+'/'+seq+' terminal cannot keep recognizing a suffix');
   }
   for(const node of Object.values(tree.nodes))if(node.prefix){
    check(Object.isFrozen(node)&&Object.isFrozen(node.motion),id+'/'+node.prefix+' immutable graph');
    if(node.prefix.length>1)check(node.motion.entry===tree.nodes[node.prefix.slice(0,-1)].motion.exit,id+'/'+node.prefix+' inherits outgoing weight/guard');
    for(const key of ['L','H'])if(!node.children[key]){check(comboNext(node.prefix,key,tree)==='',id+'/'+node.prefix+key+' rejects suffix');stats.invalidEdges++;}
    stats.prefixes++;
   }
  }
  for(const bpm of [100,120,140])for(const id of Object.keys(FIGHTERS)){
   // Energy and RNG must not choose another standalone animation, player OR AI.
   for(const ai of [false,true])for(const kind of ['light','heavy'])for(const rhythm of [0,20,40,60,80,100]){
    const f=makeFighter(ai,.4,id);Object.assign(f,{rhythm,action:kind,actionVariant:14});chooseAnimation(f,kind);const clip=choreographyClip(f);
    check(f.actionVariant===0&&!f.archivePreview,id+' stable single '+kind+' energy '+rhythm);check(clip.move===RIGS[id][kind][0],id+' base single technique');stats.stableSingles++;
   }
   const prefixSnapshots=new Map();
   for(const [seq] of FIGHTERS[id].combos){
    const start=setup(id,bpm);let previous=null;
    for(let index=0;index<seq.length;index++){
     const at=start+index*BEAT_MS;
     for(let t=previous?.at+4||at-4;t<at;t+=4){update(t,4);const s=displayFighterSkeleton(player,t);check(measureFighterSkeleton(s).valid,id+'/'+seq+' bridge anatomy');if(previous&&t-previous.at<=4.01)frameStep(previous.s,s,id+'/'+seq+' bridge');previous={s,at:t};stats.frames++;}
     update(at,4);enemy.x=player.x+.13;enemy.guard=false;
     const before=displayFighterSkeleton(player,at),oldTimes=[player.hitAt,player.cooldown,player.recoveryUntil];
     check(startAction(player,seq[index]==='L'?'light':'heavy',at),id+'/'+seq+' input '+index+' @'+bpm);
     const clip=choreographyClip(player),prefix=seq.slice(0,index+1);
     check(player.comboSeq===prefix,id+'/'+seq+' exact prefix '+prefix);check(clip===COMBO_TREES[id].nodes[prefix].motion,id+'/'+prefix+' uses trie motion');
     const first=displayFighterSkeleton(player,at);
     for(let bone=0;bone<first.bones.length;bone++)check(Math.hypot(first.bones[bone].end[0]-before.bones[bone].end[0],first.bones[bone].end[1]-before.bones[bone].end[1])<1e-5,id+'/'+prefix+' C0 transition');
     const signature=JSON.stringify([player.finisher,clip,buildFighterSkeleton(player,player.hitAt).bones]);
     if(prefixSnapshots.has(prefix)){check(signature===prefixSnapshots.get(prefix),id+'/'+prefix+' identical before future branch');stats.sharedComparisons++;}else prefixSnapshots.set(prefix,signature);
     let prior=first,maxStep=0,worst='';
     for(let t=at+4;t<=player.hitAt;t+=4){const s=displayFighterSkeleton(player,t);check(measureFighterSkeleton(s).valid,id+'/'+prefix+' attack anatomy');for(const [name,limb] of Object.entries(s.limbs)){const old=prior.limbs[name];const step=Math.max(Math.abs(limb.root-old.root),Math.abs(limb.flex-old.flex));if(step>maxStep){maxStep=step;worst=name+' at '+(t-at)+'ms ('+old.root+'/'+limb.root+', '+old.flex+'/'+limb.flex+')';}}frameStep(prior,s,id+'/'+prefix+' windup');prior=s;stats.frames++;}
     check(maxStep<.85,id+'/'+prefix+' no IK branch jump '+maxStep+' '+worst);
     const hit=displayFighterSkeleton(player,player.hitAt),raw=buildFighterSkeleton(player,player.hitAt);
     check(JSON.stringify(hit.bones)===JSON.stringify(raw.bones),id+'/'+prefix+' reaches contact on existing hitAt');
     update(player.hitAt+1,4);previous={s:hit,at:player.hitAt+1};stats.transitions++;
     if(!player.finisher){
      const end=buildFighterSkeleton(player,player.actionEnd),saved={...player,action:'idle',guard:true},idle=buildFighterSkeleton(saved,player.actionEnd+.01);
      check(comboPoseHeld(saved,player.actionEnd+.01),id+'/'+prefix+' holds link after actionEnd');
      for(let i=0;i<end.bones.length;i++)check(Math.hypot(end.bones[i].end[0]-idle.bones[i].end[0],end.bones[i].end[1]-idle.bones[i].end[1])<.05,id+'/'+prefix+' no neutral between clips');
     }
    }
    check(player.finisher&&player.finisherStyle===FIGHTERS[id].combos.findIndex(v=>v[0]===seq),id+'/'+seq+' own finisher');
    const ready=player.powerReadyAt;check(!startAction(player,'light',ready-BEAT_MS),id+'/'+seq+' recovery beat protected');update(ready,16);enemy.x=player.x+.13;check(startAction(player,'light',ready),id+'/'+seq+' ready on third beat');check(player.comboSeq==='L'&&!player.finisher,id+'/'+seq+' new series only after recovery');stats.recipes++;
   }
   // Deadline and erroneous edges use the same real action pipeline, not only
   // the pure graph. Every broken input is an ordinary attack for this press.
   for(const node of Object.values(COMBO_TREES[id].nodes)){
    const invalid=['L','H'].find(k=>!node.children[k]);if(!node.prefix||node.recipe||!invalid)continue;
    const start=setup(id,bpm);
    for(let i=0;i<node.prefix.length;i++){const at=start+i*BEAT_MS;update(at,16);enemy.x=player.x+.13;enemy.guard=false;startAction(player,node.prefix[i]==='L'?'light':'heavy',at);update(player.hitAt+1,16);}
    const at=start+node.prefix.length*BEAT_MS;update(at,16);check(startAction(player,invalid==='L'?'light':'heavy',at),id+' bad edge executes');
    check(!player.comboSeq&&!player.comboMotionPrefix&&!player.finisher&&!player.powerFinisher,id+'/'+node.prefix+invalid+' becomes standalone, no false finisher');check(choreographyClip(player).move===RIGS[id][invalid==='L'?'light':'heavy'][0],id+' invalid edge base motion');
    update(player.hitAt+1,16);const next=at+BEAT_MS;update(next,16);check(startAction(player,'light',next),id+' next input accepted');check(player.comboSeq==='L',id+' next action starts from root');stats.brokenInputs++;
   }
   const at=setup(id,bpm);startAction(player,'light',at);update(player.hitAt+1,16);update(at+comboWindowMs()+1,16);check(!player.comboSeq,id+' expired prefix cleared');stats.timeouts++;
  }
  // Invalid presses do not receive the early-cancel privilege of a valid edge.
  for(const bpm of [100,120,140]){
   const start=setup('kickboxer',bpm);
   for(let i=0;i<3;i++){const at=start+i*BEAT_MS;update(at,16);enemy.x=player.x+.13;enemy.guard=false;startAction(player,i?'heavy':'light',at);if(i<2)update(player.hitAt+1,16);}
   const last=start+2*BEAT_MS,end=player.actionEnd,input=last+30;
   check(!startAction(player,'heavy',input),'invalid early input is buffered @'+bpm);update(player.hitAt+1,16);update(last+BEAT_MS*.16,16);
   check(player.comboSeq==='LHH'&&player.actionStart===last,'invalid edge cannot cancel current action @'+bpm);
   update(end+1,16);check(!player.comboSeq&&!player.finisher&&player.actionStart===end+1,'queued invalid input executes standalone after recovery @'+bpm);check(player.attackGrade==='perfect','buffer retains original rhythm timestamp @'+bpm);
  }
  // Preserve the pre-existing post-contact cancel into grab; restricting bad
  // L/H edges must not accidentally remove this separate control path.
  for(const bpm of [100,120,140]){
   const at=setup('kickboxer',bpm);startAction(player,'light',at);update(player.hitAt+1,4);enemy.x=player.x+.08;
   check(startAction(player,'grab',at+BEAT_MS*.16),'existing grab cancel preserved @'+bpm);check(player.action==='grab'&&!player.comboSeq,'grab retires combo recognition @'+bpm);
  }
  // A linking guard must never replace actual locomotion or another action.
  for(const id of Object.keys(FIGHTERS)){
   const f=makeFighter(false,.4,id);Object.assign(f,{action:'idle',comboSeq:'L',comboMotionPrefix:'L',comboPoseUntil:2000});
   check(comboPoseHeld(f,1400),id+' idle holds linking pose');f.stepUntil=1500;check(!comboPoseHeld(f,1400)&&!rigPose(f,1400).attack,id+' walking step releases held pose');f.stepUntil=0;f.moveHeld=1;check(!comboPoseHeld(f,1400),id+' continuous movement releases held pose');f.moveHeld=0;
   for(const action of ['caught','throwing','down','stunned','celebrate','defeated']){f.action=action;check(!comboPoseHeld(f,1400)&&choreographyClip(f,1400).id==='stance',id+' held pose cannot replace '+action);}
  }
  // The explicit example from the specification: branch only on the third key.
  const tree=COMBO_TREES.kickboxer;check(tree.nodes.LH.children.L.recipe[0]==='LHL'&&!tree.nodes.LH.children.H.recipe&&tree.nodes.LHH.children.L.recipe[0]==='LHHL','LH branches to terminal L or preparing H');
  practiceMode=true;selectedFighter='kickboxer';RHYTHM_BPM=120;BEAT_MS=500;fresh();return {failures,stats};
 })()`);
 assert.deepEqual(report.failures,[]);console.log('Combo trie:',report.stats);
 if(artifactDir){fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,'combo-tree.json'),JSON.stringify(report,null,2));}
 if(artifactDir){
  const context=await page.context().browser().newContext();
  try{
   const gallery=await context.newPage();await gallery.setViewportSize({width:1200,height:620});await gallery.goto(page.url());await gallery.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
   for(const id of ['boxer','kickboxer','power','acrobat']){
    const count=await gallery.evaluate(id=>__test(`FIGHTERS['${id}'].combos.length`),id);
    for(let recipe=0;recipe<count;recipe++){
     const violations=await gallery.evaluate(({id,recipe})=>__test(`(()=>{paused=true;ctx.fillStyle='#102132';ctx.fillRect(0,0,1200,620);W=400;H=240;rhythmStart=500;BEAT_MS=500;const id='${id}',seq=FIGHTERS[id].combos[${recipe}][0];for(let i=0;i<seq.length;i++){
      const prefix=seq.slice(0,i+1),node=COMBO_TREES[id].nodes[prefix];ctx.save();ctx.translate(i*200,0);ctx.fillStyle='#e4d7b1';ctx.font='13px system-ui';ctx.textAlign='left';ctx.fillText(comboText(prefix)+' · '+node.motion.name,7,25,188);
      for(const [row,t] of [[0,1055],[1,1380]]){ctx.save();ctx.translate(0,45+row*280);const f=makeFighter(false,.12,id);Object.assign(f,{action:seq[i]==='L'?'light':'heavy',actionStart:1000,hitAt:1055,actionEnd:1380,comboSeq:prefix,comboMotionPrefix:prefix,comboPoseUntil:1625,finisher:!!node.recipe,powerFinisher:!!node.recipe,finisherStyle:node.finisherIndex??-1});fighter(f,t);ctx.fillStyle='#95c6b4';ctx.font='12px system-ui';ctx.fillText(row?'ВЫХОД / СВЯЗКА':'КОНТАКТ',7,217);ctx.restore();}ctx.restore();
     }return RIG_INTEGRITY.violations;})()`),{id,recipe});
     assert.equal(violations,0);await gallery.screenshot({path:path.join(artifactDir,'combo-'+id+'-'+recipe+'.png')});
    }
   }
  }finally{await context.close()}
 }

 // Real laboratory UI: complete every fighter's repertoire via normal startAction,
 // with no mutation of cooldown/stun/clock by the preview controller.
 for(const id of ['boxer','kickboxer','power','acrobat']){
  const count=await run(`selectedFighter='${id}';practiceMode=true;rhythmDifficulty='easy';practiceLabMode='combo';fresh();FIGHTERS['${id}'].combos.length`);
  for(let recipe=0;recipe<count;recipe++){
   await page.locator('#pauseBtn').click();await page.locator('#practiceLabMode').selectOption('combo');await page.locator('#practiceCombo').selectOption(String(recipe));await page.locator('#comboPreview').click();
   await page.waitForFunction(()=>!__test('practicePreview')&&__test('player.finisher'),null,{timeout:7000}).catch(async e=>{throw Error(e.message+' '+JSON.stringify(await run('({id:player.fighterId,seq:player.comboSeq,preview:practicePreview,status:$("practicePreviewStatus").textContent,model:kickTimingMode})')))});
   assert.equal(await run('player.finisherStyle'),recipe);assert.equal(await run('player.attackGrade'),'perfect');
  }
 }
 // Step-by-step UI follows LH -> LHH, then the deliberately wrong H.
 await run("practiceLabMode='combo';selectedFighter='kickboxer';practiceCombo=4;practiceMode=true;rhythmDifficulty='easy';fresh()");
 for(const prefix of ['L','LH','LHH']){
  await page.locator('#pauseBtn').click();await page.locator('#comboStepPreview').click();
  await page.waitForFunction(prefix=>!__test('practicePreview')&&__test('player.comboSeq')===prefix&&__test('player.hitDone'),prefix,{timeout:3000});
 }
 await page.locator('#pauseBtn').click();assert.equal(await page.locator('#comboBreakPreview').isEnabled(),true);await page.locator('#comboBreakPreview').click();
 await page.waitForFunction(()=>!__test('practicePreview')&&__test('player.hitDone'),null,{timeout:3000});
 assert.equal(await run('player.comboSeq'),'');assert.equal(await run('player.finisher'),false);assert.equal(await run('player.actionVariant'),0);
 // Manual input cancels an active demonstration; a hidden controller must not
 // continue attacking after the player takes control.
 await run("practicePreview={mode:'combo',sequence:'LHHL',index:0,at:gameClock()+1000,reset:true};startAction(player,'light',gameClock());");
 assert.equal(await run('practicePreview'),null);
 await run("practiceLabMode='combo';selectedFighter='kickboxer';practiceCombo=0;fresh()");
};
