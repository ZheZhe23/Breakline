'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(root+'/'+p,'utf8'),env={};vm.createContext(env);vm.runInContext(['rig','audio','rules'].map(n=>read('core/src/'+n+'.js')).join('\n')+';this.C=CoreRules;this.R=CoreRig;this.A=CoreAudio;',env);const {C,R,A}=env;
let checks=0,frames=0,segments=0,maxError=0,maxJointDelta=0,maxAngleDelta=0;
const ok=(v,m)=>{checks++;assert.ok(v,m)},eq=(a,b,m)=>{checks++;assert.equal(a,b,m)};
function make(d='fighter'){const fills=[],levels=[],g=C.create({fill:(...a)=>fills.push(a),level:l=>levels.push(l)});g.reset(0,d);g.s.incoming=null;return {g,t:g.s.start,fills,levels}}
function attack(g,k,t){const r=g.input(k,t);g.step(t+170);return r}
ok(crypto.createHash('sha256').update(read('index.html')).digest('hex')==='29340083b2fd3cdedf190ae80627022f870fdcb9126ae02953d34523f27b9d8a','full game unchanged');
ok(Math.abs(A.estimateLatency({currentTime:5,baseLatency:.02,outputLatency:.01,getOutputTimestamp:()=>({contextTime:4.8,performanceTime:990})},1010)-.18)<1e-8,'audible hardware timestamp');ok(Math.abs(A.estimateLatency({currentTime:5,baseLatency:.02,outputLatency:.01},1010)-.03)<1e-8,'latency fallback');
for(const [d,p]of Object.entries(C.DIFFICULTIES))for(let i=0;i<20;i++){const t=i*500;eq(C.grade(t,d),'PERFECT');eq(C.grade(t+p.perfect,d),'PERFECT');eq(C.grade(t+p.perfect+1,d),'GOOD');eq(C.grade(t+p.good+1,d),'OFF');eq(C.grade(t+250,d),'OFF')}
for(const recipe of Object.keys(C.RECIPES))for(const offset of [0,90,190]){
 const {g,t,fills}=make();for(let i=0;i<recipe.length;i++)ok(attack(g,recipe[i],t+i*500+offset).accepted,'recipe accepted');
 eq(g.s.stats.combos,offset===190?0:1,'recipe resolves');eq(fills.length,offset===0?1:0,'perfect fill only');eq(g.s.history.at(-1).move,offset===190?'L'===recipe.at(-1)?'jab':'bodyKick':C.RECIPES[recipe].move,'finisher/base');
 if(offset===0){ok(g.s.freeze,'contact snapshot');eq(g.s.player.ready-g.s.player.action.start,675,'finisher recovery');const hp=g.s.enemy.hp;g.step(g.s.now+20);eq(g.s.enemy.hp,hp,'one contact')}
}
for(const recipe of ['LLL','LLH']){const {g,t}=make();recipe.split('').forEach((k,i)=>attack(g,k,t+i*500));eq(g.s.history[0].move,'jab');eq(g.s.history[1].move,'cross')}
{
 const {g,t}=make();'LHHH'.split('').forEach((k,i)=>attack(g,k,t+i*500));eq(g.s.stats.combos,0);ok(g.s.history[2].standalone&&!g.s.history[2].strong,'invalid prefix consumed standalone');ok(g.s.history.every(h=>!h.strong),'no suffix finish');
}
{
 const {g,t}=make();attack(g,'L',t);g.step(t+1300);eq(g.s.series,null,'expires');attack(g,'H',t+1500);ok(!g.s.history.at(-1).strong,'no late suffix');
}
{
 const {g,t}=make();g.input('L',t);const hp=g.s.enemy.hp;g.step(t+84);eq(g.s.enemy.hp,hp);g.step(t+85);ok(g.s.enemy.hp<hp,'quick contact');ok(!g.input('H',t+180).accepted);ok(g.input('H',t+330).buffered);g.step(t+390);eq(g.s.history.at(-1).inputAt,t+330,'buffer original input');eq(g.s.history.at(-1).quality,'OFF','no hidden quantizing');
}
{
 const {g,t}=make();attack(g,'L',t);attack(g,'L',t+500);const prefix=g.s.series.id;ok(g.defend(t+1000));g.release(t+1000);g.enemyImpact({beatAt:t+1000,move:'jab'},t+1115);eq(g.s.series.id,prefix,'successful dodge preserves trie prefix');eq(g.s.player.hp,140);ok(g.s.counterUntil>t+1500);const r=attack(g,'H',t+1500);ok(r.action.counter&&r.action.finish,'counter continues actual recipe');eq(g.s.stats.combos,1);eq(g.s.stats.counters,1);eq(g.s.stats.dodges,1);
}
{
 const {g,t}=make();'LLH'.split('').forEach((k,i)=>attack(g,k,t+i*500));const ready=g.s.player.ready;ok(g.defend(t+1500),'defence during offensive recovery');eq(g.s.player.ready,ready,'defence never erases recovery');ok(!g.input('L',t+1510).accepted);g.release(t+1500);g.enemyImpact({beatAt:t+1500,move:'cross'},t+1615);eq(g.s.player.hp,140,'defence possible after finisher');
}
{
 const {g,t}=make();g.defend(t+250);g.release(t+250);g.enemyImpact({beatAt:t+500,move:'cross'},t+615);eq(g.s.player.hp,121,'offbeat dodge fails');eq(g.s.stats.dodges,0);eq(g.s.counterUntil,0);
 const x=make();x.g.defend(x.t-1+180);x.g.setBlock(true,x.t+300);x.g.enemyImpact({beatAt:x.t+500,move:'jab'},x.t+615);eq(x.g.s.player.hp,136,'held block chip');eq(x.g.s.stats.counters,0,'hold no counter');
}
{
 const {g,t,fills}=make();g.s.guard={key:'L',start:t,end:t+3000};const r=attack(g,'L',t);eq(g.s.enemy.hp,289,'guarded normal chip');eq(g.s.freeze,null);eq(fills.length,0);ok(!r.action.strong);attack(g,'L',t+500);attack(g,'L',t+1000);ok(g.s.freeze,'finisher breaks guard with hit');eq(g.s.stats.combos,0,'blocked prefix not clean');eq(fills.length,0);
}
{
 const {g,t}=make();ok(!g.input('S',t).accepted);g.energy(100,t);eq(g.s.level,5);ok(attack(g,'S',t).accepted);ok(g.s.enemy.hp===250&&g.s.freeze);eq(g.s.energy,65);eq(g.s.fills,0);g.energy(-100,t+300);eq(g.s.level,1);
 const x=make();x.g.s.enemy.x=400;attack(x.g,'L',x.t);eq(x.g.s.enemy.hp,290,'out of reach no hit');eq(x.g.s.freeze,null);
}
// Late event delivery retains the real input grade but cannot bypass recovery.
{
 const {g,t}=make();const accepted=g.input('L',t,t+35);eq(accepted.action.quality,'PERFECT');eq(accepted.action.start,t+35);ok(!g.input('H',t+100,t+450).accepted,'stale queued event rejected');ok(!g.input('H',t+200,t+430).accepted,'too-early original input cannot bypass recovery');
 const x=make();const before=x.g.getPose(x.g.s.player,x.t+30);ok(x.g.defend(x.t,x.t+30));const after=x.g.getPose(x.g.s.player,x.t+30);ok(Math.abs(before.hip[0]-after.hip[0])<1e-8,'defence pose begins at processing pose');
}
// Policy comparisons exercise entire bouts, not mocked damage events.
const policies=[];
for(const difficulty of ['rookie','fighter','master'])for(const policy of ['mash','pressure','reader','defenceOnly']){
 const g=C.create();g.reset(0,difficulty);let cycles=0;
 for(let t=g.s.start;t<=g.s.start+46000&&g.s.mode!=='result';t+=5){
  if(t%500===0){if(['reader','defenceOnly'].includes(policy)&&g.s.incoming&&!g.s.incoming.cancelled&&g.s.incoming.beatAt===t){g.defend(t);g.release(t)}else if(policy!=='defenceOnly'&&t>=g.s.player.ready){let key='L';if(policy==='reader'){const desired=['LLH','LHLH','LLL'][cycles%3],prefix=g.s.series?.prefix||'';key=desired.startsWith(prefix)?desired[prefix.length]:'L';if(!prefix&&g.getGuard(t)==='L'&&cycles%3===2)key='H'}const r=g.input(key,t);if(r.action?.finish)cycles++}}
  if(policy==='mash'&&t%125===0)g.input(t%250===0?'L':'H',t);g.step(t);
 }
 eq(g.s.mode,'result','bout completes');const result={difficulty,policy,winner:g.s.winner,hp:g.s.player.hp,enemy:g.s.enemy.hp,score:g.s.stats.score,combos:g.s.stats.combos,variety:g.s.stats.variety.length,dodges:g.s.stats.dodges,counters:g.s.stats.counters,level:g.s.stats.maxLevel,rank:g.s.rating?.rank};policies.push(result);
 if(policy==='reader'){eq(g.s.winner,'player','reader can win every difficulty');eq(g.s.stats.variety.length,3,'all signatures reachable through defence');ok(g.s.stats.dodges>0&&g.s.stats.counters>0);eq(g.s.stats.maxLevel,5)}
 if(policy==='defenceOnly')eq(g.s.winner,'enemy','cannot win without attacking');
}
const master=policies.filter(p=>p.difficulty==='master');eq(master.find(p=>p.policy==='pressure').winner,'enemy','master resists one-button repetition');ok(master.find(p=>p.policy==='reader').score>master.find(p=>p.policy==='mash').score*3,'reading and timing outperform mashing');
// Dense in-between frames; IK/FK limits, pixel transforms, velocity and support.
function skeleton(sk){frames++;const m=R.measure(sk);ok(m.valid,JSON.stringify(m.violations));segments+=m.segments;maxError=Math.max(maxError,m.maxRelativeError);ok(R.measure(sk,{a:-3,b:0,c:0,d:3},3).valid,'mirrored screen lengths')}
for(const [move,m]of Object.entries(R.moves)){let prev=null;const a={move,start:0,from:R.idle(0)};for(let t=0;t<=m.duration+240;t+=2){const sk=R.skeleton(R.sample(a,t));skeleton(sk);if(prev){for(const [n,l]of Object.entries(sk.limbs)){const angle=Math.max(Math.abs(l.root-prev.limbs[n].root),Math.abs(l.flex-prev.limbs[n].flex));maxAngleDelta=Math.max(maxAngleDelta,angle);ok(angle<.18,'angular continuity '+move)}for(let i=0;i<sk.bones.length;i++){const b=sk.bones[i],q=prev.bones[i],d=Math.hypot(b.end[0]-q.end[0],b.end[1]-q.end[1]);maxJointDelta=Math.max(maxJointDelta,d);ok(d<12,'position continuity '+move)}}prev=sk}
 for(const keyTime of [m.impact*.48,m.impact,m.impact+85]){const a0=R.sample(a,keyTime-.05).angles,a1=R.sample(a,keyTime).angles,a2=R.sample(a,keyTime+.05).angles;for(const n of Object.keys(a1))for(const k of ['root','flex'])ok(Math.abs((a1[n][k]-a0[n][k])/.05-(a2[n][k]-a1[n][k])/.05)<.001,'continuous joint velocity '+move)}
 const contact=R.skeleton(R.sample(a,m.impact)),follow=R.skeleton(R.sample(a,m.impact+65));ok(Math.hypot(contact.limbs[m.limb].end[0]-follow.limbs[m.limb].end[0],contact.limbs[m.limb].end[1]-follow.limbs[m.limb].end[1])>1,'follow-through');if(m.limb.includes('Leg'))ok(R.skeleton(R.sample(a,m.impact*.48)).limbs[m.limb].flex>.5,'chamber before kick');
}
for(const recipe of Object.keys(C.RECIPES)){const {g,t}=make();recipe.split('').forEach((key,i)=>{const at=t+i*500,before=g.getPose(g.s.player,at);g.input(key,at);const after=g.getPose(g.s.player,at);const sb=R.skeleton(before),sa=R.skeleton(after);for(let n=0;n<sa.bones.length;n++)ok(Math.hypot(sa.bones[n].end[0]-sb.bones[n].end[0],sa.bones[n].end[1]-sb.bones[n].end[1])<1e-7,'C0 actual joints');for(const name of ['hip','lh','rh','lf','rf','spine'])for(let j=0;j<before[name].length;j++)ok(Math.abs(before[name][j]-after[name][j])<1e-7,'C0 new action');for(let dt=0;dt<500;dt+=4){g.step(at+dt);skeleton(R.skeleton(g.getPose(g.s.player,at+dt)));skeleton(R.skeleton(g.getPose(g.s.enemy,at+dt)))}})}
const report={coreSha256:crypto.createHash('sha256').update(read('core/index.html')).digest('hex'),checks,frames,segments,maxRelativeBoneError:maxError,maxJointDeltaPer2ms:maxJointDelta,maxAngleDeltaPer2ms:maxAngleDelta,policies};fs.mkdirSync(root+'/test-artifacts/afterhours',{recursive:true});fs.writeFileSync(root+'/test-artifacts/afterhours/rules.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
