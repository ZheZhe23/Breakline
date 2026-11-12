/* BREAKLINE AFTERHOURS. One audible beat, three decisions: hand, foot, defence. */
const CoreRules=(()=>{
'use strict';
const BEAT=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIFFICULTIES=Object.freeze({
 rookie:{name:'РАЗОГРЕВ',perfect:85,good:145,hp:150,enemyHP:220,damage:15,repeats:3,intervals:[4,4,4,4,3,1,4,4]},
 fighter:{name:'ДУЭЛЬ',perfect:65,good:120,hp:140,enemyHP:290,damage:19,repeats:2,intervals:[4,4,3,1,4,4,3,1]},
 master:{name:'МАСТЕР',perfect:45,good:95,hp:120,enemyHP:350,damage:23,repeats:2,intervals:[3,1,4,2,2,3,1,4]}
});
const RECIPES=Object.freeze({LLL:{move:'uppercut',name:'АППЕРКОТ',damage:25},LLH:{move:'frontKick',name:'ПРОБИВНОЙ',damage:27},LHLH:{move:'spinKick',name:'РАЗВОРОТ',damage:37}});
const trie={};for(const [text,finish]of Object.entries(RECIPES)){let n=trie;for(const k of text)n=n[k]??(n[k]={});n.finish={...finish,recipe:text}}
const prefixMoves={L:'jab',LL:'cross',LH:'bodyKick',LHL:'hook'};
function error(at){return at-Math.round(at/BEAT)*BEAT}
function grade(at,difficulty='fighter'){const d=DIFFICULTIES[difficulty]??DIFFICULTIES.fighter,e=Math.abs(error(at));return e<=d.perfect?'PERFECT':e<=d.good?'GOOD':'OFF'}
function create(hooks={}){
 let serial=0;const actor=(x,facing,hp)=>({x,facing,hp,maxHP:hp,action:null,ready:0,stun:0,hit:null,defence:null,guardBlend:null});
 const s={mode:'idle',difficulty:'rookie',now:0,start:0,end:0,player:actor(137,1,150),enemy:actor(221,-1,220),energy:0,level:1,phase:1,series:null,buffer:null,block:false,incoming:null,enemyIndex:0,guard:null,repeat:{key:null,count:0},counterUntil:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],history:[],events:[],lastStep:0,lastEarned:0,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,attempts:0},fills:0};
 const emit=(name,...args)=>hooks[name]?.(...args),profile=()=>DIFFICULTIES[s.difficulty];
 function record(type,t,extra={}){s.events.push({type,t,...extra});if(s.events.length>128)s.events.shift()}
 function message(label,detail,t,kind='good'){s.feedback={label,detail,at:t,kind}}
 function energy(delta,t){s.energy=clamp(s.energy+delta,0,100);const level=Math.min(5,1+Math.floor(s.energy/20));if(level!==s.level){s.level=level;s.stats.maxLevel=Math.max(s.stats.maxLevel,level);emit('level',level)}if(delta>0)s.lastEarned=t}
 function plan(beatAt){const index=s.enemyIndex++,double=s.enemyIndex>4&&profile().intervals[index%profile().intervals.length]===1;s.incoming={id:++serial,beatAt,contactAt:beatAt+115,move:index%3===1?'bodyKick':index%3===2?'hook':'cross',started:false,resolved:false,cancelled:false,double,warned:false};}
 function reset(now,difficulty=s.difficulty){
  s.difficulty=DIFFICULTIES[difficulty]?difficulty:'rookie';const d=profile(),start=(Math.floor(now/BEAT)+1)*BEAT+3*BEAT;
  Object.assign(s,{mode:'fight',now,start,end:start+45000,player:actor(137,1,d.hp),enemy:actor(221,-1,d.enemyHP),energy:0,level:1,phase:1,series:null,buffer:null,block:false,incoming:null,enemyIndex:0,guard:null,repeat:{key:null,count:0},counterUntil:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],history:[],events:[],lastStep:now,lastEarned:now,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,attempts:0},fills:0});
  plan(start+7*BEAT);emit('level',1);return s;
 }
 function getGuard(t){if(s.incoming&&!s.incoming.cancelled&&!s.incoming.resolved&&t>s.incoming.beatAt-180)return null;return s.guard&&t>=s.guard.start&&t<s.guard.end?s.guard.key:null}
 function warning(t){return s.incoming&&!s.incoming.resolved&&!s.incoming.cancelled&&t>=s.incoming.beatAt-700&&t<s.incoming.contactAt}
 function defencePose(){return CoreRig.pose({hip:[-13,-60],spine:[-.15,-.22,-.10],lh:[18,-119],rh:[1,-122],lf:[24,-2],rf:[-31,-2],turn:-.18})}
 function guardPose(key='L'){return CoreRig.pose({hip:[-2,-70],spine:[-.06,-.06,-.02],lh:key==='L'?[24,-137]:[25,-103],rh:key==='L'?[9,-138]:[9,-109]})}
 function getPose(a,t){
  let p=CoreRig.sample(a.action,t);
  if(a===s.enemy&&warning(t)&&!s.incoming.started){const wind=CoreRig.pose({hip:[-4,-70],spine:[-.05,-.11,-.04],lh:[23,-126],rh:[4,-130],lf:s.incoming.move==='bodyKick'?[28,-14]:[28,-2],turn:-.18});p=CoreRig.mix(p,wind,CoreRig.smooth((t-s.incoming.beatAt+650)/350)*.7)}
  if(a.guardBlend){const b=a.guardBlend;if(b.to){p=CoreRig.mix(b.from,guardPose(a===s.enemy?(b.key??'L'):'L'),CoreRig.smooth((t-b.at)/110))}else if(t<b.at+140)p=CoreRig.mix(b.from,p,CoreRig.smooth((t-b.at)/140))}
  if(a.defence&&t<a.defence.end){const d=a.defence,age=t-d.start,w=age<75?CoreRig.smooth(age/75):1-CoreRig.smooth((age-150)/180);p=CoreRig.mix(d.from,defencePose(),w)}
  if(a.hit&&t<a.hit.end){const h=a.hit,age=t-h.start,w=age<55?CoreRig.smooth(age/55):1-CoreRig.smooth((age-55)/(h.end-h.start-55));p=CoreRig.mix(age<55?h.from:p,h.target,w)}
  return p;
 }
 function action(a,move,t,meta={}){const from=getPose(a,t);a.hit=null;a.defence=null;a.guardBlend=null;a.action={id:++serial,move,start:t,from,resolved:false,...meta};a.ready=t+CoreRig.moves[move].recovery;return a.action}
 function breakSeries(){s.series=null}
 function input(key,at,executionAt=at){
  if(s.mode!=='fight'||at<s.start)return {accepted:false,reason:'countdown'};
  if(!['L','H','S'].includes(key))return {accepted:false,reason:'input'};
  const p=s.player;if(executionAt-at>110)return {accepted:false,reason:'stale'};if(at<p.ready-80)return {accepted:false,reason:'recovery'};if(at<p.stun||p.defence&&at<p.defence.start+240)return {accepted:false,reason:'defence'};
  if(executionAt<p.ready){if(p.ready-at<=80&&!s.buffer){s.buffer={key,at};return {accepted:false,buffered:true}}return {accepted:false,reason:'recovery'}}
  if(key==='S'&&s.energy<40)return {accepted:false,reason:'energy'};
  s.buffer=null;s.block=false;const quality=grade(at,s.difficulty);let move,series=null,finish=null,standalone=false;
  if(key==='S'){energy(-40,executionAt);breakSeries();move='knee'}
  else{
   let previous=s.series;if(previous&&at-previous.lastInput>1250){breakSeries();previous=null}
   if(quality==='OFF'){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}
   else if(previous){const node=previous.node[key];if(!node){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}else{previous.prefix+=key;previous.node=node;previous.lastInput=at;previous.steps++;previous.allPerfect&&=quality==='PERFECT';series=previous;finish=node.finish;move=finish?.move??prefixMoves[previous.prefix]}}
   else if(key==='L'){series={id:++serial,prefix:'L',node:trie.L,lastInput:at,steps:1,confirmed:0,clean:true,allPerfect:quality==='PERFECT'};s.series=series;move='jab'}else{standalone=true;move='bodyKick'}
  }
  const counter=executionAt<s.counterUntil&&quality!=='OFF';if(counter){s.counterUntil=0;if(!finish&&key==='L')move='cross'}
  const strong=!!finish||key==='S',a=action(p,move,executionAt,{key,inputAt:at,quality,strong,finish,series,seriesStep:series?.steps??0,standalone,counter});
  s.stats[quality.toLowerCase()]++;if(quality==='OFF'){s.streak=0;energy(-5,executionAt);message('МИМО РИТМА',error(at)>0?'ЧУТЬ РАНЬШЕ':'ЧУТЬ ПОЗЖЕ',executionAt,'off');emit('sfx','off')}else {s.streak++;message(quality,Math.round(error(at))+' ms',executionAt,quality==='PERFECT'?'perfect':'good');emit('sfx','swing');emit('sfx',key==='H'?'kickAccent':'handAccent')}
  s.history.push({id:a.id,key,move,prefix:series?.prefix??'',quality,strong,counter,standalone,inputAt:at,start:executionAt});if(s.history.length>120)s.history.shift();if(finish)breakSeries();return {accepted:true,action:a};
 }
 function defend(at,executionAt=at){
  const p=s.player;if(s.mode!=='fight'||at<s.start||executionAt-at>110||at<p.stun||p.defence&&at<p.defence.start+300)return false;
  const from=getPose(p,executionAt);p.defence={start:executionAt,end:executionAt+330,from,quality:grade(at,s.difficulty),beat:Math.round(at/BEAT),used:false,savedSeries:s.series};p.guardBlend=null;p.action=null;p.hit=null;s.buffer=null;breakSeries();s.block=true;emit('sfx','dodge');return true;
 }
 function release(t){s.block=false;const p=s.player;if(p.guardBlend?.to)p.guardBlend={from:getPose(p,t),at:t,to:false}}
 function setBlock(value,t){if(value){s.block=true}else release(t)}
 function react(a,t,strong,move='jab'){
  const from=getPose(a,t);if(a===s.player||strong)a.action=null;a.guardBlend=null;a.defence=null;
  const target=move==='uppercut'?CoreRig.pose({hip:[-7,-74],spine:[-.1,-.27,-.2],lh:[-3,-117],rh:[-8,-119],lf:[21,-2],rf:[-33,-2]}):move==='frontKick'||move==='bodyKick'||move==='knee'?CoreRig.pose({hip:[-10,-63],spine:[.08,.24,.18],lh:[25,-101],rh:[11,-106],lf:[19,-2],rf:[-34,-2]}):CoreRig.pose({hip:[-9,-67],spine:[-.15,-.25,-.13],lh:[3,-112],rh:[-8,-120],lf:[23,-2],rf:[-32,-2],turn:-.35});
  a.hit={start:t,end:t+(strong?350:230),from,target};a.stun=Math.max(a.stun,t+(strong?180:105));
 }
 function burst(x,y,t,strong,kind='hit'){for(let i=0;i<(strong?16:8);i++){const a=i*2.399;s.particles.push({x,y,vx:Math.cos(a)*(strong?140:80),vy:Math.sin(a)*85-35,at:t,strong,kind})}if(s.particles.length>48)s.particles.splice(0,s.particles.length-48)}
 function playerImpact(a,t){
  if(a.quality==='OFF'){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();return}
  const e=s.enemy,p=s.player,sk=CoreRig.skeleton(getPose(p,t)),limb=sk.limbs[CoreRig.moves[a.move].limb],point=a.move==='knee'?limb.joint:limb.end,worldX=p.x+point[0];
  if(e.hp<=0)return;
  if(Math.abs(e.x-worldX)>32||point[1]>-45||point[1]<-153){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();energy(-3,t);record('miss',t);return}
  const blocked=getGuard(t)===a.key&&!a.strong&&!a.counter;
  if(blocked){e.hp=Math.max(0,e.hp-1);if(a.series)a.series.clean=false;s.streak=0;message('ЗАЩИТА',a.key==='L'?'СМЕНИ НА НОГУ':'СМЕНИ НА РУКУ',t,'guard');burst(worldX,point[1],t,false,'guard');emit('sfx','block');record('guarded',t,{key:a.key});return}
  const clean=!!(a.series&&a.series.clean&&a.series.confirmed===a.seriesStep-1),guardBreak=!!(getGuard(t)&&a.strong);
  const amount=(a.key==='S'?40:a.finish?a.finish.damage:a.key==='H'?11:9)*(a.quality==='PERFECT'?1:.8)*(a.counter?1.45:1);
  e.hp=Math.max(0,e.hp-amount);s.stats.score+=Math.round(amount*10*(1+Math.min(s.streak,20)*.025));energy(a.quality==='PERFECT'?5:2,t);
  if(a.series){a.series.confirmed++;a.series.clean=clean}
  if(a.key!=='S'){s.repeat=s.repeat.key===a.key?{key:a.key,count:s.repeat.count+1}:{key:a.key,count:1};if(s.repeat.count>=profile().repeats&&t>s.start+3500){s.guard={key:a.key,start:t+170,end:t+170+BEAT*3};s.repeat.count=0}}
  if(a.counter){s.stats.counters++;energy(4,t);message('КОНТРА','×1.45 УРОН',t,'counter')}
  react(e,t,a.strong,a.move);
  if(a.strong){
   if(warning(t)){s.incoming.cancelled=true;record('interrupt',t)}
   const attacker=CoreRig.skeleton(getPose(p,t)),defender=CoreRig.skeleton(getPose(e,t));e.hit.start+=85;e.hit.end+=85;s.freeze={until:t+85,at:t,player:attacker,enemy:defender};s.flash=t+100;
   if(guardBreak){s.guard=null;message('BREAK','ЗАЩИТА СЛОМАНА',t,'counter')}
  }
  burst(worldX,point[1],t,a.strong,a.counter?'counter':'hit');emit('sfx',a.counter?'counter':'hit',a.strong);
  if(a.finish&&clean&&a.series.confirmed===a.series.steps){
   const fresh=!s.stats.variety.includes(a.finish.recipe);if(fresh)s.stats.variety.push(a.finish.recipe);s.stats.combos++;energy(fresh?14:10,t);s.stats.score+=fresh?300:180;
   message(a.finish.name,a.series.allPerfect?'ЧИСТОЕ КОМБО · МУЗЫКАЛЬНЫЙ ОТВЕТ':fresh?'НОВЫЙ ФИНАЛ':'КОМБО',t,'combo');
   if(a.series.allPerfect){s.fills++;emit('fill',a.series.id,true)}
  }
  record('hit',t,{damage:amount,strong:a.strong,counter:a.counter,finish:a.finish?.recipe});
 }
 function enemyImpact(incoming,t){
  const p=s.player;p.hit=null;s.stats.attempts++;const d=p.defence;
  if(d&&!d.used&&d.beat===Math.round(incoming.beatAt/BEAT)&&d.quality!=='OFF'&&d.start<=t&&d.end>=t){
   d.used=true;if(d.savedSeries&&!s.series&&!p.action){s.series=d.savedSeries;s.series.lastInput=incoming.beatAt;s.series.allPerfect&&=d.quality==='PERFECT'}s.stats.dodges++;const perfect=d.quality==='PERFECT';energy(perfect?8:4,t);s.counterUntil=perfect?t+1050:0;s.stats.score+=perfect?180:90;message(perfect?'ИДЕАЛЬНЫЙ УХОД':'УХОД',perfect?'ТВОЯ КОНТРА →':'ЧИСТО',t,perfect?'counter':'good');emit('sfx',perfect?'counterReady':'dodge');record('dodge',t,{quality:d.quality});return;
  }
  if(s.block&&t>=p.stun){p.hp=Math.max(0,p.hp-4);s.stats.blocks++;message('БЛОК','УДЕРЖАНИЕ ЗАЩИЩАЕТ · ТОЧНЫЙ ТАП ДАЁТ КОНТРУ',t,'guard');emit('sfx','block');record('block',t);return}
  const damage=profile().damage+(incoming.double?2:0);p.hp=Math.max(0,p.hp-damage);s.stats.taken++;s.streak=0;energy(-9,t);breakSeries();s.buffer=null;react(p,t,false,incoming.move);p.ready=Math.max(p.ready,t+160);message('ПОПАДАНИЕ','КРАСНАЯ ДОЛЯ → УХОД',t,'hurt');burst(p.x+5,-104,t,false,'enemy');emit('sfx','hit');record('hurt',t,{damage});
 }
 function finish(t){if(s.mode!=='fight')return;s.mode='ending';s.resultAt=t+650;s.block=false;s.buffer=null;breakSeries();s.winner=s.enemy.hp<=0?'player':s.player.hp<=0?'enemy':s.player.hp/s.player.maxHP>s.enemy.hp/s.enemy.maxHP?'player':'enemy';s.stats.time=Math.max(0,t-s.start);if(s.winner==='player'){s.stats.winBonus=1200+Math.round(Math.max(0,s.end-t)/1000)*20;s.stats.score+=s.stats.winBonus}s.rating=rating();}
 function rating(){const st=s.stats,n=st.perfect+st.good+st.off,accuracy=n?(st.perfect+st.good*.7)/n:0,defence=st.attempts?(st.dodges+st.blocks*.35)/st.attempts:0,points=accuracy*55+defence*20+st.variety.length/3*15+s.player.hp/s.player.maxHP*10;return {rank:points>=92?'S':points>=80?'A':points>=65?'B':points>=45?'C':'D',value:Math.round(points),accuracy:Math.round(accuracy*100)}}
 function step(t){
  const dt=clamp(t-s.lastStep,0,50);s.lastStep=t;s.now=t;
  if(s.mode==='ending'&&t>=s.resultAt){s.mode='result';emit('finish',s.winner,s.stats,s.rating)}if(s.mode!=='fight'||t<s.start)return;
  if(t>=s.end){finish(t);return}
  if(t-s.lastEarned>2200)energy(-dt*.003,t);
  const phase=s.enemy.hp/s.enemy.maxHP>.66?1:s.enemy.hp/s.enemy.maxHP>.33?2:3;if(phase!==s.phase){s.phase=phase;record('phase',t,{phase})}
  if(s.series&&t-s.series.lastInput>1250)breakSeries();
  if(s.buffer&&t>=s.player.ready){const b=s.buffer;s.buffer=null;if(t-b.at<=110)input(b.key,b.at,t)}
  const inc=s.incoming;
  if(inc&&!inc.resolved){
   if(warning(t)&&!inc.warned){inc.warned=true;emit('warning',inc.beatAt);record('warning',t)}
   if(!inc.cancelled&&!inc.started&&t>=inc.contactAt-CoreRig.moves[inc.move].impact){const start=inc.contactAt-CoreRig.moves[inc.move].impact,from=getPose(s.enemy,start);inc.started=true;action(s.enemy,inc.move,start,{enemyPending:true,from})}
  }
  const due=[];const a=s.player.action;if(a&&!a.resolved&&t>=a.start+CoreRig.moves[a.move].impact)due.push({t:a.start+CoreRig.moves[a.move].impact,type:'player',a});
  if(inc&&!inc.resolved&&t>=inc.contactAt)due.push({t:inc.contactAt,type:'enemy',a:inc});
  due.sort((a,b)=>a.t-b.t);for(const event of due){if(event.type==='player'){if(s.player.action!==event.a)continue;event.a.resolved=true;playerImpact(event.a,event.t)}else {inc.resolved=true;if(s.enemy.action?.enemyPending)s.enemy.action.resolved=true;if(!inc.cancelled&&s.enemy.hp>0)enemyImpact(inc,event.t);const interval=profile().intervals[(s.enemyIndex-1)%profile().intervals.length];plan(inc.beatAt+interval*BEAT)}}
  if(s.enemy.hp<=0||s.player.hp<=0){finish(t);return}
  const guardKey=getGuard(t);if(s.enemy.guardKey!==guardKey&&!(s.enemy.action?.enemyPending&&!s.enemy.action.resolved)&&!s.enemy.hit){const from=getPose(s.enemy,t);s.enemy.guardBlend={from,at:t,to:!!guardKey,key:guardKey};s.enemy.guardKey=guardKey}
  const p=s.player;if(s.block&&(!p.defence||t>=p.defence.end)&&!p.guardBlend?.to){p.guardBlend={from:getPose(p,t),at:t,to:true}}
  if(s.enemy.hit&&t>=s.enemy.hit.end)s.enemy.hit=null;
  if(s.freeze&&t>s.freeze.until)s.freeze=null;s.particles=s.particles.filter(p=>t-p.at<440);s.trails=s.trails.filter(p=>t-p.at<145);
 }
 return {s,reset,step,input,defend,release,setBlock,energy,grade:at=>grade(at,s.difficulty),getPose,getGuard,warning,action,playerImpact,enemyImpact,rating};
}
return {create,grade,error,RECIPES,trie,prefixMoves,DIFFICULTIES,BEAT};
})();
