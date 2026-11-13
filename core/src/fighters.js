/* Authored whole-body sprite choreography. No per-limb rendering or deformation. */
const CoreFighters=(()=>{
'use strict';
const roster={
 nova:{id:'nova',name:'NOVA',style:'КИКБОКСИНГ',tag:'Баланс. Чёткий удар. Мощный разворот.',color:'#ddff78',hp:1,power:1,impact:{hand:130,kick:180},superName:'NEON BREAK',superMove:'neonSuper',superDamage:66,superSound:'nova',recipes:{LLL:{move:'uppercut',name:'АППЕРКОТ',damage:25},LLH:{move:'frontKick',name:'ПРОБИВНОЙ',damage:27},LHLH:{move:'spinKick',name:'РАЗВОРОТ',damage:37}},prefix:{L:'jab',LL:'cross',LH:'bodyKick',LHL:'hook'}},
 brick:{id:'brick',name:'BRICK',style:'ТЯЖЁЛЫЙ БОЙ',tag:'Вес. Давление. Сокрушительный таран.',color:'#ffad69',hp:1.1,power:1.1,impact:{hand:155,kick:200},superName:'FAULT LINE',superMove:'faultSuper',superDamage:74,superSound:'brick',recipes:{LLL:{move:'heavyUpper',name:'ГРОМОВОЙ АППЕРКОТ',damage:29},HHL:{move:'shoulderRush',name:'ТАРАН',damage:36},LHH:{move:'powerStomp',name:'ТЯЖЁЛАЯ СТОПА',damage:29}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HH:'bodyKick',LH:'hook'}},
 iris:{id:'iris',name:'IRIS',style:'АКРОБАТИКА',tag:'Пластика. Ладони. Воздушная техника.',color:'#8dece8',hp:.95,power:.94,impact:{hand:135,kick:180},superName:'PRISM FLIGHT',superMove:'prismSuper',superDamage:68,superSound:'iris',recipes:{LLH:{move:'crescentFinish',name:'ВЫСОКИЙ УДАР',damage:28},HLL:{move:'risingPalm',name:'ВОСХОДЯЩАЯ ЛАДОНЬ',damage:30},HLHH:{move:'cartwheel',name:'КОЛЕСО',damage:40}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HL:'hook',HLH:'bodyKick'}}
};
for(const f of Object.values(roster)){const trie={};for(const [text,finish]of Object.entries(f.recipes)){let n=trie;for(const key of text)n=n[key]??(n[key]={});n.finish={...finish,recipe:text}}f.trie=trie;Object.freeze(f)}
const rivals=Object.freeze({
 nova:Object.freeze({name:'ТЕХНИК',cadence:[4,3,4,2,4,3],moves:['cross','bodyKick','hook'],signatureEvery:4,guardBeats:3}),
 brick:Object.freeze({name:'ДАВЛЕНИЕ',cadence:[5,4,3,4],moves:['cross','hook','bodyKick'],signatureEvery:3,guardBeats:4}),
 iris:Object.freeze({name:'СМЕНА ТЕМПА',cadence:[4,2,1,4,3,1],moves:['bodyKick','cross','hook'],signatureEvery:4,guardBeats:2})
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)},lerp=(a,b,t)=>a+(b-a)*t;
const rows={jab:0,cross:5,hook:5,bodyKick:1,uppercut:2,frontKick:1,spinKick:3,knee:4,heavyUpper:2,shoulderRush:3,powerStomp:1,crescentFinish:1,risingPalm:2,cartwheel:3};
const specialMoves=new Set(['uppercut','frontKick','spinKick','heavyUpper','shoulderRush','powerStomp','crescentFinish','risingPalm','cartwheel']);
function get(id){return roster[id]??roster.nova}
// Each clip has an explicit contact cell and a separate recoil/linked-guard phase.
function clip(id,name){
 if(name==='cross'||name==='hook'&&id==='brick'||name==='risingPalm')return [36,37,38,39,40,41];
 if(name==='bodyKick'||name==='powerStomp'||name==='crescentFinish')return [42,43,44,45,46,47];
 const row=rows[name]??0;return Array.from({length:6},(_,i)=>row*6+i);
}
function move(id,name){
 const f=get(id),superMove=name===f.superMove;
 if(superMove)return {impact:500,duration:1250,recovery:1250,row:4,super:true,frames:[0,27,f.id==='brick'?28:f.id==='iris'?14:8,f.id==='brick'?21:28,f.id==='nova'?10:22,5],contact:{x:f.id==='nova'?36:f.id==='brick'?48:62,y:f.id==='nova'?-75:-100},drive:f.id==='nova'?46:f.id==='brick'?24:18};
 const row=rows[name]??0,strong=specialMoves.has(name),impact=strong?(row===3?230:row===2?190:205):row===1?f.impact.kick:f.impact.hand;
 return {impact,duration:strong?760:row===1?640:580,recovery:strong?675:390,row,super:false,frames:clip(id,name),contact:{x:row===2?47:row===3&&id==='brick'?48:80,y:row===2?-132:name==='powerStomp'?-58:row===1?-77:-112},drive:row===2?24:row===3&&id==='brick'?28:0};
}
// Hermite decay carries root position AND incoming velocity across legal actions.
// Drawings remain intact; no limb warp, no ghosted-pose crossfade.
function carry(value,speed,age,span=180){const u=clamp(age/span,0,1);return (2*u*u*u-3*u*u+1)*value+(u*u*u-2*u*u+u)*span*clamp(speed??0,-.18,.18)}
function visual(a,t,flags={}){
 const f=get(a.fighter),act=a.action;
 if(flags.victory||flags.defeat)return {fighter:f.id,frame:flags.victory?29:26,x:0,y:0,flash:false};
 let frame=0,x=0,y=0,flash=false;
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
  if(m.super){const lift=f.id==='brick'?(age<250?0:Math.sin(Math.PI*clamp((age-250)/250,0,1))*20):age<280?0:age<500?lerp(0,24,smooth((age-280)/220)):age<690?lerp(24,0,smooth((age-500)/190)):0;y-=lift;flash=age>=i&&age<i+170}
 }
 if(a.guardBlend?.to&&(!act||t>=act.start+move(a.fighter,act.move).duration)){const b=a.guardBlend,age=t-b.at;frame=age<40?b.from.frame:age<85?2:b.key==='H'?2:24;x=carry(b.from.x,b.from.vx,age);y=carry(b.from.y,b.from.vy,age)}
 if(a.defence&&t<a.defence.end){const d=a.defence,age=Math.max(0,t-d.start);frame=age<35?d.from.frame:age<245?25:5;x=carry(d.from.x,d.from.vx,age)+(age<80?lerp(0,-7,smooth(age/80)):age<165?-7:lerp(-7,0,smooth((age-165)/165)));y=carry(d.from.y,d.from.vy,age)}
 // OFF has a visible near-miss rather than a damaging-looking ghost contact.
 if(a.evade&&t<a.evade.end){const d=a.evade,age=Math.max(0,t-d.start),u=clamp(age/330,0,1);frame=age<35?d.from.frame:age<245?(f.id==='iris'?27:25):5;x=carry(d.from.x,d.from.vx,age)-Math.sin(Math.PI*smooth(u))*12;y=carry(d.from.y,d.from.vy,age)}
 if(a.hit&&t<a.hit.end&&!a.hit.keepAttack){const h=a.hit,age=Math.max(0,t-h.start),duration=h.end-h.start;frame=age<22?h.from.frame:age<duration-85?26:24;x=carry(h.from.x,h.from.vx,age)+(age<60?lerp(0,-8,smooth(age/60)):lerp(-8,0,smooth((age-60)/(duration-60))));y=carry(h.from.y,h.from.vy,age)}
 if(a.hit?.keepAttack&&t<a.hit.end){const age=Math.max(0,t-a.hit.start);x-=Math.sin(Math.PI*clamp(age/(a.hit.end-a.hit.start),0,1))*3}
 if(flags.warning&&!act&&!a.hit&&!a.defence){frame=2;x=-2}
 return {fighter:f.id,frame:clamp(frame,0,47),x,y,flash};
}
function velocity(a,t){const before=visual(a,t-.5),after=visual(a,t+.5);return {vx:after.x-before.x,vy:after.y-before.y}}
function contact(a,t){const m=move(a.fighter,a.action?.move??'jab'),v=visual(a,t);return {x:v.x+m.contact.x,y:v.y+m.contact.y}}
return {roster,rivals,get,move,visual,velocity,clip,contact,rows};
})();
