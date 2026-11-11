/* Exhaustive pose sampling and measurement of actual Canvas bone strokes.
   No production debug API: browser.cjs injects a private closure hook. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
module.exports=async function checkKinematics({page,run,artifactDir}){
 const dense=await run(`(()=>{
  const originalBpm=RHYTHM_BPM,originalBeat=BEAT_MS,originalStart=rhythmStart;
  const result={poses:0,segments:0,maxRelativeLengthError:0,maxFrameLengthChange:0,maxJointStepRadians:0,worstJointStep:null,scenarios:0,failures:[],negativeControls:0,maxByBone:{}};
  const addFailure=text=>{if(result.failures.length<12)result.failures.push(text)};
  const scenario=(id,name,fields,duration)=>({id,name,fields,duration});
  const makeCases=()=>{
   const cases=[];
   for(const id of Object.keys(RIGS)){
    for(const kind of ['light','heavy'])for(let variant=0;variant<15;variant++){
     const hit=BEAT_MS*(kind==='light'?.085:.11);
     cases.push(scenario(id,kind+'/'+variant,{action:kind,actionVariant:variant,hitAt:1000+hit,actionEnd:1000+BEAT_MS*.9},BEAT_MS*.9));
    }
    for(let i=0;i<RIGS[id].finals.length;i++)cases.push(scenario(id,'finisher/'+i,{action:'heavy',finisher:true,powerFinisher:true,finisherStyle:i,hitAt:1000+BEAT_MS*.11,actionEnd:1000+BEAT_MS*1.65},BEAT_MS*1.65));
    const states={idle:{},walk:{moveHeld:1},retreat:{moveHeld:-1},block:{guard:true},crouch:{crouch:true},crouchBlock:{crouch:true,guard:true},
     crouchTransition:{stanceTransition:'crouch',stanceUntil:1100},rise:{stanceTransition:'rise',stanceUntil:1100},takeoff:{stanceTransition:'takeoff',stanceUntil:1085},
     jump:{jumpStart:1000,jumpUntil:1920},dive:{action:'dive',diveArmed:true,jumpStart:1000,jumpUntil:1920},land:{action:'dive',actionStart:840,actionEnd:1320},
     turn:{turnFrom:1,facing:-1,turnAt:1000},hit:{action:'stunned',hitReactStart:1000,hitReactUntil:1450,hitReactPower:1.4},lowHit:{hitReactStart:1000,hitReactUntil:1450,hitReactPower:1.2,hitReactLow:true},
     grab:{action:'grab'},caught:{action:'caught'},throw:{action:'throwing'},down:{action:'down',downStart:1000,downUntil:2400},celebrate:{action:'celebrate'},defeated:{action:'defeated'}};
    for(const [name,fields] of Object.entries(states))cases.push(scenario(id,name,fields,name==='down'?1500:1000));
    cases.push(scenario(id,'low-heavy',{action:'heavy',attackLow:true,crouch:true,hitAt:1060,actionEnd:1900},1000));
    cases.push(scenario(id,'low-hand',{action:'light',attackLow:true,crouch:true,hitAt:1045,actionEnd:1500},700));
    cases.push(scenario(id,'air-hand',{action:'light',jumpStart:900,jumpUntil:1820,hitAt:1045,actionEnd:1600},950));
    cases.push(scenario(id,'hit-during-attack',{action:'heavy',actionVariant:13,hitAt:1055,actionEnd:1900,hitReactStart:1020,hitReactUntil:1400,hitReactPower:1.4},1000));
    // Real boundary between the final animation frame and idle.
    cases.push(scenario(id,'attack-to-idle',{action:'heavy',actionVariant:12,hitAt:1055,actionEnd:1450},700));
    cases.push(scenario(id,'block-to-attack',{action:'light',actionVariant:2,hitAt:1043,actionEnd:1400},650));
   }
   for(const [id,spec] of Object.entries(SPECIALS))cases.push(scenario('kickboxer','special/'+id,{action:spec.kind,specialId:id,hitAt:1000+BEAT_MS*(id==='spin'?.56:id==='knee'?.34:.18),actionEnd:1000+BEAT_MS*1.6},BEAT_MS*1.6));
   return cases;
  };
  try{
   for(const bpm of [100,120,140]){
    RHYTHM_BPM=bpm;BEAT_MS=60000/bpm;rhythmStart=500;
    for(const c of makeCases())for(const facing of [1,-1]){
     const f=makeFighter(false,.4,c.id);Object.assign(f,{actionStart:1000,actionEnd:2000,hitAt:1055,rhythm:80,facing,turnFrom:facing},c.fields);
     const times=new Set([1000,1000+c.duration,f.hitAt-.01,f.hitAt,f.hitAt+.01,f.actionEnd-.01,f.actionEnd,f.actionEnd+.01]);
     for(let ms=0;ms<=c.duration;ms+=4)times.add(1000+ms); // 250 Hz, finer than game render cadence.
     for(const hz of [30,60,120])for(let frame=0;frame/hz*1000<=c.duration;frame++)times.add(1000+frame/hz*1000);
     const timingBefore=JSON.stringify([f.hitAt,f.actionEnd,f.cooldown,f.recoveryUntil,f.attackRange]);
     let previous=null;
     for(const t of [...times].sort((a,b)=>a-b)){
      f.travel=(t-1000)*.0002;f.jumpHeight=f.jumpUntil>t?Math.sin(Math.PI*clamp((t-f.jumpStart)/(f.jumpUntil-f.jumpStart),0,1))*72:0;
      if(c.name==='attack-to-idle'&&t>f.actionEnd)f.action='idle';
      if(c.name==='block-to-attack'&&t<1010){f.action='idle';f.guard=true}else if(c.name==='block-to-attack'){f.action=t>f.actionEnd?'idle':'light';f.guard=false}
      const skeleton=buildFighterSkeleton(f,t),audit=measureFighterSkeleton(skeleton);
      if(!audit.valid)addFailure(c.id+'/'+c.name+' @'+bpm+' t='+t+': '+audit.violations.join(','));
      for(const sample of audit.samples){const key=c.id+'.'+sample.name;result.maxByBone[key]=Math.max(result.maxByBone[key]||0,sample.relativeError);}
      result.poses++;result.segments+=audit.samples.length;result.maxRelativeLengthError=Math.max(result.maxRelativeLengthError,audit.maxRelativeError);
      if(previous){
       for(let j=0;j<8;j++)result.maxFrameLengthChange=Math.max(result.maxFrameLengthChange,Math.abs(audit.samples[j].actual/previous.audit.samples[j].actual-1));
       if(t-previous.t<=4.01&&f.action===previous.action){
        for(const key of Object.keys(skeleton.limbs)){
         const a=skeleton.limbs[key],b=previous.skeleton.limbs[key];
         const step=Math.max(Math.abs(rigWrap(a.root-b.root)),Math.abs(a.flex-b.flex));
         if(step>result.maxJointStepRadians){result.maxJointStepRadians=step;result.worstJointStep={id:c.id,case:c.name,bpm,t,previousTime:previous.t,limb:key,before:{root:b.root,flex:b.flex},after:{root:a.root,flex:a.flex}};}
        }
       }
      }
      previous={skeleton,audit,t,action:f.action};
     }
     if(JSON.stringify([f.hitAt,f.actionEnd,f.cooldown,f.recoveryUntil,f.attackRange])!==timingBefore)addFailure(c.id+'/'+c.name+' mutated combat timing');
     result.scenarios++;
    }
   }
   const bind=buildFighterSkeleton(makeFighter(false,.4,'kickboxer'),1000);
   const malformed=structuredClone(bind);malformed.bones[0].end[0]+=.5;
   if(measureFighterSkeleton(malformed).valid)addFailure('negative control failed to detect altered bone');else result.negativeControls++;
   if(measureFighterSkeleton(bind,{a:.08,b:0,c:0,d:1,e:0,f:0}).valid)addFailure('negative control failed to detect legacy X squash');else result.negativeControls++;
   const backwards=structuredClone(bind),limb=backwards.limbs.rightLeg;
   const ux=limb.joint[0]-limb.start[0],uy=limb.joint[1]-limb.start[1],angle=Math.atan2(uy,ux)-limb.flex;
   limb.end[0]=limb.joint[0]+limb.b*Math.cos(angle);limb.end[1]=limb.joint[1]+limb.b*Math.sin(angle);
   if(measureFighterSkeleton(backwards).valid)addFailure('negative control failed to detect backwards knee');else result.negativeControls++;
   const rotated=structuredClone(bind),arm=rotated.limbs.rightArm,upper=arm.reference+arm.limits.maxRoot+.2,lower=upper-arm.bend*arm.flex;
   arm.joint[0]=arm.start[0]+arm.a*Math.cos(upper);arm.joint[1]=arm.start[1]+arm.a*Math.sin(upper);
   arm.end[0]=arm.joint[0]+arm.b*Math.cos(lower);arm.end[1]=arm.joint[1]+arm.b*Math.sin(lower);
   if(measureFighterSkeleton(rotated).valid)addFailure('negative control failed to detect shoulder limit from geometry');else result.negativeControls++;
   const counterfeit=structuredClone(bind),bone=counterfeit.bones[0];
   bone.end[0]=bone.start[0]+(bone.end[0]-bone.start[0])*1.2;bone.end[1]=bone.start[1]+(bone.end[1]-bone.start[1])*1.2;bone.length*=1.2;
   if(measureFighterSkeleton(counterfeit).valid)addFailure('negative control trusted stretched bone metadata');else result.negativeControls++;


  }finally{RHYTHM_BPM=originalBpm;BEAT_MS=originalBeat;rhythmStart=originalStart}
  return result;
 })()`);
 assert.deepEqual(dense.failures,[]);assert.equal(dense.negativeControls,5);
 assert.ok(dense.maxRelativeLengthError<=1e-6);assert.ok(dense.maxFrameLengthChange<=2e-6);
 // Guard against discontinuous elbow/knee branch selection on intermediate frames.
 assert.ok(dense.maxJointStepRadians<.85,`joint branch jump: ${JSON.stringify(dense.worstJointStep)}`);
 const screen=[];
 for(const [width,height,density] of [[390,844,1],[844,390,2],[1100,800,1]]){
  await page.setViewportSize({width,height});
  const result=await run(`(()=>{
   const saved={paused,dpr,BEAT_MS,rhythmStart};paused=true;dpr=${density};canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
   const oldBuild=buildFighterSkeleton,oldLine=rigLine;let current=null,seen=new Map(),measuring=false;
   let renderedSegments=0,maxScreenError=0;const failures=[];
   buildFighterSkeleton=(f,t)=>{current=oldBuild(f,t);return current};
   rigLine=(a,b,...rest)=>{
    if(measuring&&current){const bone=current.bones.find(n=>n.start===a&&n.end===b);
     if(bone&&!seen.has(bone.name)){
      const m=ctx.getTransform(),dx=b[0]-a[0],dy=b[1]-a[1];
      const actual=Math.hypot(m.a*dx+m.c*dy,m.b*dx+m.d*dy),expected=current.rig[RIG_SEGMENTS[bone.name]]*clamp(Math.min(W/650,H/470),.82,1.3)*dpr,error=Math.abs(actual/expected-1);
      maxScreenError=Math.max(maxScreenError,error);renderedSegments++;seen.set(bone.name,true);
      if(!Number.isFinite(error)||error>1e-6)failures.push(bone.name+' rendered relative error '+error);
     }
    }oldLine(a,b,...rest);
   };
   try{
    BEAT_MS=500;rhythmStart=500;
    for(const id of Object.keys(RIGS))for(const facing of [1,-1]){
     const cases=[];
     for(const kind of ['light','heavy'])for(let variant=0;variant<15;variant++)cases.push({action:kind,actionVariant:variant});
     for(let i=0;i<RIGS[id].finals.length;i++)cases.push({action:'heavy',finisher:true,powerFinisher:true,finisherStyle:i});
     for(const action of ['idle','stunned','down','caught','throwing','dive','celebrate','defeated'])cases.push({action});
     cases.push({action:'heavy',attackLow:true,crouch:true});cases.push({action:'heavy',actionVariant:13,hitReactStart:1020,hitReactUntil:1400,hitReactPower:1.4});
     cases.push({action:'heavy',turnAt:1000,turnFrom:-facing});cases.push({action:'idle',guard:true});cases.push({action:'idle',crouch:true});cases.push({action:'heavy',jumpStart:1000,jumpUntil:1920,jumpHeight:45});
     for(const fields of cases){
      const f=makeFighter(false,.4,id);Object.assign(f,{actionStart:1000,hitAt:1055,actionEnd:1800,downStart:1000,downUntil:2400,rhythm:80,facing,turnFrom:facing},fields);
      // Includes extension, contact, return, body turn midpoint and late rotation.
      for(const t of [1000,1013,1027,1041,1055,1069,1083,1110,1240,1517,1799]){
       ctx.clearRect(0,0,W,H);seen=new Map();measuring=true;fighter(f,t);measuring=false;
       if(seen.size!==8)failures.push(id+'/'+f.action+': renderer did not draw all eight bones');
      }
     }
    }
   }finally{buildFighterSkeleton=oldBuild;rigLine=oldLine;paused=saved.paused;dpr=saved.dpr;BEAT_MS=saved.BEAT_MS;rhythmStart=saved.rhythmStart;resize()}
   return {viewport:[W,H],density:${density},renderedSegments,maxScreenError,failures:failures.slice(0,12)};
  })()`);
  assert.deepEqual(result.failures,[]);assert.deepEqual(result.viewport,[width,height]);screen.push(result);
 }
 const report={dense,screen};console.log('Kinematic integrity:',JSON.stringify(report));
 if(artifactDir){
  fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,'kinematic-integrity.json'),JSON.stringify(report,null,2));
  for(const debug of [false,true]){
   const galleryContext=await page.context().browser().newContext(),gallery=await galleryContext.newPage(),galleryErrors=[];gallery.on('pageerror',e=>galleryErrors.push(e.message));
   try{
    await gallery.setViewportSize({width:1536,height:960});
    const url=new URL(page.url());url.searchParams.set('rig',debug?'1':'0');await gallery.goto(url.toString());
    await gallery.addStyleTag({content:'#app>*:not(canvas){visibility:hidden}'});
    const integrity=await gallery.evaluate(()=>__test(`(()=>{
     paused=true;ctx.fillStyle='#102132';ctx.fillRect(0,0,W,H);W=600;H=240;rhythmStart=500;BEAT_MS=500;
     const ids=['kickboxer','boxer','power','acrobat'],styles=[3,3,1,3],times=[1000,1014,1028,1042,1055,1150,1450,1825];
     ids.forEach((id,row)=>times.forEach((t,col)=>{
      ctx.save();ctx.translate(col*192,row*240);ctx.beginPath();ctx.rect(0,0,192,240);ctx.clip();ctx.fillStyle='#d1e9e8';ctx.textAlign='left';ctx.font='12px system-ui';ctx.fillText(id+' · '+(t-1000)+' ms',9,18);
      const f=makeFighter(false,.13,id);Object.assign(f,{action:'heavy',actionStart:1000,hitAt:1055,actionEnd:1825,finisher:true,powerFinisher:true,finisherStyle:styles[row],finisherName:'',rhythm:0});fighter(f,t);ctx.restore();
     }));return {...RIG_INTEGRITY};
    })()`));
    assert.equal(integrity.violations,0);assert.deepEqual(galleryErrors,[]);
    await gallery.screenshot({path:path.join(artifactDir,(debug?'skeleton':'skin')+'-intermediate-frames.png')});
   }finally{await galleryContext.close()}
  }
 }

};
