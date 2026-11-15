/* BREAKLINE AFTERHOURS. One audible beat, three decisions: hand, foot, defence. */
const CoreRules=(()=>{
'use strict';
// 500 logical ticks per quarter, not wall milliseconds. Real judgement/round time comes from transport hooks.
const BEAT=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIFFICULTIES=Object.freeze({
 rookie:{name:'РАЗОГРЕВ',perfect:85,good:145,hp:150,enemyHP:320,damage:15,repeats:3,intervals:[4,4,4,4,3,1,4,4]},
 fighter:{name:'ДУЭЛЬ',perfect:65,good:120,hp:140,enemyHP:420,damage:19,repeats:2,intervals:[4,4,3,1,4,4,3,1]},
 master:{name:'МАСТЕР',perfect:45,good:95,hp:120,enemyHP:520,damage:23,repeats:2,intervals:[3,1,4,2,2,3,1,4]}
});
const RECIPES=CoreFighters.get('nova').recipes,trie=CoreFighters.get('nova').trie,prefixMoves=CoreFighters.get('nova').prefix;
function error(at){return at-Math.round(at/BEAT)*BEAT}
function grade(at,difficulty='fighter'){const d=DIFFICULTIES[difficulty]??DIFFICULTIES.fighter,e=Math.abs(error(at));return e<=d.perfect?'PERFECT':e<=d.good?'GOOD':'OFF'}
function create(hooks={}){
 const elapsed=(a,b)=>hooks.elapsedMs?.(a,b)??b-a,rhythmError=at=>hooks.rhythmError?.(at)??error(at),judge=at=>{const d=windows(at),e=Math.abs(rhythmError(at));return e<=d.perfect?'PERFECT':e<=d.good?'GOOD':'OFF'};
 let serial=0;const actor=(x,facing,hp,fighter='nova')=>({x,facing,fighter,hp,maxHP:hp,action:null,ready:0,stun:0,hit:null,evade:null,defence:null,guardBlend:null});
 const s={fighterId:'nova',super:0,training:false,practice:null,mode:'idle',difficulty:'rookie',now:0,start:0,end:0,player:actor(137,1,150),enemy:actor(221,-1,220),energy:0,level:1,enemyEnergy:0,enemyLevel:1,musicLevel:1,tempoTarget:120,lastGrooveBeat:0,lessonTempo:false,demoRamp:null,comboLock:null,enemyResumeAt:null,phase:1,series:null,buffer:null,block:false,incoming:null,nextIncoming:null,upcoming:[],enemyIndex:0,guard:null,repeat:{key:null,count:0},lastCombo:null,counterUntil:0,feedback:null,freeze:null,flash:0,impacts:[],particles:[],trails:[],history:[],events:[],lastStep:0,lastEarned:0,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,maxTempo:120,timing:{samples:0,absolute:0,signed:0,early:0,late:0},attempts:0,supers:0,guarded:0,interrupts:0,lateThreats:0},fills:0};
 const emit=(name,...args)=>hooks[name]?.(...args),profile=()=>DIFFICULTIES[s.difficulty],book=()=>CoreFighters.get(s.fighterId);
 function windows(t){const d=profile(),scale=Math.min(1,160/(hooks.bpmAt?.(t)??120));return {perfect:d.perfect*scale,good:d.good*scale}}
 function practiceTempo(value,t){if(!s.practice)return false;s.practice.tempo=value==='auto'?'auto':[120,160,200,240].includes(value)?value:120;s.tempoTarget=s.practice.tempo==='auto'?240:s.practice.tempo;emit(s.practice.tempo==='auto'?'autoTempo':'pinTempo',s.practice.tempo==='auto'?t:s.practice.tempo);return true}
 function demoRamp(t,cap=135){s.tempoTarget=cap;s.demoRamp={first:Math.ceil((s.start/500+16)/4)*4,cap};emit('autoTempo',s.start,cap,{introBeats:16,stepBeats:16})}
 function bpmAt(t){return hooks.bpmAt?.(t)??(s.demoRamp&&t/500>=s.demoRamp.first?s.demoRamp.cap:120)}
 function recordTiming(at){const e=rhythmError(at),m=s.stats.timing;m.samples++;m.absolute+=Math.abs(e);m.signed+=e;if(e<-windows(at).perfect)m.early++;else if(e>windows(at).perfect)m.late++}
 function timing(){const m=s.stats.timing,n=m.samples,bias=n?m.signed/n:0;return {samples:n,meanAbs:n?Math.round(m.absolute/n):null,bias:Math.round(bias),direction:n>=6&&m.early>=3&&m.early>m.late*1.5&&bias<-20?'early':n>=6&&m.late>=3&&m.late>m.early*1.5&&bias>20?'late':'balanced'}}
 function timingAdvice(){const m=timing();return m.direction==='late'?'Чаще опаздываешь. Лови сам удар бочки, не жди оценки на экране.':m.direction==='early'?'Чаще спешишь. Дождись удара бочки, не добавляй нажатие перед ним.':'Слушай бочку и нажимай в момент удара. Между долями дополнительный ввод не помогает.'}
 function charge(amount,t){s.super=clamp(s.super+amount,0,100)}
 function record(type,t,extra={}){s.events.push({id:++serial,type,t,...extra});if(s.events.length>128)s.events.shift()}
 function message(label,detail,t,kind='good'){s.feedback={label,detail,at:t,kind}}
 function syncGroove(t){
  s.level=Math.min(5,1+Math.floor(s.energy/20));s.enemyLevel=Math.min(5,1+Math.floor(s.enemyEnergy/20));s.stats.maxLevel=Math.max(s.stats.maxLevel,s.level);
  const musicLevel=Math.max(s.level,s.enemyLevel);if(musicLevel!==s.musicLevel){s.musicLevel=musicLevel;emit('level',musicLevel)}

 }
 function energy(delta,t){s.energy=s.practice?.level?(s.practice.level-1)*20+10:clamp(s.energy+delta,0,100);if(delta>0)s.lastEarned=t;syncGroove(t)}
 function enemyEnergy(delta,t){s.enemyEnergy=s.practice?.level?(s.practice.level-1)*20+10:clamp(s.enemyEnergy+delta,0,100);syncGroove(t)}
 function remaining(t){return Math.max(0,45000-elapsed(s.start,t))}
 function rivalActive(){return !s.training||s.practice?.mode==='rival'}
 function practiceLevel(level,t){if(!s.practice)return false;s.practice.level=Number.isInteger(level)&&level>=1&&level<=5?level:null;if(s.practice.level){enemyEnergy(0,t);energy(0,t)};return true}
 function rival(){return CoreFighters.rivals[s.enemy.fighter]}
 function interval(index,signature=false){const r=rival(),minimum=s.difficulty==='rookie'?3:s.difficulty==='fighter'?2:1,raw=r.cadence[index%r.cadence.length]-(s.phase===3?1:0);return Math.max(signature?2:minimum,raw)}
 // Three committed future attacks cover one-beat runs and up to 0.49s output latency at 240 BPM.
 function makeThreat(beatAt,index){
  const r=rival(),f=CoreFighters.get(s.enemy.fighter),signature=rivalActive()&&index%r.signatureEvery===r.signatureEvery-1,signatureMove=Object.values(f.recipes)[f.id==='brick'?1:2].move;
  return {id:++serial,index,beatAt,contactAt:beatAt+115,signature,move:signature?signatureMove:r.moves[index%r.moves.length],started:false,resolved:false,cancelled:false,double:interval(index,signature)===1,warned:false,audioQueued:false};
 }
 function queueWarning(inc){if(s.comboLock?.owner==='player')suppressThreats(s.comboLock.until);if(inc&&!inc.audioQueued&&!inc.cancelled){inc.audioQueued=true;emit('warning',inc.beatAt,inc.id)}}
 function gapFor(inc){return rivalActive()?interval(inc.index,inc.signature):profile().intervals[inc.index%profile().intervals.length]}
 function preview(){
  if(rivalActive())while(s.upcoming.length<3){const last=s.upcoming.at(-1)??s.incoming,next=makeThreat(last.beatAt+gapFor(last)*BEAT,last.index+1);s.upcoming.push(next);queueWarning(next)}
  s.nextIncoming=s.upcoming[0]??null;
 }
 function threats(){return s.incoming?[s.incoming,...s.upcoming]:[]}
 function suppressThreats(until){for(const inc of threats()){const start=inc.contactAt-CoreFighters.move(s.enemy.fighter,inc.move).impact;if(start<until&&!inc.cancelled&&!inc.resolved){inc.cancelled=true;emit('cancelWarning',inc.id);if(s.enemy.action?.enemyPending)s.enemy.action=null}}}
 function cancelThreats(){for(const inc of threats()){inc.cancelled=true;emit('cancelWarning',inc.id)}s.incoming=null;s.nextIncoming=null;s.upcoming=[];s.enemyResumeAt=null}
 function plan(beatAt){s.incoming=makeThreat(beatAt,s.enemyIndex++);queueWarning(s.incoming);preview()}
 function advance(inc){
  const next=s.upcoming[0];
  if(next&&next.index===inc.index+1&&next.beatAt>inc.beatAt){s.incoming=s.upcoming.shift();s.enemyIndex=next.index+1;preview()}
  else{for(const queued of s.upcoming)emit('cancelWarning',queued.id);s.upcoming=[];s.nextIncoming=null;plan(inc.beatAt+gapFor(inc)*BEAT)}
 }
 function reset(now,difficulty=s.difficulty,fighterId=s.fighterId,training=false,practiceOptions=null){
  s.difficulty=DIFFICULTIES[difficulty]?difficulty:'rookie';const d=profile(),f=CoreFighters.get(fighterId),ids=Object.keys(CoreFighters.roster),enemyId=practiceOptions&&ids.includes(practiceOptions.enemy)?practiceOptions.enemy:ids[(ids.indexOf(f.id)+1)%ids.length],enemy=CoreFighters.get(enemyId),start=(Math.floor(now/BEAT)+1)*BEAT+3*BEAT;
  const practice=practiceOptions?{mode:practiceOptions.mode==='rival'?'rival':'dummy',enemy:enemy.id,level:null,tempo:practiceOptions.tempo==='auto'?'auto':[120,160,200,240].includes(practiceOptions.tempo)?practiceOptions.tempo:120}:null;training=training||!!practice;
  Object.assign(s,{fighterId:f.id,super:0,training,practice,mode:'fight',now,start,end:start+45000,player:actor(137,1,Math.round(d.hp*f.hp),f.id),enemy:actor(221,-1,Math.round(d.enemyHP*enemy.hp),enemyId),energy:0,level:1,enemyEnergy:0,enemyLevel:1,musicLevel:1,tempoTarget:120,lastGrooveBeat:0,lessonTempo:false,demoRamp:null,comboLock:null,enemyResumeAt:null,phase:1,series:null,buffer:null,block:false,incoming:null,nextIncoming:null,upcoming:[],enemyIndex:0,guard:null,repeat:{key:null,count:0},lastCombo:null,counterUntil:0,feedback:null,freeze:null,flash:0,impacts:[],particles:[],trails:[],history:[],events:[],lastStep:now,lastEarned:now,streak:0,coach:0,stats:{perfect:0,good:0,off:0,combos:0,variety:[],dodges:0,blocks:0,taken:0,counters:0,score:0,maxLevel:1,maxTempo:120,timing:{samples:0,absolute:0,signed:0,early:0,late:0},attempts:0,supers:0,guarded:0,interrupts:0,lateThreats:0},fills:0});
  s.lastGrooveBeat=Math.floor(start/BEAT);emit('scene','battle');emit('resetTempo');if(!s.training||s.practice?.tempo==='auto'){s.tempoTarget=240;emit('autoTempo',s.start)}else if(s.practice?.tempo&&s.practice.tempo!==120){s.tempoTarget=s.practice.tempo;emit('pinTempo',s.practice.tempo)}if(rivalActive())plan(start+({rookie:8,fighter:6,master:4}[s.difficulty])*BEAT);emit('level',1);return s;
 }
 function getGuard(t){if(s.comboLock?.owner==='player')return s.comboLock.pending?s.comboLock.guard:null;if(t<s.enemy.stun)return null;if(s.incoming&&!s.incoming.cancelled&&!s.incoming.resolved&&t>s.incoming.beatAt-180)return null;return s.guard&&t>=s.guard.start&&t<s.guard.end?s.guard.key:null}
 function warning(t){return s.incoming&&!s.incoming.resolved&&!s.incoming.cancelled&&t>=s.incoming.beatAt-700&&t<s.incoming.contactAt}
 function getPose(a,t){return CoreFighters.visual(a,t,{held:!!s.comboLock&&(s.comboLock.owner==='player'?a===s.enemy:a===s.player),warning:a===s.enemy&&warning(t),victory:s.mode==='result'&&((a===s.player&&s.winner==='player')||(a===s.enemy&&s.winner==='enemy')),defeat:(s.mode==='result'||s.mode==='ending'&&(!a.hit||t>=a.hit.end))&&((a===s.player&&s.winner==='enemy')||(a===s.enemy&&s.winner==='player'))})}
 function action(a,move,t,meta={}){const from={...getPose(a,t),...CoreFighters.velocity(a,t)};a.recovery=null;a.visualReturn=null;a.hit=null;a.evade=null;a.defence=null;a.guardBlend=null;a.action={id:++serial,move,start:t,from,resolved:false,...meta};a.ready=t+CoreFighters.move(a.fighter,move).recovery;return a.action}
 function releaseLock(t,reason='break'){
  const lock=s.comboLock;if(!lock)return;const target=lock.owner==='player'?s.enemy:s.player,from=getPose(target,t);s.comboLock=null;
  target.stun=target.recovery?.end>t?target.recovery.end:Math.min(target.stun,t);target.hit=null;target.guardKey=null;target.visualReturn={start:t,end:t+160,from};
  record('comboRelease',t,{reason,owner:lock.owner});
 }
 function breakSeries(t=s.now,reason='break'){s.series=null;if(s.comboLock?.owner==='player')releaseLock(t,reason)}
 function lockDeadline(series){const nextBeat=series.lastBeat+1,bpm=hooks.bpmAt?.(series.lastInput)??120,grace=(windows(series.lastInput).good+110)*bpm/120;return Math.min((nextBeat*BEAT)+grace,(series.firstBeat+5)*BEAT+grace)}
 function holdCombo(series,t,pending=false){
  if(!series||!series.clean||series.steps<2||series.confirmed<(pending?series.steps-1:series.steps))return false;
  if(s.comboLock&&s.comboLock.seriesId!==series.id)releaseLock(t,'new-series');
  pending=pending&&(!s.comboLock||s.comboLock.pending);const guard=s.comboLock?s.comboLock.guard:getGuard(t);if(pending&&guard===series.prefix.at(-1))return false;
  const fresh=!s.comboLock;if(fresh){const from=getPose(s.enemy,t);s.enemy.recovery=null;s.enemy.visualReturn=null;s.enemy.hit={start:t,end:t+230,from};}
  const until=pending||series.node.finish?s.player.action.start+CoreFighters.move(s.player.fighter,s.player.action.move).impact+200:lockDeadline(series);
  s.comboLock={owner:'player',seriesId:series.id,until,pending,guard,expectedBeat:series.lastBeat+1};suppressThreats(until);s.enemy.stun=Math.max(s.enemy.stun,s.comboLock.until);record(fresh?'comboLock':'comboExtend',t,{seriesId:series.id,pending});return true;
 }
 function recover(a,t,kind,stop=0){const from={...getPose(a,t),...CoreFighters.velocity(a,t)},move=a.action?.move??'jab';a.recovery={start:t,end:t+BEAT,kind,from,move,stop};a.visualReturn=null;a.stun=Math.max(a.stun,t+BEAT);a.ready=Math.max(a.ready,t+BEAT);a.defence=null;a.hit=null;a.evade=null;a.guardBlend=null;a.guardKey=null;if(a===s.player){s.block=false;s.buffer=null}}
 function whiff(a,t,reason){if(a===s.player)breakSeries(t,reason);else{releaseLock(t,reason);suppressThreats(t+BEAT)}recover(a,t,'whiff');record('whiff',t,{owner:a===s.player?'player':'enemy',reason});}
 function comboRecovery(t,owner='player',stop=85){
  releaseLock(t,'finish');s.series=null;recover(s.player,t,owner==='player'?'attacker':'defender',stop);recover(s.enemy,t,owner==='enemy'?'attacker':'defender',stop);suppressThreats(t+BEAT);record('comboRecovery',t,{owner,until:t+BEAT});
 }
 function input(key,at,executionAt=at){
  if(s.mode!=='fight'||at<s.start)return {accepted:false,reason:'countdown'};
  if(!['L','H','S'].includes(key))return {accepted:false,reason:'input'};
  const p=s.player;if(elapsed(at,executionAt)>110)return {accepted:false,reason:'stale'};if(at<p.ready&&elapsed(at,p.ready)>80)return {accepted:false,reason:'recovery'};if(at<p.stun||p.defence&&at<p.defence.start+240)return {accepted:false,reason:'defence'};
  if(executionAt<p.ready){if(elapsed(at,p.ready)<=80&&!s.buffer){s.buffer={key,at};return {accepted:false,buffered:true}}return {accepted:false,reason:'recovery'}}
  if(key==='S'&&s.super<100)return {accepted:false,reason:'super'};
  s.buffer=null;s.block=false;const quality=judge(at);let move,series=null,finish=null,standalone=false;
  if(key==='S'){if(quality==='OFF'){breakSeries(executionAt,'off-super');message('СУПЕР В РИТМ','ЗАРЯД СОХРАНЁН',executionAt,'off');return {accepted:false,reason:'rhythm'}}charge(-100,executionAt);breakSeries(executionAt);move=book().superMove;emit('superCharge',s.fighterId);record('superStart',executionAt)}
  else{
   let previous=s.series;if(previous&&Math.round(at/BEAT)!==previous.lastBeat+1){breakSeries(executionAt,'skipped-beat');previous=null}
   if(quality==='OFF'){breakSeries(executionAt);standalone=true;move=key==='L'?'jab':'bodyKick'}
   else if(previous){const node=previous.node[key];if(!node){breakSeries(executionAt);standalone=true;move=key==='L'?'jab':'bodyKick'}else{previous.prefix+=key;previous.node=node;previous.lastInput=at;previous.lastBeat=Math.round(at/BEAT);previous.steps++;previous.allPerfect&&=quality==='PERFECT';series=previous;finish=node.finish;move=finish?.move??book().prefix[previous.prefix]}}
   else if(book().trie[key]){series={id:++serial,prefix:key,node:book().trie[key],lastInput:at,lastBeat:Math.round(at/BEAT),firstBeat:Math.round(at/BEAT),steps:1,confirmed:0,clean:true,allPerfect:quality==='PERFECT'};s.series=series;move=book().prefix[key]}else{standalone=true;move='bodyKick'}
  }
  const counter=executionAt<s.counterUntil&&quality!=='OFF';if(counter){s.counterUntil=0;if(!finish&&key==='L')move='cross'}
  const strong=!!finish||key==='S',a=action(p,move,executionAt,{key,inputAt:at,quality,strong,super:key==='S',finish,series,seriesStep:series?.steps??0,standalone,counter});
  if(series&&quality!=='OFF')holdCombo(series,executionAt,true);
  recordTiming(at);s.stats[quality.toLowerCase()]++;if(quality==='OFF'){s.streak=0;energy(-5,executionAt);message('МИМО РИТМА',rhythmError(at)>0?'ЧУТЬ РАНЬШЕ':'ЧУТЬ ПОЗЖЕ',executionAt,'off');emit('sfx','off')}else {s.streak++;message(quality,Math.round(rhythmError(at))+' ms',executionAt,quality==='PERFECT'?'perfect':'good');emit('sfx','swing');emit('sfx',key==='H'?'kickAccent':'handAccent')}
  if(key==='S')message(book().superName,'СУПЕР · '+book().name,executionAt,'super');
  s.history.push({id:a.id,key,move,prefix:series?.prefix??'',quality,strong,counter,standalone,inputAt:at,start:executionAt,errorMs:rhythmError(at)});if(s.history.length>120)s.history.shift();if(finish)s.series=null;return {accepted:true,action:a};
 }
 function defend(at,executionAt=at){
  const p=s.player;if(s.mode!=='fight'||at<s.start||elapsed(at,executionAt)>110||at<p.stun||p.defence&&at<p.defence.start+300)return false;
  const from={...getPose(p,executionAt),...CoreFighters.velocity(p,executionAt)};p.defence={start:executionAt,inputAt:at,end:executionAt+330,from,quality:judge(at),beat:Math.round(at/BEAT),used:false,savedSeries:s.series};p.guardBlend=null;p.action=null;p.hit=null;s.buffer=null;breakSeries(executionAt);s.block=true;emit('sfx','dodge');return true;
 }
 function release(t){s.block=false;const p=s.player;if(p.guardBlend?.to)p.guardBlend={from:getPose(p,t),at:t,to:false}}
 function setBlock(value,t){if(value){s.block=true}else release(t)}
 function react(a,t,strong,move='jab'){const from={...getPose(a,t),...CoreFighters.velocity(a,t)};a.recovery=null;a.visualReturn=null;if(a===s.player||strong)a.action=null;a.guardBlend=null;a.defence=null;a.hit={start:t,end:t+(strong?350:230),from,keepAttack:a===s.enemy&&!strong&&a.action?.enemyPending&&!a.action.resolved}}
 function burst(x,y,t,strong,kind='hit'){s.impacts.push({x,y,at:t,strong,kind,color:CoreFighters.get(s.fighterId).color});if(s.impacts.length>6)s.impacts.shift();for(let i=0;i<(strong?16:8);i++){const a=i*2.399;s.particles.push({x,y,vx:Math.cos(a)*(strong?140:80),vy:Math.sin(a)*85-35,at:t,strong,kind})}if(s.particles.length>48)s.particles.splice(0,s.particles.length-48)}
 function playerImpact(a,t){
  if(a.quality==='OFF'){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();const e=s.enemy;if(e.hp>0&&!(e.action?.enemyPending&&!e.action.resolved)){e.evade={start:t,end:t+330,from:{...getPose(e,t),...CoreFighters.velocity(e,t)}};e.hit=null}whiff(s.player,t,'off-rhythm');record('offContact',t);return}
  const e=s.enemy,p=s.player,point=CoreFighters.contact(p,t),worldX=p.x+point.x;
  if(e.hp<=0)return;
  if(Math.abs(e.x-worldX)>32||point.y>-45||point.y<-153){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();energy(-3,t);whiff(p,t,'range');record('miss',t);return}
  const blocked=getGuard(t)===a.key&&!a.strong&&!a.counter;
  if(blocked){s.stats.guarded++;e.hp=Math.max(s.training?1:0,e.hp-1);if(a.series)a.series.clean=false;s.streak=0;breakSeries(t,'blocked');message('ЗАЩИТА',a.key==='L'?'СМЕНИ НА НОГУ':'СМЕНИ НА РУКУ',t,'guard');burst(worldX,point.y,t,false,'guard');emit('sfx','block');record('guarded',t,{key:a.key});return}
  const clean=!!(a.series&&a.series.clean&&a.series.confirmed===a.seriesStep-1),guardBreak=!!(getGuard(t)&&a.strong);
  const amount=(a.key==='S'?book().superDamage:a.finish?a.finish.damage:(a.key==='H'?11:9)*book().power)*(a.quality==='PERFECT'?1:.8)*(a.counter?1.45:1)*(a.finish&&s.lastCombo?.recipe===a.finish.recipe?Math.max(.6,1-s.lastCombo.count*.15):1);
  enemyEnergy(a.strong?-3:-1,t);e.hp=Math.max(s.training?1:0,e.hp-amount);s.stats.score+=Math.round(amount*10*(1+Math.min(s.streak,20)*.025));energy(a.quality==='PERFECT'?5:2,t);if(!a.super)charge(a.quality==='PERFECT'?8:4,t);
  if(a.series){a.series.confirmed++;a.series.clean=clean;if(clean)holdCombo(a.series,t,false)}
  if(a.key!=='S'&&rivalActive()){s.repeat=s.repeat.key===a.key?{key:a.key,count:s.repeat.count+1}:{key:a.key,count:1};if(s.repeat.count>=profile().repeats&&t>s.start+3500){s.guard={key:a.key,start:t+170,end:t+170+BEAT*rival().guardBeats};s.repeat.count=0}}
  if(a.counter){s.stats.counters++;energy(4,t);charge(8,t);message('КОНТРА','×1.45 УРОН',t,'counter')}
  react(e,t,a.strong,a.move);
  if(a.strong){
   if(warning(t)){s.incoming.cancelled=true;emit('cancelWarning',s.incoming.id);s.stats.interrupts++;record('interrupt',t)}
   const attacker=getPose(p,t),defender={...getPose(e,t),frame:26,x:-8,y:0,turn:0,mount:null},stop=a.super?110:85;a.visualStop={at:t,duration:stop};e.hit.from=defender;e.hit.start+=stop;e.hit.end+=stop;s.freeze={until:t+stop,at:t,player:attacker,enemy:defender};s.flash=t+100;
   if(guardBreak){s.guard=null;message('BREAK','ЗАЩИТА СЛОМАНА',t,'counter')}
  }
  burst(worldX,point.y,t,a.strong,a.counter?'counter':'hit');if(a.super){s.stats.supers++;message(book().superName,'СУПЕР ПОПАДАНИЕ',t,'super');emit('superHit',s.fighterId);record('super',t)}else emit('sfx',a.counter?'counter':'hit',a.strong);
  if(a.finish&&clean&&a.series.confirmed===a.series.steps){
   const fresh=!s.stats.variety.includes(a.finish.recipe);if(fresh)s.stats.variety.push(a.finish.recipe);s.stats.combos++;s.lastCombo=s.lastCombo?.recipe===a.finish.recipe?{recipe:a.finish.recipe,count:s.lastCombo.count+1}:{recipe:a.finish.recipe,count:1};energy(fresh?14:10,t);charge(14,t);record('combo',t,{recipe:a.finish.recipe,quality:a.series.allPerfect?'PERFECT':'GOOD'});s.stats.score+=fresh?300:180;
   message(a.finish.name,s.lastCombo.count>1?'ПОВТОР · СМЕНИ КОМБО ДЛЯ ПОЛНОЙ СИЛЫ':a.series.allPerfect?'ЧИСТОЕ КОМБО · МУЗЫКАЛЬНЫЙ ОТВЕТ':fresh?'НОВЫЙ ФИНАЛ':'КОМБО',t,'combo');
   if(a.series.allPerfect){s.fills++;emit('fill',a.series.id,true)}
   comboRecovery(t,'player',85);
  }
  record('hit',t,{damage:amount,key:a.key,quality:a.quality,strong:a.strong,counter:a.counter,finish:a.finish?.recipe});
 }
 function enemyImpact(incoming,t){
  if(s.comboLock?.owner==='player'||t<s.enemy.stun)return;
  const enemyPoint=CoreFighters.contact(s.enemy,t);if(s.enemy.action&&Math.abs(s.player.x-(s.enemy.x-enemyPoint.x))>32){whiff(s.enemy,t,'range');return}
  const p=s.player;p.hit=null;s.stats.attempts++;const d=p.defence;
  if(d&&!d.used&&d.beat===Math.round(incoming.beatAt/BEAT)&&d.quality!=='OFF'&&(d.inputAt??d.start)<=t&&d.end>=t){
   d.used=true;s.stats.dodges++;const perfect=d.quality==='PERFECT';energy(perfect?8:4,t);charge(perfect?12:6,t);s.counterUntil=perfect?t+1050:0;s.stats.score+=perfect?180:90;message(perfect?'ИДЕАЛЬНЫЙ УХОД':'УХОД',perfect?'ТВОЯ КОНТРА →':'ЧИСТО',t,perfect?'counter':'good');emit('sfx',perfect?'counterReady':'dodge');record('dodge',t,{quality:d.quality});if(perfect)whiff(s.enemy,t,'perfect-dodge');return;
  }
  if(s.block&&t>=p.stun){p.hp=Math.max(s.training?1:0,p.hp-4);s.stats.blocks++;enemyEnergy(2,t);message('БЛОК','УДЕРЖАНИЕ ЗАЩИЩАЕТ · ТОЧНЫЙ ТАП ДАЁТ КОНТРУ',t,'guard');emit('sfx','block');record('block',t);return}
  enemyEnergy(4,t);const damage=profile().damage+(incoming.double?2:0)+(incoming.signature?4:0);const armoured=p.action?.super&&!p.action.resolved;p.hp=Math.max(s.training?1:0,p.hp-(armoured?Math.ceil(damage*.5):damage));if(armoured){message('БРОНЯ','СУПЕР ПРОДОЛЖАЕТСЯ',t,'counter');emit('sfx','block');record('armour',t);return}s.stats.taken++;s.streak=0;energy(-9,t);charge(-6,t);breakSeries();s.buffer=null;react(p,t,!!incoming.signature,incoming.move);if(incoming.signature){const defender={...getPose(p,t),frame:26,x:-8,y:0,turn:0,mount:null};if(s.enemy.action)s.enemy.action.visualStop={at:t,duration:85};p.hit.from=defender;p.hit.start+=85;p.hit.end+=85;s.freeze={at:t,until:t+85,player:defender,enemy:getPose(s.enemy,t)};s.flash=t+100}p.ready=Math.max(p.ready,t+160);message('ПОПАДАНИЕ','КРАСНАЯ ДОЛЯ → УХОД',t,'hurt');burst(p.x+5,-104,t,false,'enemy');emit('sfx','hit',!!incoming.signature);record('hurt',t,{damage});
 }
 function menu(){emit('scene','menu')}
 function finish(t){if(s.mode!=='fight')return;cancelThreats();s.mode='ending';s.resultAt=t+650;s.block=false;s.buffer=null;breakSeries();s.winner=s.enemy.hp<=0?'player':s.player.hp<=0?'enemy':s.player.hp/s.player.maxHP>s.enemy.hp/s.enemy.maxHP?'player':'enemy';s.stats.time=Math.max(0,elapsed(s.start,t));if(s.winner==='player'){s.stats.winBonus=1200+Math.round(remaining(t)/1000)*20;s.stats.score+=s.stats.winBonus}s.rating=rating();}
 function rating(){const st=s.stats,n=st.perfect+st.good+st.off,accuracy=n?(st.perfect+st.good*.7)/n:0,defence=st.attempts?(st.dodges+st.blocks*.35)/st.attempts:0,points=accuracy*55+defence*20+st.variety.length/3*15+s.player.hp/s.player.maxHP*10;return {rank:points>=92?'S':points>=80?'A':points>=65?'B':points>=45?'C':'D',value:Math.round(points),accuracy:Math.round(accuracy*100)}}
 function review(){
  const st=s.stats,n=st.perfect+st.good+st.off,accuracy=n?(st.perfect+st.good*.7)/n:0;
  if(n<4||accuracy<.65)return {title:'СНАЧАЛА — ДОЛЯ',detail:timingAdvice(),goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · 8 из 10 атак без OFF'};
  const rhythm=timing();if(rhythm.direction!=='balanced'&&st.perfect/Math.max(1,n)<.6)return {title:rhythm.direction==='late'?'ЧУТЬ РАНЬШЕ':'ЧУТЬ ПОЗЖЕ',detail:timingAdvice()+' Средняя ошибка — '+rhythm.meanAbs+' мс.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · 5 PERFECT в одном бою'};
  if(st.attempts>=3&&st.dodges<st.attempts*.4)return {title:'ПРОЧИТАЙ СОПЕРНИКА',detail:CoreFighters.get(s.enemy.fighter).name+' предупреждает об атаке красной долей. Точный тап УХОД сохраняет здоровье и открывает контрудар.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · 3 точных ухода'};
  if(st.variety.length<3){const recipe=Object.keys(book().recipes).find(r=>!st.variety.includes(r));return {title:st.guarded?'СМЕНИ ТРАЕКТОРИЮ':'ДОБАВЬ НОВЫЙ ФИНАЛ',detail:'Попробуй '+recipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · ')+'. После финала пропусти долю; уход остаётся доступным.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · все 3 разных финала'}}
  if(!st.supers)return {title:'ПРЕВРАТИ РИТМ В СУПЕР',detail:'Чистые попадания, комбо и уходы наполняют отдельный заряд. На 100% нажми СУПЕР в долю.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · одно попадание супером'};
  if(s.difficulty!=='master'&&s.winner==='player')return {title:'ТВОЙ СЛЕДУЮЩИЙ УРОВЕНЬ',detail:'Ты используешь весь набор. На следующей сложности окна точности уже, а соперник сильнее.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · победа на следующей сложности'};
  if(s.difficulty==='master'&&s.winner==='player'&&rating().rank==='S')return {title:'РИТМ ПОД КОНТРОЛЕМ',detail:'Ранг S уже твой. Попробуй закончить следующий бой быстрее, сохранив три разных финала и точную защиту.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · победи быстрее, сохранив ранг S'};
  return {title:'ЧИЩЕ. СМЕЛЕЕ. В РИТМ.',detail:'Сохрани три разных финала и контрудары, уменьшая число полученных попаданий.',goal:'СЛЕДУЮЩАЯ ЦЕЛЬ · ранг S на Мастере'};
 }
 function step(t){
  const dt=clamp(t-s.lastStep,0,50);s.lastStep=t;s.now=t;
  if(s.mode==='ending'&&t>=s.resultAt){s.mode='result';emit('finish',s.winner,s.stats,s.rating)}if(s.mode!=='fight'||t<s.start)return;
  s.stats.maxTempo=Math.max(s.stats.maxTempo,Math.round(hooks.bpmAt?.(t)??120));
  if(!s.training&&remaining(t)<=0){finish(t);return}
  const grooveBeat=Math.floor(t/BEAT);if(grooveBeat>s.lastGrooveBeat){if(rivalActive())enemyEnergy(Math.min(4,grooveBeat-s.lastGrooveBeat),t);s.lastGrooveBeat=grooveBeat}
  if(t-s.lastEarned>2200)energy(-dt*.003,t);
  const phase=s.enemy.hp/s.enemy.maxHP>.66?1:s.enemy.hp/s.enemy.maxHP>.33?2:3;if(phase!==s.phase){s.phase=phase;record('phase',t,{phase})}
  if(s.comboLock&&t>s.comboLock.until)releaseLock(t,'missed-beat');
  if(s.series&&t>lockDeadline(s.series))breakSeries(t,'missed-beat');

  if(s.buffer&&t>=s.player.ready){const b=s.buffer;s.buffer=null;if(elapsed(b.at,t)<=110)input(b.key,b.at,t)}
  // A long foreground stall must not burst several unheard threats on recovery.
  if(s.incoming&&!s.incoming.cancelled&&!s.incoming.resolved&&t-s.incoming.contactAt>200){s.stats.lateThreats++;record('lateThreat',t);cancelThreats();if(s.enemy.action?.enemyPending)s.enemy.action=null;plan((Math.ceil(t/BEAT)+4)*BEAT)}
  const inc=s.incoming;
  if(inc&&!inc.resolved){
   if(inc.index===undefined)inc.index=s.enemyIndex++;queueWarning(inc);
   if(warning(t)&&!inc.warned){inc.warned=true;record('warning',t)}
   if(!inc.cancelled&&!inc.started&&t>=s.enemy.stun&&t>=inc.contactAt-CoreFighters.move(s.enemy.fighter,inc.move).impact){const start=inc.contactAt-CoreFighters.move(s.enemy.fighter,inc.move).impact,from=getPose(s.enemy,start);inc.started=true;if(rivalActive()||s.lessonTempo)enemyEnergy(5,start);action(s.enemy,inc.move,start,{enemyPending:true,strong:inc.signature,from})}
  }
  const due=[];const a=s.player.action;if(a&&!a.resolved&&t>=a.start+CoreFighters.move(s.player.fighter,a.move).impact)due.push({t:a.start+CoreFighters.move(s.player.fighter,a.move).impact,type:'player',a});
  if(inc&&!inc.resolved&&t>=inc.contactAt)due.push({t:inc.contactAt,type:'enemy',a:inc});
  due.sort((a,b)=>a.t-b.t);for(const event of due){if(event.type==='player'){if(s.player.action!==event.a)continue;event.a.resolved=true;playerImpact(event.a,event.t)}else {inc.resolved=true;if(s.enemy.action?.enemyPending)s.enemy.action.resolved=true;if(!inc.cancelled&&s.enemy.hp>0)enemyImpact(inc,event.t);if(s.incoming===inc)advance(inc)}}
  if(!s.training&&(s.enemy.hp<=0||s.player.hp<=0)){finish(t);return}
  for(const actor of [s.player,s.enemy])if(actor.recovery&&t>=actor.recovery.end){actor.recovery=null;if(actor.action?.resolved)actor.action=null}
  const guardKey=getGuard(t);if(s.enemy.guardKey!==guardKey&&!(s.enemy.action?.enemyPending&&!s.enemy.action.resolved)&&!s.enemy.hit){const from=getPose(s.enemy,t);s.enemy.guardBlend={from,at:t,to:!!guardKey,key:guardKey};s.enemy.guardKey=guardKey}
  const p=s.player;if(s.block&&(!p.defence||t>=p.defence.end)&&!p.guardBlend?.to){p.guardBlend={from:getPose(p,t),at:t,to:true}}
  if(s.enemy.hit&&t>=s.enemy.hit.end&&!s.comboLock)s.enemy.hit=null;
  if(s.freeze&&t>s.freeze.until)s.freeze=null;s.impacts=s.impacts.filter(p=>t-p.at<190);s.particles=s.particles.filter(p=>t-p.at<440);s.trails=s.trails.filter(p=>t-p.at<145);
 }
 return {s,reset,step,charge,book,input,defend,release,setBlock,energy,grade:judge,rhythmError,elapsed,remaining,enemyEnergy,bpmAt,windows,practiceTempo,demoRamp,getPose,getGuard,warning,action,playerImpact,enemyImpact,rating,review,rival,interval,practiceLevel,cancelThreats,threats,timing,menu,releaseLock,recover,whiff,comboRecovery};
}
return {create,grade,error,RECIPES,trie,prefixMoves,DIFFICULTIES,BEAT};
})();
