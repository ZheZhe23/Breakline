'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(root+'/'+p,'utf8'),env={performance:{now:()=>0}};vm.createContext(env);vm.runInContext(['fighters','audio','rules','lessons'].map(n=>read('core/src/'+n+'.js')).join('\n')+'\n'+read('tests/reference/rig-v2.js')+';this.C=CoreRules;this.F=CoreFighters;this.L=CoreLessons;this.R=CoreRig;this.A=CoreAudio;',env);const {C,F,L,R,A}=env;
let checks=0,legacyFrames=0,legacySegments=0;const ok=(v,m)=>{checks++;assert.ok(v,m)},eq=(a,b,m)=>{checks++;assert.equal(a,b,m)};
function make(id='nova',d='fighter'){const fills=[],g=C.create({fill:(...x)=>fills.push(x)});g.reset(0,d,id);g.s.incoming=null;return {g,t:g.s.start,fills}}
function attack(g,k,t){const r=g.input(k,t);if(r.accepted)g.step(r.action.start+F.move(g.s.fighterId,r.action.move).impact+20);return r}
eq(crypto.createHash('sha256').update(read('index.html')).digest('hex'),'29340083b2fd3cdedf190ae80627022f870fdcb9126ae02953d34523f27b9d8a','main unchanged');
ok(!read('core/index.html').includes('const CoreRig'),'release does not ship procedural skeleton');
ok(Math.abs(A.estimateLatency({currentTime:5,baseLatency:.02,outputLatency:.01,getOutputTimestamp:()=>({contextTime:4.8,performanceTime:990})},1010)-.18)<1e-8,'audible clock estimation');
for(const [d,p]of Object.entries(C.DIFFICULTIES))for(let i=0;i<10;i++){const t=i*500;eq(C.grade(t,d),'PERFECT');eq(C.grade(t+p.perfect,d),'PERFECT');eq(C.grade(t+p.perfect+1,d),'GOOD');eq(C.grade(t+p.good+1,d),'OFF');eq(C.grade(t+250,d),'OFF')}
for(const id of Object.keys(F.roster)){
 const f=F.get(id);eq(Object.keys(f.recipes).length,3,'three distinct recipes');
 for(const [recipe,finish]of Object.entries(f.recipes))for(const offset of [0,Math.floor((C.DIFFICULTIES.fighter.perfect+C.DIFFICULTIES.fighter.good)/2),190]){
  const {g,t,fills}=make(id);recipe.split('').forEach((k,i)=>ok(attack(g,k,t+i*500+offset).accepted,'accepted recipe '+id+recipe));
  eq(g.s.stats.combos,offset===190?0:1,'clean combo '+id+recipe);eq(fills.length,offset===0?1:0,'musical response gated');
  if(offset===0){eq(g.s.history.at(-1).move,finish.move);ok(g.s.freeze,'contact snapshot');const hp=g.s.enemy.hp;g.step(g.s.now+20);eq(g.s.enemy.hp,hp,'single hit');eq(g.s.player.ready-g.s.player.action.start,675,'recovery');const action=g.s.player.action,m=F.move(id,action.move);eq(F.visual(g.s.player,action.start+m.impact).frame,m.frames[3],'contact illustration exact');}
 }
 // Exhaustive accepted prefixes are independent of the eventual recipe branch.
 for(const a of Object.keys(f.recipes))for(const b of Object.keys(f.recipes)){const ga=make(id),gb=make(id);let n=0;while(a[n]&&a[n]===b[n]){attack(ga.g,a[n],ga.t+n*500);attack(gb.g,b[n],gb.t+n*500);eq(ga.g.s.history.at(-1).move,gb.g.s.history.at(-1).move,'shared trie edge');n++}}
 const {g,t}=make(id);g.charge(99,t);ok(!g.input('S',t).accepted,'super locked');g.charge(1,t);ok(!g.input('S',t+250).accepted,'offbeat super rejected');eq(g.s.super,100,'offbeat does not waste gauge');const superAttack=g.input('S',t+500);ok(superAttack.accepted);eq(g.s.super,0,'consumed once');eq(superAttack.action.move,f.superMove,'individual super');g.step(t+999);eq(g.s.stats.supers,0,'no early impact');g.step(t+1000);eq(g.s.stats.supers,1,'super lands at next beat');ok(g.s.freeze,'super visual hitstop');eq(g.s.player.ready,t+1750,'super recovery preserved');eq(g.s.energy,5,'super keeps music energy independent');
 const x=make(id);x.g.charge(100,x.t);x.g.input('S',x.t);const saved=x.g.s.player.action;x.g.enemyImpact({move:'cross',beatAt:x.t,double:false},x.t+115);eq(x.g.s.player.action,saved,'armour does not cancel super');ok(x.g.s.player.hp<x.g.s.player.maxHP,'armour still takes damage');
 const manifest=JSON.parse(read('core/assets/manifest.json')).fighters[id];eq(manifest.frames.length,36,'authored frame count');for(const frame of manifest.frames){ok(frame.bbox[0]>=3&&frame.bbox[1]>=3&&frame.bbox[2]<336-3&&frame.bbox[3]<=260,'padded frame does not bleed')}
 // Every visible move is whole-frame, constant-scale data; sample transitions densely.
 for(const name of ['jab','cross','bodyKick',...Object.values(f.recipes).map(x=>x.move),f.superMove]){const m=F.move(id,name),a={fighter:id,action:{move:name,start:0,from:{frame:0,x:0,y:0}}};for(let time=0;time<=m.duration+100;time+=4){const v=F.visual(a,time);ok(Number.isInteger(v.frame)&&v.frame>=0&&v.frame<48,'valid atlas frame');ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<60&&Math.abs(v.y)<30,'bounded whole-body root motion')}}
}
{
 const {g,t}=make();'LHHH'.split('').forEach((k,i)=>attack(g,k,t+i*500));eq(g.s.stats.combos,0,'bad suffix no finisher');ok(g.s.history[2].standalone);const hp=g.s.enemy.hp;g.step(t+3000);eq(g.s.enemy.hp,hp,'no phantom impact');
}
{
 const {g,t}=make();attack(g,'L',t);attack(g,'L',t+500);const series=g.s.series.id;g.defend(t+1000);g.release(t+1000);g.enemyImpact({beatAt:t+1000,move:'cross'},t+1115);eq(g.s.series.id,series,'defence bridge');attack(g,'H',t+1500);eq(g.s.stats.combos,1);eq(g.s.stats.counters,1);
 const p=g.s.player.ready;g.defend(t+2000);eq(g.s.player.ready,p,'defence cannot erase attack recovery');
}
{
 const {g,t}=make();g.s.guard={key:'L',start:t,end:t+2000};attack(g,'L',t);eq(g.s.super,0,'blocked hit no charge');eq(g.s.freeze,null);g.input('L',t+700);g.step(t+1000);eq(g.s.super,0,'OFF no charge');
}
// Whole-drawing motion contracts. These check roots/timing, not hidden bones in art.
const motionReports=[];
for(const id of Object.keys(F.roster)){
 const f=F.get(id),manifest=JSON.parse(read('core/assets/manifest.json')).fighters[id];
 eq(manifest.flow.frames.length,12,'twelve extra drawings');
 for(const cell of manifest.flow.frames)ok(cell.bbox[0]>=3&&cell.bbox[1]>=3&&cell.bbox[2]<333&&cell.bbox[3]<=260,'flow cel padding');
 for(const name of ['jab','cross','bodyKick',...Object.values(f.recipes).map(f=>f.move),f.superMove]){
  const m=F.move(id,name),a={fighter:id,action:{move:name,start:0,from:{frame:0,x:0,y:0}}};let jump=0;
  for(let t=1;t<=m.duration+150;t++){const before=F.visual(a,t-1),after=F.visual(a,t);jump=Math.max(jump,Math.hypot(after.x-before.x,after.y-before.y))}
  ok(jump<.55,'no whole-body root teleport '+id+name+' '+jump);eq(F.visual(a,m.impact).frame,m.frames[3],'authored contact phase');
  eq(F.visual(a,m.impact+70).frame,m.frames[3],'contact continues through follow-through');
  const from={frame:44,x:11,y:-9,vx:.06,vy:-.025},b={fighter:id,action:{move:name,start:0,from}};
  const v=F.visual(b,0);eq(v.frame,from.frame,'transition retains actual current drawing');eq(v.x,from.x,'position continuity x');eq(v.y,from.y,'position continuity y');
  const next=F.visual(b,.01),vel={vx:(next.x-v.x)/.01,vy:(next.y-v.y)/.01};ok(Math.abs(vel.vx-from.vx)<.0001&&Math.abs(vel.vy-from.vy)<.0001,'incoming root velocity preserved '+id+name+' '+JSON.stringify(vel));
  motionReports.push({fighter:id,move:name,impact:m.impact,duration:m.duration,maxRootPixelsPerMs:jump});
 }
 const {g,t}=make(id);g.charge(100,t);const r=g.input('S',t);g.step(t+500);const contact=g.getPose(g.s.player,t+500),expiry=g.s.freeze.until;
 for(const time of [t+510,t+550,expiry]){const pose=g.getPose(g.s.player,time);eq(pose.frame,contact.frame,'hitstop holds contact cel');ok(Math.hypot(pose.x-contact.x,pose.y-contact.y)<.001,'visual clock freezes without gameplay clock')}
 const after=g.getPose(g.s.player,expiry+1);ok(Math.hypot(after.x-contact.x,after.y-contact.y)<.2,'no skipped motion after visual hitstop');
 const hp=g.s.enemy.hp;g.step(expiry+600);eq(g.s.enemy.hp,hp,'visual stop cannot replay gameplay impact');eq(g.s.player.ready,r.action.start+1250,'visual hold never changes cooldown');
}
// Announced enemy attacks remain visible during an ordinary trading hit.
for(const id of Object.keys(F.roster)){
 const {g,t}=make(id),beat=t+500;
 g.s.incoming={id:800,beatAt:beat,contactAt:beat+115,move:'cross',started:false,resolved:false,cancelled:false,warned:false};
 g.step(beat-60);const a=g.input('L',beat-60);ok(a.accepted);g.step(a.action.start+F.move(id,a.action.move).impact);
 ok(g.s.enemy.hit?.keepAttack,'trade retains announced enemy animation '+id);
 g.step(beat+115);const m=F.move(g.s.enemy.fighter,'cross');eq(g.getPose(g.s.enemy,beat+115).frame,m.frames[3],'visible enemy contact is the real damaging contact '+id);eq(g.s.stats.taken,1,'trade is not secretly cancelled');
}
{
 const {g,t}=make(),at=g.s.incoming?.contactAt;
 g.s.incoming={id:900,beatAt:t+500,contactAt:t+615,move:'cross',started:false,resolved:false,cancelled:false};
 const hp=g.s.player.hp;g.step(t+1700);eq(g.s.player.hp,hp,'late threat causes no unseen damage');eq(g.s.stats.lateThreats,1,'late threat recorded');ok(g.s.incoming.beatAt>=t+2700,'fresh warning after stall');g.step(t+1750);eq(g.s.player.hp,hp,'no backlog burst');
 const next=g.s.incoming;g.step(next.contactAt);eq(g.s.stats.taken,1,'normal threat resumes normally');
}
const rivalReports=[];
for(const id of Object.keys(F.roster)){
 const g=C.create();g.reset(0,'master',id);const timeline=[];
 for(let i=0;i<8;i++){const inc=g.s.incoming;timeline.push({beat:inc.beatAt,move:inc.move,strong:inc.signature});g.step(inc.beatAt-80);g.defend(inc.beatAt);g.release(inc.beatAt);g.step(inc.contactAt+1)}
 rivalReports.push({fighter:id,opponent:g.s.enemy.fighter,style:g.rival().name,timeline});
}
eq(new Set(rivalReports.map(x=>JSON.stringify(x.timeline))).size,3,'rival cadences and techniques actually differ');
for(const d of Object.keys(C.DIFFICULTIES))for(const id of Object.keys(F.roster)){const {g}=make(id,d);for(let i=0;i<12;i++)ok(g.interval(i)>= (d==='rookie'?3:d==='fighter'?2:1),'difficulty never creates impossible rapid enemy cadence')}
{
 const {g}=make();let r=g.review();eq(r.title,'СНАЧАЛА — ДОЛЯ');Object.assign(g.s.stats,{perfect:12,attempts:6,taken:4});r=g.review();eq(r.title,'ПРОЧИТАЙ СОПЕРНИКА');Object.assign(g.s.stats,{dodges:5,guarded:3});r=g.review();eq(r.title,'СМЕНИ ТРАЕКТОРИЮ');g.s.stats.variety=Object.keys(g.book().recipes);eq(g.review().title,'ПРЕВРАТИ РИТМ В СУПЕР');g.s.stats.supers=1;g.s.winner='player';eq(g.review().title,'ТВОЙ СЛЕДУЮЩИЙ УРОВЕНЬ');g.s.difficulty='master';ok(g.review().goal.includes('ранг S'),'master goal remains skill based');eq(g.review().title,'РИТМ ПОД КОНТРОЛЕМ','achieved S is acknowledged, not suggested again');
}
// OFF is an actual visible near-miss: no successful-contact effects or charge.
for(const id of Object.keys(F.roster)){
 const {g,t}=make(id);const hp=g.s.enemy.hp,from=g.getPose(g.s.enemy,t+250);const a=g.input('L',t+250);ok(a.accepted);const at=a.action.start+F.move(id,a.action.move).impact;g.step(at);eq(g.s.enemy.hp,hp,'OFF does no damage');eq(g.s.super,0,'OFF grants no super');eq(g.s.impacts.length,0,'OFF has no hit mark');eq(g.s.freeze,null,'OFF has no hitstop');ok(g.s.enemy.evade,'visible avoidance recorded');eq(g.getPose(g.s.enemy,at).frame,g.s.enemy.evade.from.frame,'avoidance starts from current drawing');const mid=g.getPose(g.s.enemy,at+165);eq(mid.frame,25,'authored avoidance cel');ok(mid.x<=-10,'defender moves away from contact');const end=g.getPose(g.s.enemy,at+330);ok(Math.abs(end.x)<.01,'avoidance root settles');
 const beat=at+400;g.s.incoming={id:2000,beatAt:beat,contactAt:beat+115,move:'cross',started:false,resolved:false,cancelled:false};g.step(beat+115);eq(g.s.enemy.evade,null,'announced attack supersedes avoidance');eq(g.getPose(g.s.enemy,beat+115).frame,F.move(g.s.enemy.fighter,'cross').frames[3],'avoidance never hides real incoming contact');
}
{
 const {g,t}=make();g.s.guard={key:'L',start:t,end:t+2000};attack(g,'L',t);eq(g.s.impacts.at(-1).kind,'guard','block has distinct guard drawing');eq(g.s.freeze,null,'block never starts successful hitstop');
}
// Real interactive curriculum: no direct completion flags or mocked successful events.
const lessonReports=[];
for(const id of Object.keys(F.roster)){
 const g=C.create(),l=L.create(g),book=F.get(id);l.begin(id,0,0);let t=0,attempts=0;
 for(;t<240000&&!l.state.graduated;t+=5){
  if(l.state.waiting){l.next(t);continue}
  const s=g.s,index=l.state.index;
  if(t>=s.start&&t%500===0){const due=s.incoming?.beatAt===t;
   if(index===4){if(s.incoming&&t===s.incoming.beatAt-500)g.defend(t)}
   else if([5,6,11].includes(index)&&due){g.defend(t);g.release(t)}
   else if(t>=s.player.ready){
    let key=null;
    if(index===0||index===9)key='L';if(index===1||index===7)key='H';
    if([2,3,8].includes(index)){const target=l.state.recipe,prefix=s.series?.prefix??'';key=target.startsWith(prefix)?target[prefix.length]:'L';if(index===3&&l.state.stage)key='L'}
    if(index===6&&t<s.counterUntil)key='L';if(index===10)key='S';
    if(index===11){if(s.super>=100&&!l.state.seen.includes('super'))key='S';else {const target=Object.keys(book.recipes)[0],prefix=s.series?.prefix??'';key=target.startsWith(prefix)?target[prefix.length]:target[0]}}
    if(key){g.input(key,t);attempts++}
   }
  }
  g.step(t);l.tick(t);
 }
 ok(l.state.graduated,'all twelve lessons completed '+id+' stuck '+l.state.index+' '+l.state.progress);eq(l.state.completed.length,12,'no skipped lesson');lessonReports.push({fighter:id,seconds:t/1000,inputs:attempts,completed:l.state.completed.length});
}
// Full live-AI bouts preserve the skill advantage with every fighter.
const policies=[];
for(const id of Object.keys(F.roster))for(const policy of ['reader','repeat']){
 const g=C.create();g.reset(0,'master',id);let cycle=0;
 for(let t=g.s.start;t<g.s.start+46000&&g.s.mode!=='result';t+=5){
  if(t%500===0){if(policy==='reader'&&g.s.incoming&&!g.s.incoming.cancelled&&g.s.incoming.beatAt===t&&!(g.s.player.action?.super&&!g.s.player.action.resolved)){g.defend(t);g.release(t)}else if(t>=g.s.player.ready){const recipes=Object.keys(g.book().recipes),target=recipes[cycle%3],prefix=g.s.series?.prefix??'';let key=policy==='repeat'?'L':target.startsWith(prefix)?target[prefix.length]:target[0];if(g.s.super>=100&&(policy==='repeat'||!g.s.series))key='S';const r=g.input(key,t);if(r.action?.finish)cycle++}}g.step(t)
 }
 eq(g.s.mode,'result','bout terminates');eq(g.s.winner,policy==='reader'?'player':'enemy','skill advantage '+id);if(policy==='reader'){eq(g.s.stats.variety.length,3);ok(g.s.stats.supers>0);ok(g.s.stats.dodges>0)}policies.push({fighter:id,policy,winner:g.s.winner,combos:g.s.stats.combos,supers:g.s.stats.supers,score:g.s.stats.score});
}
// Preserve the previous anatomy audit as an archived reference, not a sprite claim.
for(const [name,m]of Object.entries(R.moves))for(let t=0;t<=m.duration;t+=4){const a={move:name,start:0,from:R.idle(0)},result=R.measure(R.skeleton(R.sample(a,t)));ok(result.valid,'legacy fixed lengths');legacyFrames++;legacySegments+=result.segments}
const report={coreSha256:crypto.createHash('sha256').update(read('core/index.html')).digest('hex'),checks,fighters:Object.keys(F.roster),recipes:9,illustratedFrames:144,lessonReports,policies,rivalReports,motionReports,legacyFrames,legacySegments,rendering:'whole illustrated sprites, no runtime skeleton'};fs.mkdirSync(root+'/test-artifacts/roster',{recursive:true});fs.writeFileSync(root+'/test-artifacts/roster/rules.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
