'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..'),ctx=vm.createContext({});vm.runInContext(['fighters','rules'].map(n=>fs.readFileSync(root+'/core/src/'+n+'.js','utf8')).join('\n')+';this.R=CoreRules;this.F=CoreFighters;',ctx);const {R,F}=ctx;let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m)},eq=(a,b,m)=>{checks++;assert.equal(a,b,m)};
function make(id='nova'){const g=R.create();g.reset(0,'fighter',id,true,{mode:'dummy'});return g}
function hit(g,key,t){g.step(t);const r=g.input(key,t);ok(r.accepted,'legal input '+key);g.step(t+F.move(g.s.fighterId,r.action.move).impact);return r.action}
for(const id of Object.keys(F.roster))for(const recipe of Object.keys(F.get(id).recipes)){
 const g=make(id),start=g.s.start;hit(g,recipe[0],start);eq(g.s.comboLock,null,'single does not combo-stun');eq(g.s.enemy.stun,0,'single has no gameplay stun');
 const second=g.input(recipe[1],start+500);ok(second.accepted);ok(g.s.comboLock?.pending,'second valid input protects the windup after a clean first contact');g.step(second.action.start+F.move(id,second.action.move).impact);ok(g.s.comboLock&&!g.s.comboLock.pending,'second clean contact confirms lock');
 for(let i=2;i<recipe.length;i++)hit(g,recipe[i],start+i*500);
 eq(g.s.stats.combos,1,'recipe credited');eq(g.s.comboLock,null,'lock released at finish');const at=g.s.player.action.start+F.move(id,g.s.player.action.move).impact;eq(g.s.player.stun,at+500,'attacker exactly one beat');eq(g.s.enemy.stun,at+500,'defender exactly one beat');ok(!g.input('L',at+300).accepted,'cannot attack during recovery');ok(!g.defend(at+300),'cannot defend during recovery');
 const poses=new Set();for(let t=at;t<=at+500;t+=10){const p=g.getPose(g.s.player,t),e=g.getPose(g.s.enemy,t);ok(Number.isFinite(p.x)&&Number.isFinite(e.x),'finite recovery roots');poses.add(p.frame)}ok(poses.size>=3,'authored contact/follow-through/return frames visible');eq(g.getPose(g.s.player,at+500).frame,0,'attacker returns to stance');eq(g.getPose(g.s.enemy,at+500).frame,0,'defender recovers');
}
for(const failure of ['wrong','off','skip','range']){
 const g=make(),t=g.s.start;hit(g,'L',t);hit(g,'H',t+500);ok(g.s.comboLock,'prefix LH locked');
 if(failure==='wrong')g.input('H',t+1000); // LHH is invalid for NOVA, standalone H.
 if(failure==='off')g.input('L',t+1250);
 if(failure==='skip')g.step(t+1800);
 if(failure==='range'){g.s.enemy.x=900;hit(g,'L',t+1000)}

 eq(g.s.comboLock,null,'lock ends on '+failure);eq(g.s.stats.combos,0,'no false finisher on '+failure);
}
{
 const g=make(),t=g.s.start;g.s.guard={key:'L',start:t,end:t+5000};hit(g,'L',t);hit(g,'H',t+500);eq(g.s.comboLock,null,'blocked first hit cannot acquire lock');
}
{const g=make(),t=g.s.start;hit(g,'L',t);g.s.guard={key:'H',start:t,end:t+5000};hit(g,'H',t+500);eq(g.s.comboLock,null,'pre-existing guard on the second hit prevents a lock');eq(g.s.stats.combos,0)}
{
 const g=make(),t=g.s.start;const a=hit(g,'L',t+250),at=a.start+F.move('nova',a.move).impact;eq(g.s.player.stun,at+500,'OFF whiff stuns attacker one beat');eq(g.s.enemy.stun,0,'evading defender not punished');
 const h=make();h.defend(t);h.release(t);h.enemyImpact({id:1,beatAt:t,move:'cross'},t+115);eq(h.s.enemy.stun,t+615,'perfect dodge punishes attacking rival');eq(h.s.player.stun,0,'perfect defender remains free');
}
{const g=make(),t=g.s.start;hit(g,'L',t);hit(g,'L',t+500);hit(g,'H',t+1000);const end=g.s.player.recovery.end,next=Math.ceil(end/500)*500;const a=hit(g,'L',next);g.step(a.start+F.move('nova','jab').impact+30);eq(g.getPose(g.s.enemy,g.s.now).frame,26,'a completed recovery cannot hide the next hit reaction')}
{const g=make(),t=g.s.start;hit(g,'L',t);hit(g,'L',t+500);g.charge(100,t+500);g.input('S',t+1250);eq(g.s.comboLock,null,'offbeat super cannot retain the previous combo hold');eq(g.s.super,100,'rejected super retains its separate resource')}
{const g=make(),t=g.s.start;ok(g.defend(t+20,t+120),'on-time defensive input may be delivered later within the existing 110ms bound');g.release(t+120);g.enemyImpact({id:1,beatAt:t,move:'cross'},t+115);eq(g.s.stats.dodges,1,'collision judges recorded inputAt, not late animation start');eq(g.s.stats.taken,0,'no false hit before the queued timely defence')}
const report={coreSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/core/index.html')).digest('hex'),checks,recipes:9,scope:'clean second-prefix hold, failure release, one-beat mutual recovery and whiff punishment'};fs.mkdirSync(root+'/test-artifacts/roster',{recursive:true});fs.writeFileSync(root+'/test-artifacts/roster/combo-hold.json',JSON.stringify(report,null,2));console.log(report);
