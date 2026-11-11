/* CORE owns its rules. Full BREAKLINE and the half-beat experiment are untouched. */
const CoreRules=(()=>{
'use strict';
const BEAT=500,PERFECT=65,GOOD=125,MAX_HP=180,ENEMY_HP=340;
const RECIPES=Object.freeze({LLL:{move:'uppercut',name:'СИЛОВОЙ АППЕРКОТ'},LLH:{move:'frontKick',name:'ПРОБИВНОЙ УДАР'},LHLH:{move:'spinKick',name:'УДАР С РАЗВОРОТА'}});
const trie={};for(const [recipe,finish]of Object.entries(RECIPES)){let node=trie;for(const key of recipe)node=node[key]??(node[key]={});node.finish=finish}
const prefixMoves={L:'jab',LL:'cross',LH:'bodyKick',LHL:'hook'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function grade(at){const error=Math.abs(at-Math.round(at/BEAT)*BEAT);return error<=PERFECT?'PERFECT':error<=GOOD?'GOOD':'OFF'}
function create(hooks={}){
 let serial=0;
 const actor=(x,facing,hp)=>({x,facing,hp,maxHP:hp,action:null,ready:0,stun:0,hit:null,dodge:null});
 const s={mode:'idle',start:0,end:0,now:0,player:actor(138,1,MAX_HP),enemy:actor(222,-1,ENEMY_HP),energy:0,level:1,series:null,buffer:null,block:false,dodgeReady:0,nextEnemy:0,telegraph:false,enemyIndex:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],stats:{perfect:0,good:0,off:0,combos:0,score:0,maxLevel:1},lastEarned:0,lastStep:0,history:[],fills:0};
 const emit=(name,...args)=>hooks[name]?.(...args);
 function energy(delta,t){s.energy=clamp(s.energy+delta,0,100);const level=Math.min(5,1+Math.floor(s.energy/20));if(level!==s.level){s.level=level;s.stats.maxLevel=Math.max(s.stats.maxLevel,level);emit('level',level,t)}if(delta>0)s.lastEarned=t}
 function message(label,detail,t,color='#a7f3cf'){s.feedback={label,detail,at:t,color}}
 function reset(now){
  Object.assign(s,{mode:'fight',start:(Math.floor(now/BEAT)+1)*BEAT+(s.mode==='idle'?3:1)*BEAT,now,end:0,player:actor(138,1,MAX_HP),enemy:actor(222,-1,ENEMY_HP),energy:0,level:1,series:null,buffer:null,block:false,dodgeReady:0,telegraph:false,enemyIndex:0,feedback:null,freeze:null,flash:0,particles:[],trails:[],stats:{perfect:0,good:0,off:0,combos:0,score:0,maxLevel:1},lastEarned:now,lastStep:now,history:[],fills:0});
  s.end=s.start+60000;s.nextEnemy=s.start+BEAT*3.5;emit('level',1,now);return s;
 }
 function guarding(t){return s.block&&t>=s.player.ready&&t>=s.player.stun&&!(s.player.dodge&&t<s.player.dodge.end)}
 function getPose(a,t){
  let p=CoreRig.sample(a.action,t);
  if(a===s.player&&guarding(t))p=CoreRig.mix(p,CoreRig.pose({hip:[-3,-69],spine:[-.05,-.08,-.02],lh:[26,-135],rh:[10,-137]}),.85);
  if(a.dodge&&t<a.dodge.end){const d=a.dodge,w=Math.sin(Math.PI*clamp((t-d.start)/(d.end-d.start),0,1));p=CoreRig.mix(d.from,CoreRig.pose({hip:[-15,-58],spine:[-.24,-.30,-.08],lh:[14,-109],rh:[-1,-116]}),w)}
  if(a.hit&&t<a.hit.end){const h=a.hit,age=t-h.start,duration=h.end-h.start,w=age<45?CoreRig.smooth(age/45):1-CoreRig.smooth((age-45)/(duration-45));p=CoreRig.mix(age<45?h.from:p,h.target,w)}
  return p;
 }
 function action(a,move,t,meta={}){const from=getPose(a,t);a.hit=null;a.dodge=null;a.action={id:++serial,move,start:t,from,resolved:false,...meta};a.ready=t+CoreRig.moves[move].recovery;return a.action}
 function breakSeries(){s.series=null}
 function input(key,at,executionAt=at){
  if(s.mode!=='fight'||at<s.start)return {accepted:false,reason:'countdown'};
  const p=s.player;if(at<p.stun||p.dodge&&at<p.dodge.end)return {accepted:false,reason:'defence'};
  if(executionAt<p.ready){if(p.ready-at<=80&&at>=p.ready-80&&!s.buffer){s.buffer={key,at};return {accepted:false,buffered:true}}return {accepted:false,reason:'recovery'}}
  s.buffer=null;const quality=grade(at);let move,series=null,finish=null,standalone=false;
  if(key==='S'){
   if(s.energy<30)return {accepted:false,reason:'energy'};energy(-30,executionAt);breakSeries();move='knee';
  }else{
   if(!['L','H'].includes(key))return {accepted:false,reason:'input'};
   let previous=s.series;if(previous&&at-previous.lastInput>1250){breakSeries();previous=null}
   if(quality==='OFF'){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}
   else if(previous){
    const node=previous.node[key];
    if(!node){breakSeries();standalone=true;move=key==='L'?'jab':'bodyKick'}
    else {previous.prefix+=key;previous.node=node;previous.lastInput=at;previous.steps++;previous.allPerfect&&=quality==='PERFECT';series=previous;finish=node.finish;move=finish?.move??prefixMoves[previous.prefix]}
   }else if(key==='L'){
    series={id:++serial,prefix:'L',node:trie.L,lastInput:at,steps:1,confirmed:0,clean:true,allPerfect:quality==='PERFECT'};s.series=series;move='jab';
   }else {standalone=true;move='bodyKick'}
  }
  const strong=!!finish||key==='S',a=action(p,move,executionAt,{key,inputAt:at,quality,strong,finish,series,seriesStep:series?.steps??0,standalone});
  s.stats[quality.toLowerCase()]++;message(quality,strong?(finish?.name??'ПУЛЬС-КОЛЕНО'):'',executionAt,quality==='OFF'?'#ff9b7d':quality==='GOOD'?'#b9c9d0':'#a7f3cf');
  if(quality==='OFF'){energy(-4,executionAt);emit('sfx','off')}else emit('sfx','swing');
  s.history.push({id:a.id,key,move,prefix:series?.prefix??'',quality,strong,inputAt:at,start:executionAt});if(s.history.length>80)s.history.shift();
  if(finish)breakSeries();return {accepted:true,action:a};
 }
 function dodge(t){const p=s.player;if(s.mode!=='fight'||t<s.start||t<p.ready||t<p.stun||t<s.dodgeReady)return false;const from=getPose(p,t);p.action=null;p.dodge={start:t,end:t+300,from};p.ready=t+300;s.dodgeReady=t+1000;s.buffer=null;breakSeries();emit('sfx','dodge');return true}
 function react(a,t,strong){const from=getPose(a,t);if(a!==s.enemy||strong)a.action=null;a.hit={start:t,end:t+(strong?330:220),from,target:CoreRig.pose({hip:[-9,-67],spine:[-.15,-.24,-.12],lh:[4,-112],rh:[-7,-120],lf:[23,-2],rf:[-32,-2],turn:-.23})};a.stun=Math.max(a.stun,t+(strong?190:105))}
 function burst(x,y,t,strong){for(let i=0;i<(strong?14:7);i++){const a=i*2.399;s.particles.push({x,y,vx:Math.cos(a)*(strong?110:65),vy:Math.sin(a)*70-35,at:t,strong})}if(s.particles.length>40)s.particles.splice(0,s.particles.length-40)}
 function playerImpact(a,t){
  const e=s.enemy,p=s.player;
  if(a.quality==='OFF'){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();return}
  if(e.hp<=0)return;
  // A single fixed reach envelope; the constrained contact limb supplies the FX position.
  // No magnetism, snapping, bone stretch, or different visual/gameplay targeting clocks.
  const sk=CoreRig.skeleton(getPose(p,t)),limb=sk.limbs[CoreRig.moves[a.move].limb],point=a.move==='knee'?limb.joint:limb.end;
  const worldX=p.x+point[0];const near=Math.abs(e.x-worldX)<(a.move==='knee'?30:32)&&point[1]<-47&&point[1]>-150;
  if(!near){if(a.series)a.series.clean=false;if(s.series?.id===a.series?.id)breakSeries();energy(-3,t);return}
  const clean=a.series&&a.series.clean&&a.series.confirmed===a.seriesStep-1;
  const damage=(a.key==='S'?30:a.finish?26:a.key==='H'?10:8)*(a.quality==='PERFECT'?1:.8);
  e.hp=Math.max(0,e.hp-damage);s.stats.score+=Math.round(damage*10);energy(a.quality==='PERFECT'?5:2,t);
  if(a.series){a.series.confirmed++;a.series.clean=!!clean}
  react(e,t,a.strong);
  if(a.strong){e.interruptedUntil=t+190;e.ready=Math.max(e.ready,t+190);if(s.telegraph){s.telegraph=false;s.nextEnemy+=2000}const attacker=CoreRig.skeleton(getPose(p,t)),defender=CoreRig.skeleton(getPose(e,t));e.hit.start+=85;e.hit.end+=85;s.freeze={until:t+85,at:t,player:attacker,enemy:defender};s.flash=t+110}
  burst(worldX,point[1],t,a.strong);emit('sfx','hit',a.strong);
  if(a.finish&&clean&&a.series.confirmed===a.series.steps){
   s.stats.combos++;energy(12,t);message(a.finish.name,a.series.allPerfect?'ТОЧНОЕ КОМБО · МУЗЫКАЛЬНЫЙ ОТВЕТ':'КОМБО',t);
   if(a.series.allPerfect){s.fills++;emit('fill',a.series.id,true,t)}
  }
 }
 function enemyImpact(a,t){
  s.enemy.hit=null;const p=s.player;if(p.hp<=0)return;
  if(p.dodge&&t>=p.dodge.start+20&&t<p.dodge.end-55){energy(3,t);message('УКЛОН','ЧИСТЫЙ УХОД',t);return}
  if(guarding(t)){p.hp=Math.max(0,p.hp-3);emit('sfx','block');message('БЛОК','УРОН СНИЖЕН',t,'#b9c9d0');return}
  p.hp=Math.max(0,p.hp-(a.move==='bodyKick'?20:16));energy(-9,t);breakSeries();s.buffer=null;react(p,t,false);p.ready=Math.max(p.ready,t+160);emit('sfx','hit',false);message('ПОПАДАНИЕ','БЛОК ИЛИ УКЛОН — ДО КОНТАКТА',t,'#ff9b7d');burst(p.x+5,-105,t,false);
 }
 function finish(t){if(s.mode!=='fight')return;s.mode='ending';s.resultAt=t+600;s.block=false;s.buffer=null;s.series=null;const win=s.enemy.hp<=0||s.player.hp>0&&s.player.hp/s.player.maxHP>s.enemy.hp/s.enemy.maxHP;s.winner=s.player.hp<=0?'enemy':win?'player':'enemy';}
 function step(t){
  const dt=clamp(t-s.lastStep,0,50);s.lastStep=t;s.now=t;if(s.mode==='ending'&&t>=s.resultAt){s.mode='result';emit('finish',s.winner,s.stats)}if(s.mode!=='fight')return;
  if(t<s.start)return;
  if(t>=s.end){finish(t);return}
  if(t-s.lastEarned>2200)energy(-dt*.0022,t);
  if(s.series&&t-s.series.lastInput>1250)breakSeries();
  if(s.buffer&&t>=s.player.ready){const b=s.buffer;s.buffer=null;if(t-b.at<=110)input(b.key,b.at,t)}
  if(s.player.action&&!s.player.action.resolved&&t>=s.player.action.start+CoreRig.moves[s.player.action.move].impact){const a=s.player.action;a.resolved=true;playerImpact(a,a.start+CoreRig.moves[a.move].impact)}
  if(s.enemy.hp<=0||s.player.hp<=0){finish(t);return}
  if(!s.telegraph&&t>=s.nextEnemy-320){s.telegraph=true}
  if(s.telegraph&&!(s.enemy.action?.enemyPending&&!s.enemy.action.resolved)&&t>=s.nextEnemy-125){
   if(t<(s.enemy.interruptedUntil??0)){s.telegraph=false;s.nextEnemy+=2000}else {const move=['jab','bodyKick','hook','bodyKick'][s.enemyIndex++%4];action(s.enemy,move,s.nextEnemy-CoreRig.moves[move].impact,{enemyPending:true,strong:false})}
  }
  const a=s.enemy.action;
  if(a?.enemyPending&&!a.resolved&&t>=s.nextEnemy){a.resolved=true;enemyImpact(a,s.nextEnemy);s.telegraph=false;s.nextEnemy+=2000}
  if(s.freeze&&t>s.freeze.until)s.freeze=null;
  s.particles=s.particles.filter(p=>t-p.at<420);s.trails=s.trails.filter(p=>t-p.at<140);
 }
 return {s,reset,step,input,dodge,energy,grade,guarding,getPose,action,react,playerImpact,enemyImpact};
}
return {create,grade,RECIPES,trie,prefixMoves,BEAT,PERFECT,GOOD,MAX_HP,ENEMY_HP};
})();

