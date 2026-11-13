/* Authored whole-body sprite choreography. No per-limb rendering or deformation. */
const CoreFighters=(()=>{
'use strict';
const roster={
 nova:{id:'nova',name:'NOVA',style:'КИКБОКСИНГ',tag:'Баланс. Чёткий удар. Мощный разворот.',color:'#ddff78',hp:1,power:1,impact:{hand:85,kick:125},superName:'NEON BREAK',superMove:'neonSuper',superDamage:66,superSound:'nova',recipes:{LLL:{move:'uppercut',name:'АППЕРКОТ',damage:25},LLH:{move:'frontKick',name:'ПРОБИВНОЙ',damage:27},LHLH:{move:'spinKick',name:'РАЗВОРОТ',damage:37}},prefix:{L:'jab',LL:'cross',LH:'bodyKick',LHL:'hook'}},
 brick:{id:'brick',name:'BRICK',style:'ТЯЖЁЛЫЙ БОЙ',tag:'Вес. Давление. Сокрушительный таран.',color:'#ffad69',hp:1.1,power:1.1,impact:{hand:105,kick:140},superName:'FAULT LINE',superMove:'faultSuper',superDamage:74,superSound:'brick',recipes:{LLL:{move:'heavyUpper',name:'ГРОМОВОЙ АППЕРКОТ',damage:29},HHL:{move:'shoulderRush',name:'ТАРАН',damage:36},LHH:{move:'powerStomp',name:'ТЯЖЁЛАЯ СТОПА',damage:29}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HH:'bodyKick',LH:'hook'}},
 iris:{id:'iris',name:'IRIS',style:'АКРОБАТИКА',tag:'Пластика. Ладони. Воздушная техника.',color:'#8dece8',hp:.95,power:.94,impact:{hand:90,kick:125},superName:'PRISM FLIGHT',superMove:'prismSuper',superDamage:68,superSound:'iris',recipes:{LLH:{move:'crescentFinish',name:'ПОЛУМЕСЯЦ',damage:28},HLL:{move:'risingPalm',name:'ВОСХОДЯЩАЯ ЛАДОНЬ',damage:30},HLHH:{move:'cartwheel',name:'КОЛЕСО',damage:40}},prefix:{L:'jab',LL:'cross',H:'bodyKick',HL:'hook',HLH:'bodyKick'}}
};
for(const f of Object.values(roster)){const trie={};for(const [text,finish]of Object.entries(f.recipes)){let n=trie;for(const key of text)n=n[key]??(n[key]={});n.finish={...finish,recipe:text}}f.trie=trie;Object.freeze(f)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)},lerp=(a,b,t)=>a+(b-a)*t;
const rows={jab:0,cross:5,hook:5,bodyKick:1,uppercut:2,frontKick:1,spinKick:3,knee:4,heavyUpper:2,shoulderRush:3,powerStomp:1,crescentFinish:1,risingPalm:2,cartwheel:3};
const specialMoves=new Set(['uppercut','frontKick','spinKick','heavyUpper','shoulderRush','powerStomp','crescentFinish','risingPalm','cartwheel']);
function get(id){return roster[id]??roster.nova}
function move(id,name){const f=get(id),superMove=name===f.superMove;if(superMove)return {impact:500,duration:1250,recovery:1250,row:4,super:true,contact:{x:f.id==='nova'?36:f.id==='brick'?48:62,y:f.id==='nova'?-75:-100},drive:f.id==='nova'?46:f.id==='brick'?24:18};const row=rows[name]??0,strong=specialMoves.has(name),impact=strong?({0:105,1:135,2:125,3:150}[row]):row===1?f.impact.kick:f.impact.hand;return {impact,duration:strong?700:row===1?570:510,recovery:strong?675:390,row,super:false,contact:{x:row===2?47:row===3&&id==='brick'?48:80,y:row===2?-132:row===1?-77:-112},drive:row===2?24:row===3&&id==='brick'?28:0}}
function idleFrame(id,t){return 0}
function visual(a,t,flags={}){
 const f=get(a.fighter),act=a.action;if(flags.victory||flags.defeat)return {fighter:f.id,frame:flags.victory?29:26,x:0,y:0,flash:false};let frame=idleFrame(a.fighter,t),x=0,y=Math.sin(t*.005)*.35,flash=false;
 if(flags.victory){frame=29;y=0}
 else if(act){const m=move(a.fighter,act.move),age=Math.max(0,t-act.start),i=m.impact,from=act.from??{frame:0,x:0,y:0};
  const times=m.super?[0,95,280,i,i+170,1050,m.duration]:[0,i*.28,i*.65,i,i+90,m.duration*.79,m.duration];
  const cells=m.super?[from.frame,27,f.id==='brick'?28:f.id==='iris'?14:8,f.id==='brick'?21:28,f.id==='nova'?10:22,5,0]:[from.frame,m.row*6+1,m.row*6+2,m.row*6+3,m.row*6+4,m.row*6+5,0];
  let k=0;while(k<times.length-1&&age>=times[k+1])k++;frame=cells[k];
  if(age<50){const w=smooth(age/50);x=lerp(from.x,0,w);y=lerp(from.y,0,w)}
  const drive=age<i?lerp(0,m.drive,smooth(age/i)):age<i+100?m.drive:lerp(m.drive,0,smooth((age-i-100)/(m.duration-i-100)));x+=drive;
  if(m.super){const lift=f.id==='brick'?(age<250?0:Math.sin(Math.PI*clamp((age-250)/250,0,1))*20):age<280?0:age<500?lerp(0,24,smooth((age-280)/220)):age<690?lerp(24,0,smooth((age-500)/190)):0;y-=lift;flash=age>=i&&age<i+170}
  if(age>=m.duration){frame=act.series&&!act.finish&&act.series.clean&&age<1250?m.row*6+5:0;x=0;y=Math.sin(t*.005)*.35}
 }
 if(a.guardBlend?.to&&(!act||t>=act.start+move(a.fighter,act.move).duration)){const b=a.guardBlend,age=t-b.at;frame=age<32?b.from.frame:age<72?2:b.key==='H'?2:24;x=lerp(b.from.x,0,smooth(age/110))}
 if(a.defence&&t<a.defence.end){const d=a.defence,age=t-d.start,w=age<75?smooth(age/75):1-smooth((age-170)/160);frame=age<25?d.from.frame:age<270?25:0;x=age<75?lerp(d.from.x,-7,smooth(age/75)):age<170?-7:lerp(-7,0,smooth((age-170)/160));y=lerp(d.from.y,0,smooth(age/75))}
 if(a.hit&&t<a.hit.end){const h=a.hit,age=t-h.start,w=age<55?smooth(age/55):1-smooth((age-55)/(h.end-h.start-55));frame=age<22?h.from.frame:age<h.end-h.start-80?26:24;x=age<55?lerp(h.from.x,-8,smooth(age/55)):lerp(-8,0,smooth((age-55)/(h.end-h.start-55)));y=0}
 if(flags.warning&&!act&&!a.hit&&!a.defence){frame=2;x=-2}
 return {fighter:f.id,frame:clamp(frame,0,35),x,y,flash};
}
function contact(a,t){const m=move(a.fighter,a.action?.move??'jab'),v=visual(a,t);return {x:v.x+m.contact.x,y:v.y+m.contact.y}}
return {roster,get,move,visual,contact,rows};
})();
