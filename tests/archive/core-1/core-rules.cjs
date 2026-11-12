'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const sandbox={};vm.createContext(sandbox);vm.runInContext(read('core/src/rig.js')+'\n'+read('core/src/game.js').split('\n(()=>{')[0]+'\nthis.R=CoreRig;this.C=CoreRules;',sandbox);
const {R,C}=sandbox;let checks=0,frames=0,segments=0,maxError=0,maxTravel=0,maxAngle=0;
function ok(value,msg){checks++;assert.ok(value,msg)}
const close=(a,b,e=1e-7)=>ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function make(){const fills=[],levels=[],g=C.create({fill:(...a)=>fills.push(a),level:(...a)=>levels.push(a)});g.reset(0);g.s.nextEnemy=1e9;return {g,fills,levels,t:g.s.start}}
function play(recipe,offset=0){const x=make();for(let i=0;i<recipe.length;i++){const at=x.t+i*500+offset;const r=x.g.input(recipe[i],at);ok(r.accepted,recipe+' accepted');x.g.step(at+180)}return x}
// The full production game has not been replaced, reformatted, or edited.
ok(crypto.createHash('sha256').update(read('index.html')).digest('hex')==='29340083b2fd3cdedf190ae80627022f870fdcb9126ae02953d34523f27b9d8a','full game byte-identical');
ok(!/plannedImpactAt|HALF_BEAT|halfBeat|timing=half/.test(read('core/index.html')),'no half-beat experiment in CORE');
for(let beat=0;beat<100;beat++){const t=beat*500;ok(C.grade(t)==='PERFECT','on-beat PERFECT');ok(C.grade(t+65)==='PERFECT','inclusive PERFECT');ok(C.grade(t+90)==='GOOD','GOOD late');ok(C.grade(t-90)==='GOOD','GOOD early');ok(C.grade(t+126)==='OFF','OFF');ok(C.grade(t+250)==='OFF','half-beat is OFF')}
for(const recipe of Object.keys(C.RECIPES)){
 const {g,fills}=play(recipe);ok(g.s.stats.combos===1,'one completed '+recipe);ok(g.s.fills===1&&fills.length===1,'one musical response');ok(g.s.series===null,'terminal clears series');ok(g.s.player.action.move===C.RECIPES[recipe].move,'distinct finisher');ok(g.s.freeze,'strong contact hitstop');const frozenAt=g.s.freeze.at,hp=g.s.enemy.hp;g.step(g.s.now+20);g.step(g.s.now+20);close(g.s.enemy.hp,hp);ok(g.s.enemy.stun-frozenAt<=190,'finite strong stun');ok(g.s.player.ready-g.s.player.action.start===675,'final recovery');
 const good=play(recipe,90);ok(good.g.s.stats.combos===1,'GOOD combo');ok(good.fills.length===0,'GOOD does not produce precise fill');
 const off=play(recipe,180);ok(off.g.s.stats.combos===0&&off.fills.length===0&&off.g.s.enemy.hp===340,'OFF no damage/combo/fill');
}
const a=play('LLL'),b=play('LLH');for(let i=0;i<2;i++){ok(a.g.s.history[i].move===b.g.s.history[i].move,'shared LL choreography');ok(a.g.s.history[i].prefix===b.g.s.history[i].prefix,'shared LL prefix')}
{
 const {g,t}=make();for(let i=0;i<4;i++){g.input('LHHH'[i],t+i*500);g.step(t+i*500+180)}ok(g.s.stats.combos===0,'invalid LHHH no finisher');ok(g.s.history[2].move==='bodyKick'&&!g.s.history[2].strong&&g.s.history[2].prefix==='','invalid edge consumed standalone');ok(g.s.history.every(h=>!h.strong),'no suffix finisher');ok(g.s.enemy.hp===302,'only ordinary damage');
}
{
 const {g,t}=make();g.input('L',t);let hp=g.s.enemy.hp;g.step(t+84);close(hp,g.s.enemy.hp);g.step(t+85);ok(g.s.enemy.hp<hp,'85ms delayed visible contact');ok(!g.input('H',t+200).accepted,'recovery rejects');ok(g.input('H',t+330).buffered,'bounded early buffer');g.step(t+390);ok(g.s.history.at(-1).inputAt===t+330&&g.s.history.at(-1).start===t+390,'buffer retains actual input time');ok(g.s.history.at(-1).quality==='OFF','buffer never upgrades grade');g.step(t+600);ok(g.s.enemy.hp===332,'OFF buffer no damage');
}
{
 const {g,t}=make();g.input('L',t);g.step(t+180);g.step(t+1300);ok(!g.s.series,'prefix timeout');g.input('H',t+1500);ok(!g.s.player.action.strong&&!g.s.player.action.series,'expired cannot continue');
}
{
 const {g,t}=make();g.s.block=true;g.enemyImpact({move:'jab'},t);ok(g.s.player.hp===177,'block reduces damage');ok(g.s.stats.combos===0&&!g.s.freeze,'block no finisher/freeze');g.s.block=false;ok(g.dodge(t+500),'dodge accepted');g.enemyImpact({move:'bodyKick'},t+600);ok(g.s.player.hp===177,'dodge avoids hit');ok(!g.dodge(t+900),'dodge cooldown');g.enemyImpact({move:'jab'},t+1200);ok(g.s.player.hp===161,'unprotected hit');ok(g.s.player.stun===t+1305,'finite normal stun');ok(!g.input('L',t+1250).accepted,'hitstun blocks attack');
}
{
 const {g,t,levels}=make();ok(!g.input('S',t).accepted,'special requires energy');g.energy(100,t);ok(g.s.level===5,'level5');ok(g.input('S',t).accepted,'special available');close(g.s.energy,70);g.step(t+135);ok(g.s.enemy.hp===310&&g.s.freeze,'special hit/freeze');ok(g.s.fills===0,'special distinct from combo fill');g.energy(-70,t+200);ok(g.s.level===1,'level drops');ok(levels.some(v=>v[0]===5)&&levels.at(-1)[0]===1,'layer hooks up/down');
 for(let i=1;i<=5;i++){g.energy(100,t);g.energy(-100,t);g.energy((i-1)*20,t);ok(g.s.level===i,'five thresholds')}
}
{
 const {g,t}=make();g.s.nextEnemy=t+1750;for(let at=t;at<=t+8000;at+=10)g.step(at);ok(g.s.player.hp<140,'AI executes repeated attacks');ok(g.s.nextEnemy>t+8000,'AI schedule advances');
 const h=make();h.g.s.nextEnemy=h.t+1750;for(let at=h.t;at<=h.t+6500;at+=10){if((at-h.t)%500===0)h.g.input('H',at);h.g.step(at)}ok(h.g.s.player.hp<180,'ordinary attacks cannot stun-lock AI');
}
{
 const {g,t}=make();g.s.enemy.hp=8;g.input('L',t);g.step(t+100);ok(g.s.mode==='ending','KO locks combat');ok(!g.input('H',t+500).accepted,'no post-KO input');g.step(t+701);ok(g.s.mode==='result'&&g.s.winner==='player','victory');const start=g.reset(t+1000).start;ok(start%500===0,'rematch quantized');ok(start>=t+1500&&start<=t+2000,'short rematch count-in');
}
// Complete input-driven bout with the live AI; energy and victory are reachable.
{
 const g=C.create();g.reset(0);let cursor=0;const recipe='LLH';
 for(let t=g.s.start;t<g.s.start+61000&&g.s.mode!=='result';t+=10){if(t%500===0&&t>=g.s.player.ready){const r=g.input(recipe[cursor],t);if(r.accepted)cursor=(cursor+1)%recipe.length}g.step(t)}
 ok(g.s.mode==='result'&&g.s.winner==='player','complete rhythm-driven bout wins');ok(g.s.stats.combos>=3&&g.s.stats.maxLevel===5,'combos and level5 reachable against AI');ok(g.s.player.hp>0&&g.s.player.hp<180,'AI remains active during player pressure');
}
// Dense intermediate samples, chained transitions, contact and inertial continuation.
function checkSkeleton(sk){frames++;const m=R.measure(sk);segments+=m.segments;maxError=Math.max(maxError,m.maxRelativeError);ok(m.valid,JSON.stringify(m.violations));for(const b of sk.bones)ok([...b.start,...b.end].every(Number.isFinite),'finite joints')}
for(const [move,m]of Object.entries(R.moves)){
 const action={move,start:0,from:R.idle(0)};let prev=null;
 for(let t=0;t<=m.duration+300;t+=2){const sk=R.skeleton(R.sample(action,t));checkSkeleton(sk);if(prev){let travel=0;for(let i=0;i<sk.bones.length;i++){const p=sk.bones[i].end,q=prev.bones[i].end;travel=Math.max(travel,Math.hypot(p[0]-q[0],p[1]-q[1]))}for(const [name,l]of Object.entries(sk.limbs)){const angle=Math.max(Math.abs(l.root-prev.limbs[name].root),Math.abs(l.flex-prev.limbs[name].flex));maxAngle=Math.max(maxAngle,angle);ok(angle<.18,'no angular jump '+move+' @'+t)}maxTravel=Math.max(maxTravel,travel);ok(travel<12,'no pose teleport '+move+' @'+t+' '+travel)}prev=sk}
 const contact=R.skeleton(R.sample(action,m.impact)),follow=R.skeleton(R.sample(action,m.impact+65));ok(Math.hypot(contact.limbs[m.limb].end[0]-follow.limbs[m.limb].end[0],contact.limbs[m.limb].end[1]-follow.limbs[m.limb].end[1])>1,'real follow-through '+move);
 if(['bodyKick','frontKick','spinKick','knee'].includes(move)){const chamber=R.skeleton(R.sample(action,m.impact*.48));ok(chamber.limbs[m.limb].flex>.5,'bent knee before kick '+move)}
 const support=contact.limbs[move==='spinKick'?'leftLeg':'rightLeg'];ok(Math.abs(support.end[1])<(move==='knee'?24:10),'support foot near floor '+move);
}
for(const recipe of Object.keys(C.RECIPES)){
 const {g,t}=make();for(let i=0;i<recipe.length;i++){const at=t+i*500,before=g.getPose(g.s.player,at);g.input(recipe[i],at);const after=g.getPose(g.s.player,at);for(const k of ['hip','lh','rh','lf','rf','spine'])for(let j=0;j<before[k].length;j++)close(before[k][j],after[k][j]);for(let dt=0;dt<500;dt+=4){g.step(at+dt);checkSkeleton(R.skeleton(g.getPose(g.s.player,at+dt)));checkSkeleton(R.skeleton(g.getPose(g.s.enemy,at+dt)))}}
}
const report={checks,frames,segments,maxRelativeBoneError:maxError,maxJointTravelPer2ms:maxTravel,maxJointAngleChangePer2ms:maxAngle,recipes:Object.keys(C.RECIPES),fullGameUnchanged:true};
fs.mkdirSync(root+'/test-artifacts/core',{recursive:true});fs.writeFileSync(root+'/test-artifacts/core/rules.json',JSON.stringify(report,null,2));console.log(report);