(()=>{
'use strict';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d'),app=$('app'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let audio=null,paused=false,started=false,lastFrame=0,w=360,h=740,dpr=1,scale=1,ground=420,worldLeft=0,drawCount=0,auditErrors=0;
const nodes=Array.from({length:11},()=>{const n=document.createElement('i');n.className='beat-dot';$('beat-dots').append(n);return n});
const game=CoreRules.create({
 level:(level,t)=>{audio?.setLevel(level,audio.origin+t/1000)},
 sfx:(...a)=>audio?.sfx(...a),
 fill:(id,quality,t)=>audio?.requestFill(id,quality,audio.origin+t/1000),
 finish:(winner,stats)=>{$('result-title').textContent=winner==='player'?'Ритм на твоей стороне.':'Ещё один раунд?';$('result-stats').replaceChildren(...[['Точность',Math.round(100*(stats.perfect+stats.good)/Math.max(1,stats.perfect+stats.good+stats.off))+'%'],['Комбо',stats.combos],['Макс. энергия',stats.maxLevel+'/5'],['Очки',stats.score]].map(([name,value])=>{const d=document.createElement('div');d.className='statline';const b=document.createElement('b');b.textContent=value;d.append(document.createTextNode(name),b);return d}));$('result-overlay').hidden=false}
});
const s=game.s;
function resize(){w=app.clientWidth;h=app.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const top=$('energy-label').getBoundingClientRect().bottom-app.getBoundingClientRect().top+20,bottom=document.querySelector('.recipes').getBoundingClientRect().top-app.getBoundingClientRect().top-15;ground=bottom;scale=Math.min(w/290,(bottom-top)/160,1.9);scale=Math.max(.55,scale);worldLeft=w/2-180*scale;}
new ResizeObserver(resize).observe(app);resize();
function now(){return audio?.now()??0}
async function start(){
 if(started)return;started=true;$('start').disabled=true;
 try {const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('AudioContext недоступен');const ac=new AC({latencyHint:'interactive'});await ac.resume();audio=CoreAudio.create(ac);audio.start();game.reset(audio.now());$('start-overlay').hidden=true;resize()}
 catch(e){started=false;$('start').disabled=false;$('error').hidden=false;$('error').textContent='Не удалось запустить звук. Нажмите «Начать бой» ещё раз. '+e.message}
}
async function pause(){if(!audio||paused||s.mode!=='fight')return;paused=true;s.block=false;s.buffer=null;$('block').classList.remove('pressed');await audio.ctx.suspend();$('pause-overlay').hidden=false}
async function resume(){if(!audio||!paused)return;await audio.ctx.resume();paused=false;$('pause-overlay').hidden=true}
async function rematch(){if(!audio)return;await audio.ctx.resume();paused=false;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;game.reset(now())}
$('start').onclick=start;$('pause').onclick=()=>pause();$('resume').onclick=resume;$('restart').onclick=rematch;$('rematch').onclick=rematch;
$('mute').onclick=()=>{if(!audio)return;audio.mute(!audio.muted);$('mute').textContent=audio.muted?'БЕЗ ЗВУКА':'ЗВУК';$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'Включить звук':'Выключить звук')};
function press(key){if(!paused&&audio)game.input(key,now())}
for(const [id,key]of [['hand','L'],['foot','H'],['special','S']]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();press(key)});$(id).addEventListener('click',e=>{if(e.detail===0)press(key)})}
$('dodge').addEventListener('pointerdown',e=>{e.preventDefault();if(!paused)game.dodge(now())});$('dodge').onclick=e=>{if(e.detail===0&&!paused)game.dodge(now())};
$('block').addEventListener('pointerdown',e=>{e.preventDefault();if(paused||s.mode!=='fight')return;$('block').setPointerCapture(e.pointerId);s.block=true;$('block').classList.add('pressed')});
function release(){s.block=false;$('block').classList.remove('pressed')}
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('block').addEventListener(name,release);
const heldKeys=new Set();window.addEventListener('keydown',e=>{if(['KeyJ','KeyK','KeyI','KeyL','Space','Escape'].includes(e.code))e.preventDefault();if(heldKeys.has(e.code))return;heldKeys.add(e.code);if(e.code==='Escape'){if(paused)resume();else pause()}if(paused)return;if(e.code==='KeyJ')press('L');if(e.code==='KeyK')press('H');if(e.code==='KeyI')press('S');if(e.code==='KeyL')game.dodge(now());if(e.code==='Space'){s.block=true;$('block').classList.add('pressed')}});
window.addEventListener('keyup',e=>{heldKeys.delete(e.code);if(e.code==='Space')release()});window.addEventListener('blur',()=>{heldKeys.clear();release();pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){release();pause()}});
function line(a,b,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
function circle(p,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fill()}
function fighter(a,sk,t,enemy=false){
 const level=enemy?1:s.level,skin=enemy?'#b98f78':'#d6a785',cloth=enemy?'#5f3031':'#234b47',accent=enemy?'#ed8d77':'#a7f3cf',limbs=sk.limbs;
 ctx.save();ctx.translate(worldLeft+a.x*scale,ground);ctx.scale(scale*a.facing,scale);
 ctx.fillStyle='#06111470';ctx.beginPath();ctx.ellipse(0,2,43,7,0,0,Math.PI*2);ctx.fill();
 if(level>=2){const aura=ctx.createRadialGradient(sk.hip[0],-78,10,sk.hip[0],-78,level>=4?90:70);aura.addColorStop(0,`rgba(129,240,188,${.025*level})`);aura.addColorStop(1,'rgba(129,240,188,0)');ctx.fillStyle=aura;ctx.fillRect(-95,-185,195,195)}
 function leg(l,back){line(l.start,l.joint,13,back?'#172f30':cloth);line(l.joint,l.end,9,skin);line(l.end,[l.end[0]+10,l.end[1]-1],8,back?'#263e3b':'#507166');line(l.start,[l.start[0]+(l.joint[0]-l.start[0])*.50,l.start[1]+(l.joint[1]-l.start[1])*.50],14,cloth)}
 function arm(l,back){line(l.start,l.joint,10,back?'#a37e65':skin);line(l.joint,l.end,8,back?'#ac856a':skin);line([l.joint[0]+(l.end[0]-l.joint[0])*.72,l.joint[1]+(l.end[1]-l.joint[1])*.72],l.end,10,'#a3bcb0');circle(l.end,7,accent)}
 leg(limbs.rightLeg,true);arm(limbs.rightArm,true);
 // Clothing follows all three fixed spine links, including the flexible waist.
 for(let i=0;i<3;i++)line(sk.sp[i],sk.sp[i+1],i===2?22:19,cloth);
 line(sk.hip,[sk.hip[0]+3,sk.hip[1]-5],20,accent);leg(limbs.leftLeg,false);
 line([sk.sp[1][0]+7,sk.sp[1][1]],[sk.sp[3][0]+7,sk.sp[3][1]+6],2,accent);
 const neck=[sk.shoulder[0]+1,sk.shoulder[1]-7],head=[neck[0]+2,neck[1]-12];line(sk.shoulder,neck,10,skin);circle(head,11,skin);
 ctx.fillStyle=enemy?'#332522':'#1f302e';ctx.beginPath();ctx.arc(head[0]-2,head[1]-3,11,Math.PI,Math.PI*2.12);ctx.fill();
 line([head[0]+7,head[1]-1],[head[0]+11,head[1]-1],level>=4?2.6:1.5,level>=4?'#d8ffbd':'#243633');line([head[0]+10,head[1]+5],[head[0]+6,head[1]+6],1,'#90654f');
 arm(limbs.leftArm,false);
 if(level>=4&&!reduced){for(let i=0;i<level-2;i++){const x=Math.sin(t*.002+i*3)*40,y=-30-((t*.03+i*31)%120);circle([x,y],1.1,accent)}}
 ctx.restore();
}
function background(t){
 ctx.fillStyle='#0a1a1d';ctx.fillRect(0,0,w,h);const sky=ctx.createLinearGradient(0,h*.2,0,ground);sky.addColorStop(0,'#0a1a1d');sky.addColorStop(1,'#234039');ctx.fillStyle=sky;ctx.fillRect(0,0,w,ground);
 ctx.strokeStyle='#93c4ae14';ctx.lineWidth=1;for(let i=-3;i<7;i++){const x=w*.5+i*90*scale;ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(w*.5+(x-w*.5)*.45,ground*.42);ctx.stroke()}
 ctx.fillStyle='#07191e';for(let i=0;i<10;i++){const bh=30+((i*47)%79);ctx.fillRect(i*w/9-8,ground-bh*scale,w/11,bh*scale);ctx.fillStyle='#56715b35';ctx.fillRect(i*w/9+4,ground-bh*scale+8,2,bh*scale*.55);ctx.fillStyle='#07191e'}
 line([0,ground],[w,ground],2,'#5f9b7a');const floor=ctx.createLinearGradient(0,ground,0,h);floor.addColorStop(0,'#112a26');floor.addColorStop(1,'#081416');ctx.fillStyle=floor;ctx.fillRect(0,ground+2,w,h-ground);
 for(let i=1;i<5;i++){const y=ground+i*i*6;line([0,y],[w,y],1,'#a7f3cf09')}
 ctx.font='600 10px ui-monospace,monospace';ctx.fillStyle='#668b7850';ctx.textAlign='center';ctx.fillText('CORE CIRCUIT / 120',w*.5,ground+22);
}
function render(t){
 ctx.setTransform(dpr,0,0,dpr,0,0);background(t);
 const freeze=s.freeze&&t<=s.freeze.until?s.freeze:null,player=freeze?.player??CoreRig.skeleton(game.getPose(s.player,t)),enemy=freeze?.enemy??CoreRig.skeleton(game.getPose(s.enemy,t));
 if(++drawCount%30===0){if(!CoreRig.measure(player).valid||!CoreRig.measure(enemy).valid)auditErrors++}
 if(s.level>=3&&!reduced&&s.player.action&&t-s.player.action.start<300){const limb=player.limbs[CoreRig.moves[s.player.action.move].limb];s.trails.push({x:s.player.x+limb.end[0],y:limb.end[1],at:t});if(s.trails.length>14)s.trails.shift()}
 for(const p of s.trails){const a=Math.max(0,1-(t-p.at)/140);circle([worldLeft+p.x*scale,ground+p.y*scale],3*scale,`rgba(167,243,207,${a*.25})`)}
 ctx.save();if(freeze&&!reduced)ctx.translate(Math.sin(t*.15)*1.6,Math.cos(t*.13)*.8);fighter(s.enemy,enemy,t,true);fighter(s.player,player,t,false);ctx.restore();
 for(const p of s.particles){const age=(t-p.at)/1000,alpha=1-age/.42;if(alpha<=0)continue;const x=worldLeft+(p.x+p.vx*age)*scale,y=ground+(p.y+p.vy*age+90*age*age)*scale;line([x,y],[x-p.vx*.035*scale,y-p.vy*.035*scale],p.strong?2:1,`rgba(240,246,205,${alpha})`)}
 if(t<s.flash&&!reduced){ctx.fillStyle=`rgba(200,241,214,${Math.min(1,Math.max(0,(s.flash-t)/110))*.07})`;ctx.fillRect(0,0,w,h)}
}
function hud(t){
 $('hp-player').style.width=100*s.player.hp/s.player.maxHP+'%';$('hp-enemy').style.width=100*s.enemy.hp/s.enemy.maxHP+'%';$('hp-player-label').textContent=Math.ceil(s.player.hp);$('hp-enemy-label').textContent=Math.ceil(s.enemy.hp);$('clock').textContent=s.mode==='idle'?'60':Math.max(0,Math.ceil((s.end-t)/1000))||'00';
 const phase=t/500,whole=Math.floor(phase),fraction=phase-whole;
 nodes.forEach((n,i)=>{const beat=whole+i-5;n.style.left=50+(i-5-fraction)*22+'%';n.classList.toggle('major',beat%4===0)});
 const count=t<s.start?Math.ceil((s.start-t)/500):0;
 if(count>0&&s.mode==='fight'){$('feedback').textContent=count;$('feedback').style.color='#a7f3cf';$('feedback').style.opacity=1}
 else if(s.feedback&&t-s.feedback.at<780){$('feedback').replaceChildren(document.createTextNode(s.feedback.label));if(s.feedback.detail){const small=document.createElement('small');small.textContent=s.feedback.detail;$('feedback').append(small)}$('feedback').style.color=s.feedback.color;$('feedback').style.opacity=Math.min(1,(780-t+s.feedback.at)/200)}else $('feedback').style.opacity=0;
 $('energy-label').textContent='ЭНЕРГИЯ '+s.level;document.querySelectorAll('.energy i').forEach((n,i)=>n.classList.toggle('on',i<s.level));$('music-level').textContent='♫ '+(audio?audio.levelAt(audio.ctx.currentTime):1);
 $('special').disabled=s.energy<30||s.mode!=='fight'||paused;$('danger').style.opacity=s.telegraph?1:0;
 for(const n of document.querySelectorAll('.recipe'))n.classList.toggle('active',!!s.series&&n.dataset.recipe.startsWith(s.series.prefix));
 $('beat-text').textContent=count?'СЛУШАЙ ДОЛЮ · ГОТОВЬСЯ':s.mode==='result'?'CORE CIRCUIT · 120 BPM':s.player.action?.strong&&t<s.player.ready?'ВОССТАНОВЛЕНИЕ · ПРОПУСТИ ОДНУ ДОЛЮ':'НАЖИМАЙ НА ДОЛЮ · 120 BPM';
}
function frame(){const t=now();if(!paused)game.step(t);render(t);hud(t);lastFrame=t;requestAnimationFrame(frame)}
// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.
requestAnimationFrame(frame);
})();
