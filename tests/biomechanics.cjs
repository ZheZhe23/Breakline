const assert=require('node:assert/strict');
module.exports=async({run})=>{
 const report=await run(`(()=>{
  const failures=[],stats={kickCycles:0,transitions:0,hitstopFrames:0},check=(v,m)=>{if(!v)failures.push(m)},savedBeat=BEAT_MS;
  for(const bpm of [100,120,140]){
   BEAT_MS=60000/bpm;
   for(const id of Object.keys(RIGS)){
    const f=makeFighter(false,.4,id);Object.assign(f,{action:'heavy',actionStart:1000,hitAt:1000+BEAT_MS*.11,actionEnd:1000+BEAT_MS*.76,actionVariant:0});
    const h=f.hitAt-1000,chamber=buildFighterSkeleton(f,1000+h*.52),contact=buildFighterSkeleton(f,f.hitAt),returned=buildFighterSkeleton(f,f.hitAt+(f.actionEnd-f.hitAt)*.5);
    check(chamber.limbs.rightLeg.flex>contact.limbs.rightLeg.flex+.35,id+' chamber is visibly bent @'+bpm);
    check(returned.limbs.rightLeg.flex>contact.limbs.rightLeg.flex+.2,id+' retracts knee @'+bpm);
    check(contact.pose.animationPhase==='contact',id+' contact phase matches hitAt');
    for(let t=1000;t<=f.actionEnd;t+=8){
     const s=buildFighterSkeleton(f,t),p=s.pose.p;check(measureFighterSkeleton(s).valid,id+' anatomical cycle');
     if(p.support[0]===1){const gap=Math.hypot(s.limbs.leftLeg.end[0]-p.lf[0],s.limbs.leftLeg.end[1]-p.lf[1]);check(gap<4,id+' planted foot '+gap);}
     const com=p.hip[0]*.5+p.thorax[0]*.35+p.head[0]*.15;
     if(p.support[0]===1)check(Math.abs(com-p.lf[0])<=19.001,id+' supported center of mass');
    }
    stats.kickCycles++;
    // New actions start from the previous displayed body, with the contact
    // deadline still owned by the combat state machine.
    const a=makeFighter(false,.4,id);Object.assign(a,{action:'light',actionStart:1000,hitAt:1043,actionEnd:1380});let old;
    for(let t=1000;t<=1240;t+=8)old=displayFighterSkeleton(a,t);
    Object.assign(a,{action:'heavy',actionStart:1240,hitAt:1295,actionEnd:1640,actionVariant:1});
    const first=displayFighterSkeleton(a,1240);
    for(let i=0;i<old.bones.length;i++)check(Math.hypot(old.bones[i].end[0]-first.bones[i].end[0],old.bones[i].end[1]-first.bones[i].end[1])<1e-6,id+' transition has no pose reset');
    let before=first,priorTime=1240;
    for(let t=1248;t<1295;t+=8){const s=displayFighterSkeleton(a,t),raw=buildFighterSkeleton(a,t),priorRaw=buildFighterSkeleton(a,priorTime);check(measureFighterSkeleton(s).valid,id+' transition preserves lengths/limits');check(s.limbs.leftLeg.end[1]<2,id+' support foot does not pass through floor during transition');for(let i=0;i<s.bones.length;i++){const movement=Math.hypot(s.bones[i].end[0]-before.bones[i].end[0],s.bones[i].end[1]-before.bones[i].end[1]),scheduled=Math.hypot(raw.bones[i].end[0]-priorRaw.bones[i].end[0],raw.bones[i].end[1]-priorRaw.bones[i].end[1]);check(movement<=scheduled+8,id+' transition adds unscheduled jump '+movement+'/'+scheduled);}before=s;priorTime=t;}
    const atHit=displayFighterSkeleton(a,1295),target=buildFighterSkeleton(a,1295);
    check(JSON.stringify(atHit.bones.map(b=>b.end))===JSON.stringify(target.bones.map(b=>b.end)),id+' transition reaches exact contact deadline');
    check(a.hitAt===1295&&a.actionEnd===1640,id+' animation did not mutate combat times');stats.transitions++;
   }
  }
  BEAT_MS=savedBeat;
  const a=makeFighter(false,.4,'kickboxer'),d=makeFighter(true,.54,'boxer'),t=gameClock();
  Object.assign(a,{action:'heavy',actionStart:t-55,hitAt:t,actionEnd:t+700,powerFinisher:true,finisher:true});photoHit(a,d,t,1.5);
  const stop=photoStop,frame=stop.frames.get(a),immutable=JSON.stringify(frame.skeleton);
  a.x=.8;a.action='idle';a.facing=-1;d.x=.2;d.action='down';
  for(const at of [t,t+30,t+75,t+109]){check(JSON.stringify(frame.skeleton)===immutable,'hitstop snapshot is immutable');check(fighter(a,at,frame)===frame.skeleton,'hitstop draws exact captured skeleton');stats.hitstopFrames++;}
  check(frame.skeleton.pose.contact===1,'hitstop captures contact, not anticipation');check(!audio||audio.state==='running','visual hold leaves audio running');
  const entry=makeFighter(false,.4,'kickboxer');Object.assign(entry,{action:'heavy',actionStart:t-55,hitAt:t,actionEnd:t+700,powerFinisher:true,finisher:true});
  entry.visualContactState={at:t,attacker:{...entry,visualContactState:null},defender:{...d}};entry.action='celebrate';entry.actionStart=t;
  photoHit(entry,d,t,1.5);check(photoStop.frames.get(entry).state.action==='heavy'&&photoStop.frames.get(entry).skeleton.pose.contact===1,'KO captures attack contact before winner state');
  stats.knockoutSnapshots=1;photoStop=null;photoAccent=null;return {failures,stats};
 })()`);
 assert.deepEqual(report.failures,[]);console.log('Biomechanics:',report.stats);
};
