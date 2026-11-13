/* BREAKLINE AFTERHOURS. One audible beat, three decisions: hand, foot, defence. */
const CoreRules=(()=>{
'use strict';
const BEAT=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIFFICULTIES=Object.freeze({
 rookie:{name:'РАЗОГРЕВ',perfect:85,good:145,hp:150,enemyHP:220,damage:15,repeats:3,intervals:[4,4,4,4,3,1,4,4]},
 fighter:{name:'ДУЭЛЬ',perfect:65,good:120,hp:140,enemyHP:290,damage:19,repeats:2,intervals:[4,4,3,1,4,4,3,1]},
 master:{name:'МАСТЕР',perfect:45,good:95,hp:120,enemyHP:350,damage:23,repeats:2,intervals:[3,1,4,2,2,3,1,4]}
});
const RECIPES=CoreFighters.get('nova').recipes,trie=CoreFighters.get('nova').trie,prefixMoves=CoreFighters.get('nova').prefix;
function error(at){return at-Math.round(at/BEAT)*BEAT}
function grade(at,difficulty='fighter'){const d=DIFFICULTIES[difficulty]??DIFFICULTIES.fighter,e=Math.abs(error(at));return e<=d.perfect?'PERFECT':e<=d.good?'GOOD':'OFF'}
function create(hooks={}){
 let serial=0;const actor=(x,facing,hp,fighter='nova')=>({x,facing,fighter,hp,maxHP:hp,action:null,ready:0,stun:0,hit:null,defence:null,guardBlend:null});
 const s={fighterId:'nova',super:0,training:false,mode:'idle',difficulty:'rookie',now:0,start:0,end:0,player:actor(137,1,150),enemy:actor(221,-1,220),energy:0,level:1,phase:1,series:null,buffer:null,block:false,incoming:null,enemyIndex:0,guard:null,repeat:{key:null,count:0},counterUntil:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],history:[],events:[],lastStep:0,lastEarned:0,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,attempts:0,supers:0,guarded:0,interrupts:0,lateThreats:0},fills:0};
 const emit=(name,...args)=>hooks[name]?.(...args),profile=()=>DIFFICULTIES[s.difficulty],book=()=>CoreFighters.get(s.fighterId);
 function charge(amount,t){s.super=clamp(s.super+amount,0,100)}
 function record(type,t,extra={}){s.events.push({id:++serial,type,t,...extra});if(s.events.length>128)s.events.shift()}
 function message(label,detail,t,kind='good'){s.feedback={label,detail,at:t,kind}}
 function energy(delta,t){s.energy=clamp(s.energy+delta,0,100);const level=Math.min(5,1+Math.floor(s.energy/20));if(level!==s.level){s.level=level;s.stats.maxLevel=Math.max(s.stats.maxLevel,level);emit('level',level)}if(delta>0)s.lastEarned=t}
 function rival(){return CoreFighters.rivals[s.enemy.fighter]}
 function interval(index,signature=false){const r=rival(),minimum=s.difficulty==='rookie'?3:s.difficulty==='fighter'?2:1,raw=r.cadence[index%r.cadence.length]-(s.phase===3?1:0);return Math.max(signature?2:minimum,raw)}
 function plan(beatAt){
  const index=s.enemyIndex++,r=rival(),f=CoreFighters.get(s.enemy.fighter),signature=!s.training&&index%r.signatureEvery===r.signatureEvery-1,signatureMove=Object.values(f.recipes)[f.id==='brick'?1:2].move;
  s.incoming={id:++serial,beatAt,contactAt:beatAt+115,signature,move:signature?signatureMove:r.moves[index%r.moves.length],started:false,resolved:false,cancelled:false,double:interval(index,signature)===1,warned:false};
 }
 function reset(now,difficulty=s.difficulty,fighterId=s.fighterId,training=false){
  s.difficulty=DIFFICULTIES[difficulty]?difficulty:'rookie';const d=profile(),f=CoreFighters.get(fighterId),ids=Object.keys(CoreFighters.roster),enemyId=ids[(ids.indexOf(f.id)+1)%ids.length],enemy=CoreFighters.get(enemyId),start=(Math.floor(now/BEAT)+1)*BEAT+3*BEAT;
  Object.assign(s,{fighterId:f.id,super:0,training,mode:'fight',now,start,end:start+45000,player:actor(137,1,Math.round(d.hp*f.hp),f.id),enemy:actor(221,-1,Math.round(d.enemyHP*enemy.hp),enemyId),energy:0,level:1,phase:1,series:null,buffer:null,block:false,incoming:null,enemyIndex:0,guard:null,repeat:{key:null,count:0},counterUntil:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],history:[],events:[],lastStep:now,lastEarned:now,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,attempts:0,supers:0,guarded:0,interrupts:0,lateThreats:0},fills:0});
  plan(start+7*BEAT);emit('level',1);return s;
 }
 function getGuard(t){if(s.incoming&&!s.incoming.cancelled&&!s.incoming.resolved&&t>s.incoming.beatAt-180)return null;return s.guard&&t>=s.guard.start&&t<s.guard.end?s.guard.key:null}
 function warning(t){return s.incoming&&!s.incoming.resolved&&!s.incoming.cancelled&&t>=s.incoming.beatAt-700&&t<s.incoming.contactAt}
 function getPose(a,t){return CoreFighters.visual(a,t,{warning:a===s.enemy&&warning(t),victory:s.mode==='result'&&((a===s.player&&s.winner==='player')||(a===s.enemy&&s.winner==='enemy')),defeat:(s.mode==='result'||s.mode==='ending'&&(!a.hit||t>=a.hit.end))&&((a===s.player&&s.winner==='enemy')||(a===s.enemy&&s.winner==='player'))})}
 function action(a,move,t,meta={}){const from={...getPose(a,t),...CoreFighters.velocity(a,t)};a.hit=null;a.defence=null;a.guardBlend=null;a.action={id:++serial,move,start:t,from,resolved:false,...meta};a.ready=t+CoreFighters.move(a.fighter,move).recovery;return a.action}
 function breakSeries(){s.series=null}
 function input(key,at,executionAt=at){
  if(s.mode!=='fight'||at<s.start)return {accepted:false,reason:'countdown'};
  if(!['L','H','S'].includes(key))return {accepted:false,reason:'input'};
  const p=s.player;if(executionAt-at>110)return {accepted:false,reason:'stale'};if(at<p.ready-80)return {accepted:false,reason:'recovery'};if(at<p.stun||p.defence&&at<p.defence.start+240)return {accepted:false,reason:'defence'};
  if(executionAt<p.ready){if(p.ready-at<=80&&!s.buffer){s.buffer={key,at};return {accepted:false,buffered:true}}return {accepted:false,reason:'recovery'}}
  if(key==='S'&&s.super<100)return {accepted:false,reason:'super'};
  s.buffer=null;s.block=false;const quality=grade(at,s.difficulty);let move,series=null,finish=null,standalone=false;
  if(key==='S'){if(quality==='OFF'){message('СУПЕР В РИТМ','ЗАРЯД СОХРАНЁН',executionAt,'off');return {accepted:false,reason:'rhythm'}}charge(-100,executionAt);breakSeries();move=book().superMove;emit('superCharge',s.fighterId);record('superStart',executionAt)}
  else{
   let previous=s.series;if(previous&&at-previous.lastInput>1250){breakSeries();previous=null}
   if(quality==='OFF'){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}
   else if(previous){const node=previous.node[key];if(!node){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}else{previous.prefix+=key;previous.node=node;previous.lastInput=at;previous.steps++;previous.allPerfect&&=quality==='PERFECT';series=previous;finish=node.finish;move=finish?.move??book().prefix[previous.prefix]}}
   else if(book().trie[key]){series={id:++serial,prefix:key,node:book().trie[key],lastInput:at,steps:1,confirmed:0,clean:true,allPerfect:quality==='PERFECT'};s.series=series;move=book().prefix[key]}else{standalone=true;move='bodyKick'}
  }
  const counter=executionAt<s.counterUntil&&quality!=='OFF';if(counter){s.counterUntil=0;if(!finish&&key==='L')move='cross'}
  const strong=!!finish||key==='S',a=action(p,move,executionAt,{key,inputAt:at,quality,strong,super:key==='S',finish,series,seriesStep:series?.steps??0,standalone,counter});
  s.stats[quality.toLowerCase()]++;if(quality==='OFF'){s.streak=0;energy(-5,executionAt);message('МИМО РИТМА',error(at)>0?'ЧУТЬ РАНЬШЕ':'ЧУТЬ ПОЗЖЕ',executionAt,'off');emit('sfx','off')}else {s.streak++;message(quality,Math.round(error(at))+' ms',executionAt,quality==='PERFECT'?'perfect':'good');emit('sfx','swing');emit('sfx',key==='H'?'kickAccent':'handAccent')}
  if(key==='S')message(book().superName,'СУПЕР · '+book().name,executionAt,'super');
  s.history.push({id:a.id,key,move,prefix:series?.prefix??'',quality,strong,counter,standalone,inputAt:at,start:executionAt});if(s.history.length>120)s.history.shift();if(finish)breakSeries();return {accepted:true,action:a};
 }
 function defend(at,executionAt=at){
  const p=s.player;if(s.mode!=='fight'||at<s.start||executionAt-at>110||at<p.stun||p.defence&&at<p.defence.start+300)return false;
  const from={...getPose(p,executionAt),...CoreFighters.velocity(p,executionAt)};p.defence={start:executionAt,end:executionAt+330,from,quality:grade(at,s.difficulty),beat:Math.round(at/BEAT),used:false,savedSeries:s.series};p.guardBlend=null;p.action=null;p.hit=null;s.buffer=null;breakSeries();s.block=true;emit('sfx','dodge');return true;
 }
 function release(t){s.block=false;const p=s.player;if(p.guardBlend?.to)p.guardBlend={from:getPose(p,t),at:t,to:false}}
 function setBlock(value,t){if(value){s.block=true}else release(t)}
 function react(a,t,strong,move='jab'){const from={...getPose(a,t),...CoreFighters.velocity(a,t)};if(a===s.player||strong)a.action=null;a.guardBlend=null;a.defence=null;a.hit={start:t,end:t+(strong?350:230),from,keepAttack:a===s.enemy&&!strong&&a.action?.enemyPending&&!a.action.resolved};a.stun=Math.max(a.stun,t+(strong?180:105))}
 function burst(x,y,t,strong,kind='hit'){for(let i=0;i<(strong?16:8);i++){const a=i*2.399;s.particles.push({x,y,vx:Math.cos(a)*(strong?140:80),vy:Math.sin(a)*85-35,at:t,strong,kind})}if(s.particles.length>48)s.particles.splice(0,s.particles.length-48)}
 function playerImpact(a,t){
  if(a.quality==='OFF'){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();return}
  const e=s.enemy,p=s.player,point=CoreFighters.contact(p,t),worldX=p.x+point.x;
  if(e.hp<=0)return;
  if(Math.abs(e.x-worldX)>32||point.y>-45||point.y<-153){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();energy(-3,t);record('miss',t);return}
  const blocked=getGuard(t)===a.key&&!a.strong&&!a.counter;
  if(blocked){s.stats.guarded++;e.hp=Math.max(s.training?1:0,e.hp-1);if(a.series)a.series.clean=false;s.streak=0;message('ЗАЩИТА',a.key==='L'?'СМЕНИ НА НОГУ':'СМЕНИ НА РУКУ',t,'guard');burst(worldX,point.y,t,false,'guard');emit('sfx','block');record('guarded',t,{key:a.key});return}
  const clean=!!(a.series&&a.series.clean&&a.series.confirmed===a.seriesStep-1),guardBreak=!!(getGuard(t)&&a.strong);
  const amount=(a.key==='S'?book().superDamage:a.finish?a.finish.damage:(a.key==='H'?11:9)*book().power)*(a.quality==='PERFECT'?1:.8)*(a.counter?1.45:1);
  e.hp=Math.max(s.training?1:0,e.hp-amount);s.stats.score+=Math.round(amount*10*(1+Math.min(s.streak,20)*.025));energy(a.quality==='PERFECT'?5:2,t);if(!a.super)charge(a.quality==='PERFECT'?8:4,t);
  if(a.series){a.series.confirmed++;a.series.clean=clean}
  if(a.key!=='S'&&!s.training){s.repeat=s.repeat.key===a.key?{key:a.key,count:s.repeat.count+1}:{key:a.key,count:1};if(s.repeat.count>=profile().repeats&&t>s.start+3500){s.guard={key:a.key,start:t+170,end:t+170+BEAT*rival().guardBeats};s.repeat.count=0}}
  if(a.counter){s.stats.counters++;energy(4,t);charge(8,t);message('КОНТРА','×1.45 УРОН',t,'counter')}
  react(e,t,a.strong,a.move);
  if(a.strong){
   if(warning(t)){s.incoming.cancelled=true;s.stats.interrupts++;record('interrupt',t)}
   const attacker=getPose(p,t),defender={...getPose(e,t),frame:26,x:-8,y:0},stop=a.super?110:85;a.visualStop={at:t,duration:stop};e.hit.from=defender;e.hit.start+=stop;e.hit.end+=stop;s.freeze={until:t+stop,at:t,player:attacker,enemy:defender};s.flash=t+100;
   if(guardBreak){s.guard=null;message('BREAK','ЗАЩИТА СЛОМАНА',t,'counter')}
  }
  burst(worldX,point.y,t,a.strong,a.counter?'counter':'hit');if(a.super){s.stats.supers++;message(book().superName,'СУПЕР ПОПАДАНИЕ',t,'super');emit('superHit',s.fighterId);record('super',t)}else emit('sfx',a.counter?'counter':'hit',a.strong);
  if(a.finish&&clean&&a.series.confirmed===a.series.steps){
   const fresh=!s.stats.variety.includes(a.finish.recipe);if(fresh)s.stats.variety.push(a.finish.recipe);s.stats.combos++;energy(fresh?14:10,t);charge(14,t);record('combo',t,{recipe:a.finish.recipe,quality:a.series.allPerfect?'PERFECT':'GOOD'});s.stats.score+=fresh?300:180;
   message(a.finish.name,a.series.allPerfect?'ЧИСТОЕ КОМБО · МУЗЫКАЛЬНЫЙ ОТВЕТ':fresh?'НОВЫЙ ФИНАЛ':'КОМБО',t,'combo');
   if(a.series.allPerfect){s.fills++;emit('fill',a.series.id,true)}
  }
  record('hit',t,{damage:amount,key:a.key,quality:a.quality,strong:a.strong,counter:a.counter,finish:a.finish?.recipe});
 }
 function enemyImpact(incoming,t){
  const p=s.player;p.hit=null;s.stats.attempts++;const d=p.defence;
  if(d&&!d.used&&d.beat===Math.round(incoming.beatAt/BEAT)&&d.quality!=='OFF'&&d.start<=t&&d.end>=t){
   d.used=true;if(d.savedSeries&&!s.series&&!p.action){s.series=d.savedSeries;s.series.lastInput=incoming.beatAt;s.series.allPerfect&&=d.quality==='PERFECT'}s.stats.dodges++;const perfect=d.quality==='PERFECT';energy(perfect?8:4,t);charge(perfect?12:6,t);s.counterUntil=perfect?t+1050:0;s.stats.score+=perfect?180:90;message(perfect?'ИДЕАЛЬНЫЙ УХОД':'УХОД',perfect?'ТВОЯ КОНТРА →':'ЧИСТО',t,perfect?'counter':'good');emit('sfx',perfect?'counterReady':'dodge');record('dodge',t,{quality:d.quality});return;
  }
  if(s.block&&t>=p.stun){p.hp=Math.max(s.training?1:0,p.hp-4);s.stats.blocks++;message('БЛОК','УДЕРЖАНИЕ ЗАЩИЩАЕТ · ТОЧНЫЙ ТАП ДАЁТ КОНТРУ',t,'guard');emit('sfx','block');record('block',t);return}
  const damage=profile().damage+(incoming.double?2:0)+(incoming.signature?4:0);const armoured=p.action?.super&&!p.action.resolved;p.hp=Math.max(s.training?1:0,p.hp-(armoured?Math.ceil(damage*.5):damage));if(armoured){message('БРОНЯ','СУПЕР ПРОДОЛЖАЕТСЯ',t,'counter');emit('sfx','block');record('armour',t);return}s.stats.taken++;s.streak=0;energy(-9,t);charge(-6,t);breakSeries();s.buffer=null;react(p,t,!!incoming.signature,incoming.move);if(incoming.signature){const defender={...getPose(p,t),frame:26,x:-8,y:0};if(s.enemy.action)s.enemy.action.visualStop={at:t,duration:85};p.hit.from=defender;p.hit.start+=85;p.hit.end+=85;s.freeze={at:t,until:t+85,player:defender,enemy:getPose(s.enemy,t)};s.flash=t+100}p.ready=Math.max(p.ready,t+160);message('ПОПАДАНИЕ','КРАСНАЯ ДОЛЯ → УХОД',t,'hurt');burst(p.x+5,-104,t,false,'enemy');emit('sfx','hit',!!incoming.signature);record('hurt',t,{damage});
 }
 function finish(t){if(s.mode!=='fight')return;s.mode='ending';s.resultAt=t+650;s.block=false;s.buffer=null;breakSeries();s.winner=s.enemy.hp<=0?'player':s.player.hp<=0?'enemy':s.player.hp/s.player.maxHP>s.enemy.hp/s.enemy.maxHP?'player':'enemy';s.stats.time=Math.max(0,t-s.start);if(s.winner==='player'){s.stats.winBonus=1200+Math.round(Math.max(0,s.end-t)/1000)*20;s.stats.score+=s.stats.winBonus}s.rating=rating();}
 function rating(){const st=s.stats,n=st.perfect+st.good+st.off,accuracy=n?(st.perfect+st.good*.7)/n:0,defence=st.attempts?(st.dodges+st.blocks*.35)/st.attempts:0,points=accuracy*55+defence*20+st.variety.length/3*15+s.player.hp/s.player.maxHP*10;return {rank:points>=92?'S':points>=80?'A':points>=65?'B':points>=45?'C':'D',value:Math.round(points),accuracy:Math.round(accuracy*100)}}
 function review(){
  const st=s.stats,n=st.perfect+st.good+st.off,accuracy=n?(st.perfect+st.good*.7)/n:0;
  if(n<4||accuracy<.65)return {title:'СНАЧАЛА — ДОЛЯ',detail:'Слушай бочку и нажимай в момент удара. Между долями дополнительный ввод не помогает.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · 8 из 10 атак без OFF'};
  if(st.attempts>=3&&st.dodges<st.attempts*.4)return {title:'ПРОЧИТАЙ СОПЕРНИКА',detail:CoreFighters.get(s.enemy.fighter).name+' предупреждает об атаке красной долей. Точный тап УХОД сохраняет здоровье и открывает контрудар.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · 3 точных ухода'};
  if(st.variety.length<3){const recipe=Object.keys(book().recipes).find(r=>!st.variety.includes(r));return {title:st.guarded?'СМЕНИ ТРАЕКТОРИЮ':'ДОБАВЬ НОВЫЙ ФИНАЛ',detail:'Попробуй '+recipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · ')+'. После финала пропусти долю; уход остаётся доступным.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · все 3 разных финала'}}
  if(!st.supers)return {title:'ПРЕВРАТИ РИТМ В СУПЕР',detail:'Чистые попадания, комбо и уходы наполняют отдельный заряд. На 100% нажми СУПЕР в долю.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · одно попадание супером'};
  if(s.difficulty!=='master'&&s.winner==='player')return {title:'ТВОЙ СЛЕДУЮЩИЙ УРОВЕНЬ',detail:'Ты используешь весь набор. На следующей сложности окна точности уже, а соперник сильнее.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · победа на следующей сложности'};
  return {title:'ЧИЩЕ. СМЕЛЕЕ. В РИТМ.',detail:'Сохрани три разных финала и контрудары, уменьшая число полученных попаданий.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · ранг S на Мастере'};
 }
 function step(t){
  const dt=clamp(t-s.lastStep,0,50);s.lastStep=t;s.now=t;
  if(s.mode==='ending'&&t>=s.resultAt){s.mode='result';emit('finish',s.winner,s.stats,s.rating)}if(s.mode!=='fight'||t<s.start)return;
  if(!s.training&&t>=s.end){finish(t);return}
  if(t-s.lastEarned>2200)energy(-dt*.003,t);
  const phase=s.enemy.hp/s.enemy.maxHP>.66?1:s.enemy.hp/s.enemy.maxHP>.33?2:3;if(phase!==s.phase){s.phase=phase;record('phase',t,{phase})}
  if(s.series&&t-s.series.lastInput>1250)breakSeries();
  if(s.buffer&&t>=s.player.ready){const b=s.buffer;s.buffer=null;if(t-b.at<=110)input(b.key,b.at,t)}
  // A long foreground stall must not burst several unheard threats on recovery.
  if(s.incoming&&!s.incoming.resolved&&t-s.incoming.contactAt>200){s.incoming.resolved=true;s.incoming.cancelled=true;s.stats.lateThreats++;record('lateThreat',t);if(s.enemy.action?.enemyPending)s.enemy.action=null;plan((Math.ceil(t/BEAT)+2)*BEAT)}
  const inc=s.incoming;
  if(inc&&!inc.resolved){
   if(warning(t)&&!inc.warned){inc.warned=true;emit('warning',inc.beatAt);record('warning',t)}
   if(!inc.cancelled&&!inc.started&&t>=inc.contactAt-CoreFighters.move(s.enemy.fighter,inc.move).impact){const start=inc.contactAt-CoreFighters.move(s.enemy.fighter,inc.move).impact,from=getPose(s.enemy,start);inc.started=true;action(s.enemy,inc.move,start,{enemyPending:true,strong:inc.signature,from})}
  }
  const due=[];const a=s.player.action;if(a&&!a.resolved&&t>=a.start+CoreFighters.move(s.player.fighter,a.move).impact)due.push({t:a.start+CoreFighters.move(s.player.fighter,a.move).impact,type:'player',a});
  if(inc&&!inc.resolved&&t>=inc.contactAt)due.push({t:inc.contactAt,type:'enemy',a:inc});
  due.sort((a,b)=>a.t-b.t);for(const event of due){if(event.type==='player'){if(s.player.action!==event.a)continue;event.a.resolved=true;playerImpact(event.a,event.t)}else {inc.resolved=true;if(s.enemy.action?.enemyPending)s.enemy.action.resolved=true;if(!inc.cancelled&&s.enemy.hp>0)enemyImpact(inc,event.t);const gap=s.training?profile().intervals[(s.enemyIndex-1)%profile().intervals.length]:interval(s.enemyIndex-1,inc.signature);plan(inc.beatAt+gap*BEAT)}}
  if(!s.training&&(s.enemy.hp<=0||s.player.hp<=0)){finish(t);return}
  const guardKey=getGuard(t);if(s.enemy.guardKey!==guardKey&&!(s.enemy.action?.enemyPending&&!s.enemy.action.resolved)&&!s.enemy.hit){const from=getPose(s.enemy,t);s.enemy.guardBlend={from,at:t,to:!!guardKey,key:guardKey};s.enemy.guardKey=guardKey}
  const p=s.player;if(s.block&&(!p.defence||t>=p.defence.end)&&!p.guardBlend?.to){p.guardBlend={from:getPose(p,t),at:t,to:true}}
  if(s.enemy.hit&&t>=s.enemy.hit.end)s.enemy.hit=null;
  if(s.freeze&&t>s.freeze.until)s.freeze=null;s.particles=s.particles.filter(p=>t-p.at<440);s.trails=s.trails.filter(p=>t-p.at<145);
 }
 return {s,reset,step,charge,book,input,defend,release,setBlock,energy,grade:at=>grade(at,s.difficulty),getPose,getGuard,warning,action,playerImpact,enemyImpact,rating,review,rival,interval};
}
return {create,grade,error,RECIPES,trie,prefixMoves,DIFFICULTIES,BEAT};
})();
