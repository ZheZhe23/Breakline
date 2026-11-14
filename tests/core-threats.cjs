'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),env=vm.createContext({performance:{now:()=>0}});vm.runInContext(['fighters','transport','rules','lessons'].map(n=>fs.readFileSync(root+'/core/src/'+n+'.js','utf8')).join('\n')+';this.R=CoreRules;this.L=CoreLessons;',env);const {R,L}=env;let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m)},eq=(a,b,m)=>{checks++;assert.equal(a,b,m)};
for(const hero of ['nova','brick','iris'])for(const rival of ['nova','brick','iris'])for(const difficulty of ['rookie','fighter','master']){
 const queued=[],cancelled=[],g=R.create({warning:(beat,id)=>queued.push({beat,id,at:g.s.now}),cancelWarning:id=>cancelled.push(id)});g.reset(0,difficulty,hero,true,{mode:'rival',enemy:rival});
 ok(queued.length===4,'four threats queued before the visual warning, including the second in a pair');ok(g.s.nextIncoming,'second committed threat exists');let pairs=0;
 for(let i=0;i<12;i++){const first=g.s.incoming,next=g.s.nextIncoming;ok(first.beatAt<next.beatAt,'ordered attacks');ok(queued.some(q=>q.id===next.id),'preview already has a sound cue');const before=next.beatAt;g.s.phase=3;g.s.enemy.hp=g.s.enemy.maxHP*.2;
  g.step(first.beatAt-150);g.defend(first.beatAt+R.DIFFICULTIES[difficulty].perfect+1);g.release(first.beatAt+R.DIFFICULTIES[difficulty].perfect+1);g.step(first.contactAt);eq(g.s.incoming.id,next.id,'promote the announced threat');eq(g.s.incoming.beatAt,before,'HP phase never retimes an announced beat');if(next.beatAt-first.beatAt===500)pairs++;
 }
 eq(new Set(queued.map(x=>x.id)).size,queued.length,'no duplicate queue');g.cancelThreats();eq(g.s.incoming,null,'no current after exit');eq(g.s.nextIncoming,null,'no preview after exit');ok(cancelled.length>=3,'current and both future warning sounds cancelled');
 if(rival==='iris'&&difficulty==='master')ok(pairs>0,'fast pair really exercised');
}
{
 const queued=[],cancelled=[],g=R.create({warning:(beat,id)=>queued.push({beat,id}),cancelWarning:id=>cancelled.push(id)});g.reset(0);const first=g.s.incoming,second=g.s.nextIncoming;g.step(first.contactAt+1200);eq(g.s.stats.taken,0,'stall does not burst old attacks');ok(cancelled.includes(first.id)&&cancelled.includes(second.id),'stall cancels both old sounds');ok(g.s.incoming.beatAt>=Math.ceil(g.s.now/500)*500+1500,'fresh sequence has audio latency headroom');
 const current=g.s.incoming,preview=g.s.nextIncoming;g.s.enemy.hp=0;g.step(g.s.now+1);ok(cancelled.includes(current.id)&&cancelled.includes(preview.id),'round ending cancels queued threats');
 g.reset(0,'fighter','nova',true,{mode:'dummy'});eq(g.s.incoming,null);eq(g.s.nextIncoming,null,'dummy has no hidden preview');
 const l=L.create(g);l.begin('nova',0,0);eq(g.s.incoming,null,'first lesson silent opponent');eq(g.s.nextIncoming,null,'no stale lesson preview');
}
const report={coreSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/core/index.html')).digest('hex'),checks,cases:27,scope:'early two-threat planning, committed rhythm through phase changes, stall and ending cancellation'};fs.mkdirSync(root+'/test-artifacts/roster',{recursive:true});fs.writeFileSync(root+'/test-artifacts/roster/threats.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
