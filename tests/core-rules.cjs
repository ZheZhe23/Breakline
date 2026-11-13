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
  if(offset===0){eq(g.s.history.at(-1).move,finish.move);ok(g.s.freeze,'contact snapshot');const hp=g.s.enemy.hp;g.step(g.s.now+20);eq(g.s.enemy.hp,hp,'single hit');eq(g.s.player.ready-g.s.player.action.start,675,'recovery');const action=g.s.player.action,m=F.move(id,action.move);eq(F.visual(g.s.player,action.start+m.impact).frame,m.row*6+3,'contact illustration exact');}
 }
 // Exhaustive accepted prefixes are independent of the eventual recipe branch.
 for(const a of Object.keys(f.recipes))for(const b of Object.keys(f.recipes)){const ga=make(id),gb=make(id);let n=0;while(a[n]&&a[n]===b[n]){attack(ga.g,a[n],ga.t+n*500);attack(gb.g,b[n],gb.t+n*500);eq(ga.g.s.history.at(-1).move,gb.g.s.history.at(-1).move,'shared trie edge');n++}}
 const {g,t}=make(id);g.charge(99,t);ok(!g.input('S',t).accepted,'super locked');g.charge(1,t);ok(!g.input('S',t+250).accepted,'offbeat super rejected');eq(g.s.super,100,'offbeat does not waste gauge');const superAttack=g.input('S',t+500);ok(superAttack.accepted);eq(g.s.super,0,'consumed once');eq(superAttack.action.move,f.superMove,'individual super');g.step(t+999);eq(g.s.stats.supers,0,'no early impact');g.step(t+1000);eq(g.s.stats.supers,1,'super lands at next beat');ok(g.s.freeze,'super visual hitstop');eq(g.s.player.ready,t+1750,'super recovery preserved');eq(g.s.energy,5,'super keeps music energy independent');
 const x=make(id);x.g.charge(100,x.t);x.g.input('S',x.t);const saved=x.g.s.player.action;x.g.enemyImpact({move:'cross',beatAt:x.t,double:false},x.t+115);eq(x.g.s.player.action,saved,'armour does not cancel super');ok(x.g.s.player.hp<x.g.s.player.maxHP,'armour still takes damage');
 const manifest=JSON.parse(read('core/assets/manifest.json')).fighters[id];eq(manifest.frames.length,36,'authored frame count');for(const frame of manifest.frames){ok(frame.bbox[0]>=3&&frame.bbox[1]>=3&&frame.bbox[2]<336-3&&frame.bbox[3]<=260,'padded frame does not bleed')}
 // Every visible move is whole-frame, constant-scale data; sample transitions densely.
 for(const name of ['jab','cross','bodyKick',...Object.values(f.recipes).map(x=>x.move),f.superMove]){const m=F.move(id,name),a={fighter:id,action:{move:name,start:0,from:{frame:0,x:0,y:0}}};for(let time=0;time<=m.duration+100;time+=4){const v=F.visual(a,time);ok(Number.isInteger(v.frame)&&v.frame>=0&&v.frame<36,'valid atlas frame');ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<60&&Math.abs(v.y)<30,'bounded whole-body root motion')}}
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
  if(t%500===0){if(policy==='reader'&&g.s.incoming&&!g.s.incoming.cancelled&&g.s.incoming.beatAt===t){g.defend(t);g.release(t)}else if(t>=g.s.player.ready){const recipes=Object.keys(g.book().recipes),target=recipes[cycle%3],prefix=g.s.series?.prefix??'';let key=policy==='repeat'?'L':target.startsWith(prefix)?target[prefix.length]:target[0];if(g.s.super>=100)key='S';const r=g.input(key,t);if(r.action?.finish)cycle++}}g.step(t)
 }
 eq(g.s.mode,'result','bout terminates');eq(g.s.winner,policy==='reader'?'player':'enemy','skill advantage '+id);if(policy==='reader'){eq(g.s.stats.variety.length,3);ok(g.s.stats.supers>0);ok(g.s.stats.dodges>0)}policies.push({fighter:id,policy,winner:g.s.winner,combos:g.s.stats.combos,supers:g.s.stats.supers,score:g.s.stats.score});
}
// Preserve the previous anatomy audit as an archived reference, not a sprite claim.
for(const [name,m]of Object.entries(R.moves))for(let t=0;t<=m.duration;t+=4){const a={move:name,start:0,from:R.idle(0)},result=R.measure(R.skeleton(R.sample(a,t)));ok(result.valid,'legacy fixed lengths');legacyFrames++;legacySegments+=result.segments}
const report={coreSha256:crypto.createHash('sha256').update(read('core/index.html')).digest('hex'),checks,fighters:Object.keys(F.roster),recipes:9,illustratedFrames:108,lessonReports,policies,legacyFrames,legacySegments,rendering:'whole illustrated sprites, no runtime skeleton'};fs.mkdirSync(root+'/test-artifacts/roster',{recursive:true});fs.writeFileSync(root+'/test-artifacts/roster/rules.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
