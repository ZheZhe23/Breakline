(()=>{
'use strict';
const $=id=>document.getElementById(id),app=$('app'),canvas=$('arena'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults={difficulty:'rookie',haptic:true,latency:0,bests:{}},prefs=(()=>{try{const p=JSON.parse(localStorage.getItem('breakline.afterhours.v2')||'null');return p&&typeof p==='object'?{...defaults,...p,bests:p.bests&&typeof p.bests==='object'?p.bests:{}}:{...defaults}}catch{return {...defaults}}})();
if(!CoreRules.DIFFICULTIES[prefs.difficulty])prefs.difficulty='rookie';prefs.latency=Math.max(-250,Math.min(250,Number(prefs.latency)||0));
const save=()=>{try{localStorage.setItem('breakline.afterhours.v2',JSON.stringify(prefs))}catch{}};
let audio=null,paused=false,starting=false,matchOffset=0,selected=prefs.difficulty,w=390,h=844,dpr=1,scale=1,ground=600,worldLeft=0,backdrop=null,hudBottom=110,drawCount=0,auditErrors=0,focusRecipe=null,lastHaptic=-1000,lastTrail=-1000;
const now=()=>audio?audio.now()+matchOffset:0;
function vibrate(strong=false){const t=now();if(prefs.haptic&&navigator.vibrate&&t-lastHaptic>110){navigator.vibrate(strong?[13,12,17]:8);lastHaptic=t}}
const game=CoreRules.create({level:l=>audio?.setLevel(l),sfx:(kind,strong)=>{audio?.sfx(kind,strong);if(kind==='hit'||kind==='counter')vibrate(strong)},fill:(id,q)=>audio?.requestFill(id,q),warning:beat=>audio?.warning(beat-matchOffset),finish:showResult});
const s=game.s;
const beatNodes=Array.from({length:9},()=>{const n=document.createElement('i');n.className='beat-node';$('beat-dots').append(n);return n});
function selectDifficulty(value){selected=value;document.querySelectorAll('.difficulty').forEach(n=>{const yes=n.dataset.difficulty===value;n.classList.toggle('selected',yes);n.setAttribute('aria-pressed',String(yes))});const best=prefs.bests[value];$('best-label').textContent=best?'ЛИЧНЫЙ РЕКОРД '+best.score+' · РАНГ '+best.rank:'45 секунд · оригинальный грув · наушники рекомендуются'}
selectDifficulty(selected);for(const n of document.querySelectorAll('.difficulty'))n.onclick=()=>selectDifficulty(n.dataset.difficulty);
function resize(){w=app.clientWidth;h=app.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const rect=app.getBoundingClientRect();hudBottom=document.querySelector('.energy').getBoundingClientRect().bottom-rect.top;ground=document.querySelector('.bottom').getBoundingClientRect().top-rect.top-9;scale=Math.max(.4,Math.min(w/170,(ground-hudBottom-42)/152,2.3));worldLeft=w*.5-180*scale;backdrop=createBackdrop();const head=ground-150*scale;$('feedback').style.top=Math.max(hudBottom+3,head-65)+'px';$('intent').style.top=Math.max(hudBottom+8,head-25)+'px';$('guard-hint').style.top=Math.max(hudBottom+35,head+5)+'px'}
new ResizeObserver(resize).observe(app);
async function startFight(difficulty=selected){
 if(starting)return;starting=true;$('start').disabled=true;
 try{
  if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Браузер не поддерживает Web Audio');const ac=new AC({latencyHint:'interactive'});await ac.resume();audio=CoreAudio.create(ac);audio.start()}else await audio.ctx.resume();
  prefs.difficulty=difficulty;save();selected=difficulty;matchOffset=prefs.latency;paused=false;focusRecipe=null;game.reset(now(),difficulty);
  for(const id of ['start-overlay','pause-overlay','result-overlay'])$(id).hidden=true;resize();$('start-error').hidden=true;
 }catch(e){$('start-error').hidden=false;$('start-error').textContent='Нажми ещё раз, чтобы включить звук. '+e.message}finally{starting=false;$('start').disabled=false}
}
async function pause(){if(!audio||paused||!['fight','ending'].includes(s.mode))return;paused=true;game.release(now());s.buffer=null;held.clear();$('defend').classList.remove('pressed');await audio.ctx.suspend();$('pause-overlay').hidden=false;syncSettings()}
async function resume(){if(!audio||!paused)return;await audio.ctx.resume();paused=false;$('pause-overlay').hidden=true}
function syncSettings(){$('haptic-toggle').textContent=prefs.haptic?'ВКЛ':'ВЫКЛ';$('haptic-toggle').setAttribute('aria-pressed',String(prefs.haptic));$('latency').value=prefs.latency;$('latency-value').textContent=prefs.latency+' ms'}
$('haptic-toggle').onclick=()=>{prefs.haptic=!prefs.haptic;save();syncSettings()};$('latency').oninput=()=>{prefs.latency=Number($('latency').value);save();syncSettings()};
$('start').onclick=()=>startFight();$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=()=>startFight(s.difficulty);$('rematch').onclick=()=>startFight(s.difficulty);
$('next-difficulty').onclick=()=>startFight(s.difficulty==='rookie'?'fighter':'master');$('back-menu').onclick=()=>{$('result-overlay').hidden=true;$('start-overlay').hidden=false;selectDifficulty(s.difficulty)};
$('mute').onclick=()=>{if(!audio)return;audio.mute(!audio.muted);$('mute').textContent=audio.muted?'×':'♫';$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'Включить звук':'Выключить звук')};
function showResult(winner,stats,rating){
 const won=winner==='player',old=prefs.bests[s.difficulty],better=!old||stats.score>old.score;
 if(better){prefs.bests[s.difficulty]={score:stats.score,rank:rating.rank};save()}
 $('rank').textContent=rating.rank;$('result-title').textContent=won?'Это был твой бит.':'Ты уже слышишь его.';$('result-subtitle').textContent=won?'Теперь сделай это ещё чище.':stats.dodges?'Больше точных серий. Меньше лишних ударов.':'На красную долю — точный уход.';
 $('result-stats').replaceChildren(...[['ОЧКИ',stats.score],['ТОЧНОСТЬ',rating.accuracy+'%'],['УХОДЫ / КОНТРЫ',stats.dodges+' / '+stats.counters],['ФИНАЛЫ',stats.variety.length+' / 3']].map(([label,value])=>{const n=document.createElement('div');n.className='stat';const b=document.createElement('b');b.textContent=value;n.append(b,document.createTextNode(label));return n}));
 $('new-best').textContent=better?'↑ НОВЫЙ ЛИЧНЫЙ РЕКОРД':'ЛИЧНЫЙ РЕКОРД '+old.score;$('next-difficulty').hidden=!won||s.difficulty==='master';$('next-difficulty').textContent=s.difficulty==='rookie'?'ДАЛЬШЕ: ДУЭЛЬ →':'ДАЛЬШЕ: МАСТЕР →';$('result-overlay').hidden=false;
}
function eventAt(e,t=now()){const age=e&&Number.isFinite(e.timeStamp)?performance.now()-e.timeStamp:0;return t-(age>=0&&age<1000?age:0)}
function press(key,event){if(!audio||paused)return;const t=now();game.step(t);const result=game.input(key,eventAt(event,t),t);if(!result.accepted&&result.reason==='recovery'){$('coach-text').textContent='ВЫДОХ. СЛЕДУЮЩИЙ УДАР — ПОСЛЕ ВОССТАНОВЛЕНИЯ.'}}
for(const [id,key]of [['hand','L'],['foot','H'],['special','S']]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();press(key,e)});$(id).onclick=e=>{if(e.detail===0)press(key,e)}}
$('defend').addEventListener('pointerdown',e=>{e.preventDefault();if(paused||!audio)return;$('defend').setPointerCapture(e.pointerId);const t=now();game.step(t);game.defend(eventAt(e,t),t);$('defend').classList.add('pressed')});
function release(){game.release(now());$('defend').classList.remove('pressed')}
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('defend').addEventListener(type,release);$('defend').onclick=e=>{if(e.detail===0&&!paused&&audio){const t=now();game.step(t);game.defend(eventAt(e,t),t);game.release(t)}};
for(const n of document.querySelectorAll('.combo'))n.onclick=()=>{focusRecipe=n.dataset.recipe};
const held=new Set();window.addEventListener('keydown',e=>{if(['KeyJ','KeyK','KeyI','Space','Escape'].includes(e.code))e.preventDefault();if(held.has(e.code))return;held.add(e.code);if(e.code==='Escape'){paused?resume():pause();return}if(paused||!audio)return;if(e.code==='KeyJ')press('L',e);if(e.code==='KeyK')press('H',e);if(e.code==='KeyI')press('S',e);if(e.code==='Space'){const t=now();game.step(t);game.defend(eventAt(e,t),t);$('defend').classList.add('pressed')}});window.addEventListener('keyup',e=>{held.delete(e.code);if(e.code==='Space')release()});window.addEventListener('blur',()=>{held.clear();release();pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();release();pause()}});
function createBackdrop(){
 const c=document.createElement('canvas');c.width=w*dpr;c.height=h*dpr;const b=c.getContext('2d');b.scale(dpr,dpr);
 const sky=b.createLinearGradient(0,0,0,ground);sky.addColorStop(0,'#111020');sky.addColorStop(.55,'#20132f');sky.addColorStop(1,'#3b1e43');b.fillStyle=sky;b.fillRect(0,0,w,h);
 b.fillStyle='#0c0b18';for(let i=0;i<12;i++){const x=i*w/11-10,bh=(70+i*13%120)*scale*.8;b.fillRect(x,ground-bh,w/9,bh);b.fillStyle='#ad74a51b';for(let j=0;j<4;j++)for(let k=0;k<4;k++)b.fillRect(x+7+j*9,ground-bh+12+k*20,3,6);b.fillStyle='#0c0b18'}
 b.save();b.translate(w/2,Math.max(hudBottom+75,ground-160*scale));b.rotate(-.07);b.textAlign='center';b.font='italic 950 '+Math.min(w*.17,100)+'px system-ui';b.lineWidth=1;b.strokeStyle='#c591bb26';b.strokeText('AFTER',-10,0);b.strokeText('HOURS',10,Math.min(w*.16,95));b.restore();
 b.strokeStyle='#bf7ec726';b.lineWidth=1;for(let i=-4;i<9;i++){b.beginPath();b.moveTo(w*.5+(i-2)*35*scale,ground-20);b.lineTo(w*.5+(i-2)*120*scale,h);b.stroke()}
 const floor=b.createLinearGradient(0,ground-4,0,h);floor.addColorStop(0,'#38213a');floor.addColorStop(1,'#100e1b');b.fillStyle=floor;b.fillRect(0,ground,w,h-ground);
 for(let i=0;i<5;i++){const y=ground+i*i*9;b.strokeStyle='#cd81cc16';b.beginPath();b.moveTo(0,y);b.lineTo(w,y);b.stroke()}
 b.fillStyle='#aa728d';b.fillRect(0,ground,w,2);return c;
}
function line(a,b,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
function circle(p,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fill()}
function taper(a,b,wa,wb,color){const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a[0]+nx*wa,a[1]+ny*wa);ctx.quadraticCurveTo(a[0]+dx*.45+nx*(wa+1),a[1]+dy*.45+ny*(wa+1),b[0]+nx*wb,b[1]+ny*wb);ctx.quadraticCurveTo(b[0]+dx*.1,b[1]+dy*.1,b[0]-nx*wb,b[1]-ny*wb);ctx.quadraticCurveTo(a[0]+dx*.45-nx*wa,a[1]+dy*.45-ny*wa,a[0]-nx*wa,a[1]-ny*wa);ctx.closePath();ctx.fill()}
function fighter(a,sk,t,enemy=false){
 const level=enemy?Math.min(3,s.phase):s.level,skin=enemy?'#b98573':'#dba889',shadow=enemy?'#805851':'#9f735e',cloth=enemy?'#5a263e':'#302a58',dark=enemy?'#301b33':'#1b2039',accent=enemy?'#ff638f':level===5?'#efffb8':'#ddff78',L=sk.limbs;
 ctx.save();ctx.translate(worldLeft+a.x*scale,ground);ctx.scale(scale*a.facing,scale);
 if(++drawCount%45===0&&!CoreRig.measure(sk,ctx.getTransform(),dpr*scale).valid)auditErrors++;
 ctx.fillStyle='#06051088';ctx.beginPath();ctx.ellipse(0,2,38,5.5,0,0,Math.PI*2);ctx.fill();
 if(level>=2){const g=ctx.createRadialGradient(sk.hip[0],-70,4,sk.hip[0],-70,86);g.addColorStop(0,enemy?'#ff638f16':`rgba(221,255,120,${.018*level})`);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(-100,-185,200,195)}
 if(!enemy&&level===5&&!reduced){ctx.save();ctx.scale(1,.25);ctx.strokeStyle='#e8ffa84d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,40+Math.sin(t*.008)*2,0,Math.PI*2);ctx.stroke();ctx.restore()}
 function leg(l,back){taper(l.start,l.joint,7,5.8,back?dark:cloth);taper(l.joint,l.end,5.1,3.4,back?shadow:skin);const mid=[l.start[0]+(l.joint[0]-l.start[0])*.58,l.start[1]+(l.joint[1]-l.start[1])*.58];taper(l.start,mid,8,7,back?dark:cloth);line(l.joint,[l.joint[0]+(l.end[0]-l.joint[0])*.4,l.joint[1]+(l.end[1]-l.joint[1])*.4],6.5,back?'#998485':'#c9c5cd');line(l.end,[l.end[0]+9,l.end[1]-1],7,back?'#181729':'#302540');line([l.end[0]-2,l.end[1]+2],[l.end[0]+10,l.end[1]+1],1.5,accent)}
 function arm(l,back){taper(l.start,l.joint,6.2,4.4,back?shadow:skin);circle(l.start,6,back?shadow:skin);taper(l.joint,l.end,4.6,3.4,back?shadow:skin);const wrap=[l.joint[0]+(l.end[0]-l.joint[0])*.7,l.joint[1]+(l.end[1]-l.joint[1])*.7];line(wrap,l.end,8,'#bfb3c5');ctx.save();ctx.translate(...l.end);ctx.rotate(l.lower);ctx.fillStyle=back?(enemy?'#c34d72':'#a7c557'):accent;ctx.beginPath();ctx.ellipse(0,0,7.3,6,0,0,Math.PI*2);ctx.fill();line([-4,-2],[2,-3],1,'#fff6');ctx.restore()}
 leg(L.rightLeg,true);arm(L.rightArm,true);
 const sp=sk.sp;for(let i=0;i<3;i++)taper(sp[i],sp[i+1],i===0?9:12,i===2?14:12,cloth);
 line([sp[1][0]-7,sp[1][1]],[sp[3][0]-8,sp[3][1]+5],3,dark);line([sp[1][0]+7,sp[1][1]-2],[sp[3][0]+9,sp[3][1]+5],2,accent);
 taper([sp[0][0]-1,sp[0][1]+3],[sp[0][0]-1,sp[0][1]-3],11,10,accent);leg(L.leftLeg,false);
 const neck=[sk.shoulder[0]+1,sk.shoulder[1]-7],head=[neck[0]+2,neck[1]-10];line(sk.shoulder,neck,9,skin);
 ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(head[0]-8,head[1]-8);ctx.quadraticCurveTo(head[0]+10,head[1]-13,head[0]+11,head[1]+2);ctx.lineTo(head[0]+8,head[1]+10);ctx.lineTo(head[0]-2,head[1]+11);ctx.quadraticCurveTo(head[0]-11,head[1]+5,head[0]-8,head[1]-8);ctx.fill();
 ctx.fillStyle=enemy?'#30202d':'#17172b';ctx.beginPath();ctx.moveTo(head[0]-9,head[1]-2);ctx.lineTo(head[0]-10,head[1]-10);ctx.quadraticCurveTo(head[0]+2,head[1]-18,head[0]+11,head[1]-7);ctx.lineTo(head[0]+8,head[1]-3);ctx.closePath();ctx.fill();
 line([head[0]+1,head[1]-2],[head[0]+10,head[1]-1],1.8,'#453345');line([head[0]+8,head[1]+1],[head[0]+10,head[1]+1],level>=4?2:1,level>=4?accent:'#2a202d');line([head[0]+8,head[1]+7],[head[0]+4,head[1]+7],1,'#93655f');
 if(!enemy){line([head[0]-7,head[1]-3],[head[0]+9,head[1]-2],2.2,accent);line([head[0]-9,head[1]-2],[head[0]-15,head[1]+4+Math.sin(t*.01)*2],2,accent)}
 arm(L.leftArm,false);
 if(level>=4&&!enemy&&!reduced)for(let i=0;i<level;i++){const y=-15-(t*.035+i*29)%140,x=Math.sin(t*.002+i*3)*29;circle([x,y],1,accent)}
 const guard=enemy?game.getGuard(t):null;if(guard){const center=guard==='L'?[20,-130]:[18,-96];ctx.strokeStyle='#a49affaa';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(...center,16,-1.3,1.2);ctx.stroke()}
 ctx.restore();
}
function render(t){
 ctx.setTransform(dpr,0,0,dpr,0,0);if(backdrop)ctx.drawImage(backdrop,0,0,w,h);else ctx.clearRect(0,0,w,h);
 const phase=((t%500)+500)%500/500,pulse=Math.max(0,1-phase*4),stageY=ground-90*scale;
 if(!reduced){ctx.save();ctx.globalAlpha=.06+pulse*.07;ctx.fillStyle=s.phase===3?'#ff638f':'#a98aff';for(let i=0;i<3;i++){const x=w*(i+.5)/3;ctx.beginPath();ctx.moveTo(x,stageY-170*scale);ctx.lineTo(x-65*scale,ground);ctx.lineTo(x+35*scale,ground);ctx.fill()}ctx.restore()}
 for(let i=0;i<10;i++){const x=(i+.3)*w/10,bar=(12+(Math.sin(i*2.3+t*.002)+1)*8+pulse*11)*scale;ctx.fillStyle=i%2?'#b77cbd35':'#ff638f26';ctx.fillRect(x,ground-bar,3,bar)}
 const frozen=s.freeze&&t<s.freeze.until?s.freeze:null,player=frozen?.player??CoreRig.skeleton(game.getPose(s.player,t)),enemy=frozen?.enemy??CoreRig.skeleton(game.getPose(s.enemy,t));
 if(s.level>=3&&!reduced&&!frozen&&t-lastTrail>16&&s.player.action&&t-s.player.action.start<300){const l=player.limbs[CoreRig.moves[s.player.action.move].limb];s.trails.push({x:s.player.x+l.end[0],y:l.end[1],at:t});lastTrail=t;if(s.trails.length>14)s.trails.shift()}
 for(const p of s.trails){const age=t-p.at;if(age<0||age>145)continue;circle([worldLeft+p.x*scale,ground+p.y*scale],(s.level===5?4:2.5)*scale,`rgba(221,255,120,${(1-age/145)*.20})`)}
 ctx.save();if(frozen&&!reduced)ctx.translate(Math.sin(t*.12)*2.5,Math.cos(t*.1)*1.2);fighter(s.enemy,enemy,t,true);fighter(s.player,player,t);ctx.restore();
 for(const p of s.particles){const age=(t-p.at)/1000;if(age<0||age>.44)continue;const x=worldLeft+(p.x+p.vx*age)*scale,y=ground+(p.y+p.vy*age+90*age*age)*scale;ctx.globalAlpha=1-age/.44;line([x,y],[x-p.vx*.025*scale,y-p.vy*.025*scale],p.strong?2.5:1.5,p.kind==='guard'?'#c0b3ff':p.kind==='enemy'?'#ff638f':'#edffa4');ctx.globalAlpha=1}
 if(t<s.flash&&!reduced){ctx.fillStyle=`rgba(225,215,255,${Math.min(1,Math.max(0,(s.flash-t)/100))*.07})`;ctx.fillRect(0,0,w,h)}
}
const feedbackStrong=$('feedback').querySelector('strong'),feedbackSmall=$('feedback').querySelector('small');let lastMessage=null;
function hud(t){
 $('hp-player').style.width=100*s.player.hp/s.player.maxHP+'%';$('hp-enemy').style.width=100*s.enemy.hp/s.enemy.maxHP+'%';$('hp-player-label').textContent=Math.ceil(s.player.hp);$('hp-enemy-label').textContent=Math.ceil(s.enemy.hp);$('clock').textContent=s.mode==='idle'?'45':String(Math.min(45,Math.max(0,Math.ceil((s.end-t)/1000)))).padStart(2,'0');
 const phase=t/500,whole=Math.floor(phase),fraction=phase-whole;
 for(let i=0;i<beatNodes.length;i++){const beat=whole+i-1,n=beatNodes[i],danger=s.incoming&&!s.incoming.cancelled&&Math.round(s.incoming.beatAt/500)===beat;n.style.left=25+(i-1-fraction)*23+'%';n.className='beat-node'+(danger?' danger':beat%4===0?' down':'')+(s.player.action?.strong&&beat*500<s.player.ready&&beat*500>s.player.action.start?' rest':'')}
 const count=t<s.start?Math.ceil((s.start-t)/500):0;
 if(count>0&&s.mode==='fight'){feedbackStrong.textContent=String(Math.min(3,count));feedbackSmall.textContent='СЛУШАЙ БИТ';$('feedback').style.color='var(--lime)';$('feedback').style.opacity=1;lastMessage=null}
 else if(s.mode==='fight'&&t<s.start+250&&!s.feedback){feedbackStrong.textContent='GO';feedbackSmall.textContent='ТВОЙ БИТ';$('feedback').style.color='var(--lime)';$('feedback').style.opacity=1}
 else if(s.feedback&&t-s.feedback.at<850){if(lastMessage!==s.feedback){feedbackStrong.textContent=s.feedback.label;feedbackSmall.textContent=s.feedback.detail;lastMessage=s.feedback}$('feedback').style.color=({perfect:'var(--lime)',good:'var(--paper)',combo:'var(--lime)',counter:'var(--blue)',off:'var(--pink)',hurt:'var(--pink)',guard:'var(--blue)'})[s.feedback.kind];$('feedback').style.opacity=Math.min(1,(850-t+s.feedback.at)/200)}else $('feedback').style.opacity=0;
 $('energy-label').textContent='GROOVE '+s.level;document.querySelectorAll('.energy i').forEach((n,i)=>n.classList.toggle('on',i<s.level));$('streak').textContent='×'+s.streak;
 $('special').disabled=s.energy<40||s.mode!=='fight'||paused;$('special').classList.toggle('ready',s.energy>=40);$('special').textContent=s.energy>=40?'✦ BREAK · I':'✦ BREAK · 40';
 const warning=game.warning(t);$('intent').style.opacity=warning?1:0;const guard=game.getGuard(t);$('guard-hint').style.opacity=guard&&!warning?1:0;$('guard-hint').textContent=guard==='L'?'ЗАЩИЩАЕТ ГОЛОВУ → НОГА':'ЗАЩИЩАЕТ КОРПУС → РУКА';
 const prefix=s.series?.prefix??'';for(const n of document.querySelectorAll('.combo')){n.classList.toggle('active',prefix?n.dataset.recipe.startsWith(prefix):n.dataset.recipe===focusRecipe);n.classList.toggle('done',s.stats.variety.includes(n.dataset.recipe))}
 const rest=!!(s.player.action?.strong&&t<s.player.ready);document.querySelector('.controls').classList.toggle('recovering',rest);
 $('coach-text').textContent=t<s.start?'СЛУШАЙ. НАЖИМАЙ ПРЯМО НА ДОЛЮ.':warning?'КРАСНАЯ ДОЛЯ → ТОЧНЫЙ УХОД':t<s.counterUntil?'КОНТРА ОТКРЫТА → РУКА ИЛИ НОГА':rest?'ВЫДОХ · ЗАЩИТА ДОСТУПНА':focusRecipe?'ТВОЙ ФИНАЛ: '+focusRecipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · '):s.stats.combos===0?'ПОПРОБУЙ Р · Р · Н. ЗАТЕМ ОДНА ДОЛЯ ВЫДОХА.':'СМЕНИ СЕРИЮ. СОБЕРИ ТРИ РАЗНЫХ ФИНАЛА.';
 $('scene-name').textContent=s.phase===1?'AFTERHOURS':s.phase===2?'PRESSURE':'LAST LIGHT';
}
resize();function frame(){const t=now();if(!paused)game.step(t);render(t);hud(t);requestAnimationFrame(frame)}
// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.
requestAnimationFrame(frame);
})();
