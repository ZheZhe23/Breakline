/* Authored whole-body sprite choreography. No per-limb rendering or deformation. */
const CoreFighters=(()=>{
'use strict';
const roster={
 nova:{id:'nova',name:'NOVA',style:'КИКБОКСИНГ',tag:'Баланс. Чёткий удар. Мощный разворот.',color:'#ddff78',hp:1,power:1,impact:{hand:130,kick:180},superName:'NEON BREAK',superMove:'neonSuper',superDamage:66,superSound:'nova',recipes:{LLL:{move:'uppercut',name:'АППЕРКОТ',damage:25},LLH:{move:'frontKick',name:'ПРОБИВНОЙ',damage:27},LHLH:{move:'spinKick',name:'РАЗВОРОТ',damage:37}},prefix:{L:'jab',LL:'cross',LH:'bodyKick',LHL:'hook'}},
 brick:{id:'brick',name:'BRICK',style:'ТЯЖЁЛЫЙ БОЙ',tag:'Вес. Давление. Сокрушительный таран.',color:'#ffad69',hp:1.1,power:1.1,impact:{hand:155,kick:200},superName:'FAULT LINE',superMove:'faultSuper',superDamage:74,superSound:'brick',recipes:{LLL:{move:'heavyUpper',name:'ГРОМОВОЙ АППЕРКОТ',damage:29},HHL:{move:'shoulderRush',name:'ТАРАН',damage:36},LHH:{move:'powerStomp',name:'ТЯЖЁЛАЯ СТОПА',damage:29}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HH:'bodyKick',LH:'hook'}},
 iris:{id:'iris',name:'IRIS',style:'АКРОБАТИКА',tag:'Опора на ладонь. Воздушные ножницы. Пластика.',color:'#8dece8',hp:.95,power:.94,impact:{hand:135,kick:180},superName:'PRISM FLIGHT',superMove:'prismSuper',superDamage:68,superSound:'iris',recipes:{LLH:{move:'crescentFinish',name:'ВОЗДУШНЫЕ НОЖНИЦЫ',damage:28},HLL:{move:'risingPalm',name:'ВОСХОДЯЩАЯ ЛАДОНЬ',damage:30},HLHH:{move:'cartwheel',name:'УДАР В ИНВЕРСИИ',damage:40}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HL:'hook',HLH:'sweepKick'}}
};
for(const f of Object.values(roster)){const trie={};for(const [text,finish]of Object.entries(f.recipes)){let n=trie;for(const key of text)n=n[key]??(n[key]={});n.finish={...finish,recipe:text}}f.trie=trie;Object.freeze(f)}
const rivals=Object.freeze({
 nova:Object.freeze({name:'ТЕХНИК',cadence:[4,3,4,2,4,3],moves:['cross','bodyKick','hook'],signatureEvery:4,guardBeats:3}),
 brick:Object.freeze({name:'ДАВЛЕНИЕ',cadence:[5,4,3,4],moves:['cross','hook','bodyKick'],signatureEvery:3,guardBeats:4}),
 iris:Object.freeze({name:'СМЕНА ТЕМПА',cadence:[4,2,1,4,3,1],moves:['bodyKick','cross','hook'],signatureEvery:4,guardBeats:2})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)},lerp=(a,b,t)=>a+(b-a)*t;
const rows={jab:0,cross:5,hook:5,bodyKick:1,sweepKick:1,uppercut:2,frontKick:1,spinKick:3,knee:4,heavyUpper:2,shoulderRush:3,powerStomp:1,crescentFinish:1,risingPalm:2,cartwheel:3};
const specialMoves=new Set(['uppercut','frontKick','spinKick','heavyUpper','shoulderRush','powerStomp','crescentFinish','risingPalm','cartwheel']);
function get(id){return roster[id]??roster.nova}
// Each clip has an explicit contact cell and a separate recoil/linked-guard phase.
function clip(id,name){
 if(id==='iris'){
  if(name==='crescentFinish')return [5,13,14,28,16,17];
  if(name==='risingPalm')return [5,13,14,15,16,17];
  if(name==='cartwheel')return [5,19,20,22,20,17];
  if(name==='sweepKick')return [5,19,20,21,22,23];
 }
 if(name==='cross'||name==='hook'&&id==='brick'||name==='risingPalm')return [36,37,38,39,40,41];
 if(name==='bodyKick'||name==='powerStomp'||name==='crescentFinish')return [42,43,44,45,46,47];
 const row=rows[name]??0;return Array.from({length:6},(_,i)=>row*6+i);
}
function move(id,name){
 const f=get(id),superMove=name===f.superMove;
 if(id==='iris'){
  const authored={
   crescentFinish:{impact:260,duration:760,recovery:675,row:1,frames:clip(id,name),contact:{x:84,y:-52},drive:0},
   risingPalm:{impact:245,duration:760,recovery:675,row:2,frames:clip(id,name),contact:{x:57,y:-135},drive:24},
   cartwheel:{impact:450,duration:950,recovery:950,row:3,frames:clip(id,name),contact:{x:86,y:-50},drive:0},
   sweepKick:{impact:180,duration:640,recovery:390,row:1,frames:clip(id,name),contact:{x:74,y:-98},drive:0},
   prismSuper:{impact:500,duration:1250,recovery:1250,row:4,super:true,frames:[0,27,14,28,16,17],contact:{x:84,y:-52},drive:0,maxLift:70}
  };if(authored[name])return {super:false,...authored[name]};
 }
 if(superMove)return {impact:500,duration:1250,recovery:1250,row:4,super:true,frames:[0,27,f.id==='brick'?28:f.id==='iris'?14:8,f.id==='brick'?21:28,f.id==='nova'?10:22,5],contact:{x:f.id==='nova'?36:f.id==='brick'?48:62,y:f.id==='nova'?-75:-100},drive:f.id==='nova'?46:f.id==='brick'?24:18};
 const row=rows[name]??0,strong=specialMoves.has(name),impact=strong?(row===3?230:row===2?190:205):row===1?f.impact.kick:f.impact.hand;
 return {impact,duration:strong?760:row===1?640:580,recovery:strong?675:390,row,super:false,frames:clip(id,name),contact:{x:row===2?47:row===3&&id==='brick'?48:80,y:row===2?-132:name==='powerStomp'?-58:row===1?-77:-112},drive:row===2?24:row===3&&id==='brick'?28:0};
}
// Hermite decay carries root position AND incoming velocity across legal actions.
// Drawings remain intact; no limb warp, no ghosted-pose crossfade.
function carry(value,speed,age,span=180){const u=clamp(age/span,0,1);return (2*u*u*u-3*u*u+1)*value+(u*u*u-2*u*u+u)*span*clamp(speed??0,-.18,.18)}
// Whole-cel rigid transforms: the palm stays planted during an inverted kick.
// No skeleton, limb scaling, or rotation of a standing drawing to fake a flip.
const palms={20:[89,259],21:[53,259],22:[74,259]};
function mounted(frame,turn=0,anchor=-64){const p=palms[frame];return p?{turn,mount:{kind:'palm',pivot:{x:(p[0]-164)*.68,y:(p[1]-260)*.68},anchor:{x:anchor,y:0}}}:{turn:0,mount:null}}
function project(v,p){const m=v.mount??{pivot:{x:0,y:0},anchor:{x:0,y:0}},c=Math.cos(v.turn??0),s=Math.sin(v.turn??0),x=p.x-m.pivot.x,y=p.y-m.pivot.y;return {x:v.x+m.anchor.x+x*c-y*s,y:v.y+m.anchor.y+x*s+y*c}}
// Land only after the inverted contact. The leg chambers before the hand leaves the floor.
function irisUnwind(u){
 if(u<.16)return {frame:22,...mounted(22,-.7,4),lift:0,acro:{phase:'strike'}};
 if(u<.48)return {frame:20,...mounted(20,lerp(-.7,0,smooth((u-.16)/.32)),4),lift:0,acro:{phase:'chamber'}};
 if(u<.78)return {frame:19,turn:0,mount:{kind:'entry',pivot:{x:0,y:0},anchor:{x:46*(1-smooth((u-.48)/.3)),y:0}},lift:0,acro:{phase:'landing'}};
 return {frame:u<.94?17:0,turn:0,mount:null,lift:0,acro:{phase:u<.94?'landing':'ready'}};
}
function irisMotion(name,age,m){
 const i=m.impact;
 if(name==='cartwheel'){
  if(age>=i)return irisUnwind(clamp((age-i)/(m.duration-i),0,1));
  if(age<35)return {frame:null,turn:0,mount:null,lift:0,acro:{phase:'entry'}};
  if(age<i*.35)return {frame:19,turn:0,mount:{kind:'entry',pivot:{x:0,y:0},anchor:{x:46*smooth((age-35)/(i*.35-35)),y:0}},lift:0,acro:{phase:'entry'}};
  const frame=age<i*.62?20:21,turn=age<i*.62?lerp(0,-1.05,smooth((age-i*.35)/(i*.27))):lerp(-1.05,-.7,smooth((age-i*.62)/(i*.38)));
  return {frame,...mounted(frame,turn,4),lift:0,acro:{phase:age<i*.62?'support':'inversion'}};
 }
 if(name==='sweepKick'){
  const frame=age<35?null:age<i*.37?19:age<i*.62?20:age<i+95?21:age<m.duration*.76?22:age<m.duration?23:0;
  const turn=age<i*.37?0:age<i*.62?lerp(0,-.16,smooth((age-i*.37)/(i*.25))):age<i?lerp(-.16,0,smooth((age-i*.62)/(i*.38))):0;
  return {frame,...mounted(frame,turn),lift:0};
 }
 if(name==='prismSuper'){
  // One complete somersault BEFORE the opening kick, measured around the pelvis.
  // A tucked drawing changes during the rotation; no standing sprite is spun.
  const spin=-Math.PI*2*smooth((age-110)/340),frame=age<55?null:age<80?27:age<140?14:age<360?20:age<i?14:age<i+170?28:age<900?16:age<1100?17:age<m.duration?5:0;
  const flight=age>=80&&age<i,pivot=frame===20?{x:(174-164)*.68,y:(145-260)*.68}:{x:(183-164)*.68,y:(156-260)*.68};
  const turn=flight?spin+(frame===20?.88:0):age>=450?spin:0;
  const lift=age<80?0:age<280?70*smooth((age-80)/200):age<430?70:age<i?lerp(70,60,smooth((age-430)/(i-430))):age<i+170?60:lerp(60,0,smooth((age-i-170)/230));
  return {frame,turn,mount:flight?{kind:'air',pivot,anchor:{x:0,y:-80}}:null,lift,acro:{phase:age<80?'entry':age<110?'takeoff':age<450?'somersault':age<i?'extension':age<i+170?'strike':age<900?'landing':'ready',spin,airborne:lift>0}};
 }
 const peak=name==='crescentFinish'?28:name==='risingPalm'?8:0;
 return {frame:null,turn:0,mount:null,lift:age<i?peak*smooth((age-35)/(i-35)):age<i+95?peak:peak*(1-smooth((age-i-95)/(m.duration-i-95)))};
}
function visual(a,t,flags={}){
 const f=get(a.fighter),act=a.action;
 if(flags.victory||flags.defeat)return {fighter:f.id,frame:flags.victory?29:26,x:0,y:0,flash:false};
 if(a.recovery){const r=a.recovery;if(t>=r.end)return {fighter:f.id,frame:0,x:0,y:0,flash:false};const span=r.end-r.start-r.stop,u=clamp((t-r.start-r.stop)/span,0,1),age=u*span,m=move(f.id,r.move),frame=u<.16?r.from.frame:r.kind==='defender'?(u<.55?26:u<.83?24:0):(u<.48?m.frames[4]:u<.78?m.frames[5]:u<.92?5:0);return {fighter:f.id,frame,x:carry(r.from.x,r.from.vx,age,span),y:carry(r.from.y,r.from.vy,age,span),flash:false,...(f.id==='iris'&&r.move==='cartwheel'&&r.kind!=='defender'?irisUnwind(u):u<.16?{turn:r.from.turn??0,mount:r.from.mount}:f.id==='iris'&&r.kind!=='defender'?mounted(frame):{})}}
 if(a.visualReturn&&t<a.visualReturn.end){const r=a.visualReturn,age=t-r.start;return {fighter:f.id,frame:age<35?r.from.frame:age<110?5:0,x:carry(r.from.x,r.from.vx,age,160),y:carry(r.from.y,r.from.vy,age,160),flash:false,...(age<35?{turn:r.from.turn??0,mount:r.from.mount}:{})}}
 let frame=0,x=0,y=0,flash=false,turn=0,mount=null,acro=null;
 if(act){
  const m=move(a.fighter,act.move),stop=act.visualStop,lag=stop?clamp(t-stop.at,0,stop.duration):0,age=Math.max(0,t-act.start-lag),i=m.impact,from=act.from??{frame:0,x:0,y:0};
  const times=m.super?[0,95,280,i,i+170,1050,m.duration]:[0,35,i*.57,i,i+95,m.duration*.82,m.duration];
  const cells=[from.frame,...m.frames.slice(1),0];let k=0;while(k<times.length-1&&age>=times[k+1])k++;frame=cells[k];
  const linked=act.series&&!act.finish&&act.series.clean;
  if(age>=m.duration)frame=linked&&age<1250?m.frames[5]:0;
  const drive=age<i?lerp(0,m.drive,smooth(age/i)):age<i+115?m.drive:lerp(m.drive,0,smooth((age-i-115)/(m.duration-i-115)));
  x=drive+carry(from.x,from.vx,age);y=carry(from.y,from.vy,age);
  // A small anticipation moves the body before the first new cel is selected.
  if(!m.super&&age<i)x-=Math.sin(Math.PI*smooth(age/i))*(f.id==='brick'?2.5:1.5);
  if(f.id==='iris'){const p=irisMotion(act.move,age,m);if(p.frame!==null)frame=p.frame;y-=p.lift;turn=p.turn;mount=p.mount;acro=p.acro??null;if(age<(m.super?55:35)){turn=from.turn??0;mount=from.mount??null}}
  if(m.super){if(f.id!=='iris'){const lift=f.id==='brick'?(age<250?0:Math.sin(Math.PI*clamp((age-250)/250,0,1))*20):age<280?0:age<500?lerp(0,24,smooth((age-280)/220)):age<690?lerp(24,0,smooth((age-500)/190)):0;y-=lift}flash=age>=i&&age<i+170}
 }
 if(a.guardBlend?.to&&(!act||t>=act.start+move(a.fighter,act.move).duration)){const b=a.guardBlend,age=t-b.at;frame=age<40?b.from.frame:age<85?2:b.key==='H'?2:24;x=carry(b.from.x,b.from.vx,age);y=carry(b.from.y,b.from.vy,age)}
 if(a.defence&&t<a.defence.end){const d=a.defence,age=Math.max(0,t-d.start);frame=age<35?d.from.frame:age<245?25:5;x=carry(d.from.x,d.from.vx,age)+(age<80?lerp(0,-7,smooth(age/80)):age<165?-7:lerp(-7,0,smooth((age-165)/165)));y=carry(d.from.y,d.from.vy,age)}
 // OFF has a visible near-miss rather than a damaging-looking ghost contact.
 if(a.evade&&t<a.evade.end){const d=a.evade,age=Math.max(0,t-d.start),u=clamp(age/330,0,1);frame=age<35?d.from.frame:age<245?(f.id==='iris'?27:25):5;x=carry(d.from.x,d.from.vx,age)-Math.sin(Math.PI*smooth(u))*12;y=carry(d.from.y,d.from.vy,age)}
 if(a.hit&&(t<a.hit.end||flags.held)&&!a.hit.keepAttack){const h=a.hit,age=Math.max(0,t-h.start),duration=h.end-h.start;frame=age<22?h.from.frame:flags.held||age<duration-85?26:24;x=carry(h.from.x,h.from.vx,age)+(age<60?lerp(0,-8,smooth(age/60)):lerp(-8,flags.held?-6:0,smooth((age-60)/(duration-60))));y=carry(h.from.y,h.from.vy,age)}
 if(a.hit?.keepAttack&&t<a.hit.end){const age=Math.max(0,t-a.hit.start);x-=Math.sin(Math.PI*clamp(age/(a.hit.end-a.hit.start),0,1))*3}
 if(flags.warning&&!act&&!a.hit&&!a.defence){frame=2;x=-2}
 // Reactions/defence override attack drawings and their support transform together.
 const override=a.hit&&(t<a.hit.end||flags.held)&&!a.hit.keepAttack||a.defence&&t<a.defence.end||a.evade&&t<a.evade.end||a.guardBlend?.to&&(!act||t>=act.start+move(a.fighter,act.move).duration);
 if(override){acro=null;const event=a.hit&&(t<a.hit.end||flags.held)&&!a.hit.keepAttack?a.hit:a.evade&&t<a.evade.end?a.evade:a.defence&&t<a.defence.end?a.defence:a.guardBlend,age=t-(event.start??event.at),hold=event===a.hit?22:event===a.guardBlend?40:35;turn=age<hold?event.from.turn??0:0;mount=age<hold?event.from.mount??null:null}
 return {fighter:f.id,frame:clamp(frame,0,47),x,y,flash,turn,mount,acro};
}
function velocity(a,t){const before=visual(a,t-.5),after=visual(a,t+.5);return {vx:after.x-before.x,vy:after.y-before.y}}
function contact(a,t){const m=move(a.fighter,a.action?.move??'jab'),v=visual(a,t);return project(v,m.contact)}
return {roster,rivals,get,move,visual,velocity,clip,contact,project,rows};
})();
