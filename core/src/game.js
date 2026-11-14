(()=>{
'use strict';
const $=id=>document.getElementById(id),app=$('app'),canvas=$('arena'),ctx=canvas.getContext('2d'),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionQuery.matches;
const defaults={difficulty:'rookie',fighter:'nova',lesson:0,trainingComplete:false,haptic:true,latency:0,bests:{}},prefs=(()=>{try{const p=JSON.parse(localStorage.getItem('breakline.afterhours.v3')||localStorage.getItem('breakline.afterhours.v2')||'null');return p&&typeof p==='object'?{...defaults,...p,bests:p.bests&&typeof p.bests==='object'?p.bests:{}}:{...defaults}}catch{return {...defaults}}})();
if(!CoreRules.DIFFICULTIES[prefs.difficulty])prefs.difficulty='rookie';prefs.fighter=CoreFighters.get(prefs.fighter).id;
prefs.latency=Math.max(-250,Math.min(250,Number(prefs.latency)||0));prefs.lesson=Number.isInteger(Number(prefs.lesson))&&Number(prefs.lesson)>=0&&Number(prefs.lesson)<13?Number(prefs.lesson):0;prefs.trainingComplete=prefs.trainingComplete===true;prefs.haptic=prefs.haptic!==false;
const validBests={};for(const id of Object.keys(CoreFighters.roster))for(const d of Object.keys(CoreRules.DIFFICULTIES)){const key=id+':'+d,v=prefs.bests[key];if(v&&Number.isFinite(v.score)&&v.score>=0&&['S','A','B','C','D'].includes(v.rank))validBests[key]={score:Math.min(Number.MAX_SAFE_INTEGER,Math.floor(v.score)),rank:v.rank}}prefs.bests=validBests;
for(const key of Object.keys(prefs))if(!Object.hasOwn(defaults,key))delete prefs[key];
const save=()=>{try{localStorage.setItem('breakline.afterhours.v3',JSON.stringify(prefs))}catch{}};
let audio=null,paused=false,starting=false,matchOffset=0,selected=prefs.difficulty,selectedFighter=CoreFighters.get(prefs.fighter).id,w=390,h=844,dpr=1,scale=1,ground=600,worldLeft=0,railWidth=360,backdrop=null,hudBottom=110,drawCount=0,auditErrors=0,focusRecipe=null,dojoOptions={mode:'dummy',enemy:null},lastHaptic=-1000,lastTrail=-1000,paintDirty=true,paintCount=0,loopTicks=0,lastLoopState='',audioQueue=Promise.resolve(),audioCommand=0,audioDesired=false,lifecycleEpoch=0;
const now=()=>audio?audio.now(matchOffset):0;
function invalidate(){paintDirty=true}
function canInput(){return !!audio&&!paused&&!starting&&!document.hidden&&audio.ctx.state==='running'}
function requestAudio(running){
 const instance=audio,command=++audioCommand;audioDesired=running;
 const operation=audioQueue.catch(()=>{}).then(async()=>{
  if(command!==audioCommand||instance!==audio)return false;
  const ac=instance.ctx;if(ac.state==='closed')throw Error('closed');
  if(running&&document.hidden)return false;
  if(running&&ac.state!=='running')await ac.resume();
  if(!running&&ac.state!=='suspended')await ac.suspend();
  return command===audioCommand&&instance===audio&&(running?ac.state==='running':ac.state==='suspended');
 });audioQueue=operation.catch(()=>{});return operation;
}
function watchAudio(ac){ac.addEventListener('statechange',()=>{
 if(audio?.ctx!==ac)return;const active=['fight','ending','lessonWait'].includes(s.mode);
 if(ac.state==='closed'){audio.stop();if(active){if(!paused)pause();else{audioDesired=false;audioProblem(true)}}}
 else if(ac.state!=='running'&&!paused&&active)pause();
})}
function audioProblem(closed=false){$('pause-overlay').classList.add('audio-recovery');$('pause-overlay').classList.toggle('audio-closed',closed);$('resume').disabled=closed;$('audio-error').hidden=false;$('audio-error').textContent=closed?'Браузер отключил аудио. Нажми «'+$('restart').textContent+'», чтобы восстановить звук.':'Звук пока не включился. Нажми «Вернуться в бой» ещё раз.';invalidate()}
motionQuery.addEventListener('change',e=>{reduced=e.matches;invalidate()});
function vibrate(strong=false){const t=now();if(prefs.haptic&&navigator.vibrate&&t-lastHaptic>110){navigator.vibrate(strong?[13,12,17]:8);lastHaptic=t}}
const game=CoreRules.create({rhythmError:t=>audio?.rhythmError?.(t)??CoreRules.error(t),elapsedMs:(a,b)=>audio?.elapsedMs?.(a,b)??b-a,tempo:b=>audio?.setTempo?.(b),autoTempo:(t,cap)=>audio?.startRamp?.(t,cap),pinTempo:b=>audio?.pinTempo?.(b),scene:scene=>audio?.setScene?.(scene),resetTempo:()=>audio?.resetTempo?.(),bpmAt:t=>audio?.bpmAt?.(t)??120,level:l=>audio?.setLevel(l),sfx:(kind,strong)=>{audio?.sfx(kind,strong);if(kind==='hit'||kind==='counter')vibrate(strong)},fill:(id,q)=>audio?.requestFill(id,q),warning:(beat,id)=>audio?.warning(beat,id),cancelWarning:id=>audio?.cancelWarning?.(id),superCharge:id=>audio?.superCharge(id),superHit:id=>{audio?.superHit(id);vibrate(true)},finish:showResult});
const s=game.s;
const lessons=CoreLessons.create(game,{progress:(index,complete)=>{prefs.lesson=complete?0:index;prefs.trainingComplete=complete;save();updateTrainingButton()},complete:showTrainingResult});
function updateTrainingButton(){$('training-start').textContent=prefs.trainingComplete?'ПОВТОРИТЬ ОБУЧЕНИЕ':prefs.lesson?'ПРОДОЛЖИТЬ ОБУЧЕНИЕ · '+(prefs.lesson+1)+'/13':'ОБУЧЕНИЕ · ПО ШАГАМ'}
updateTrainingButton();
const beatNodes=Array.from({length:9},()=>{const n=document.createElement('i');n.className='beat-node';n.style.left='25%';$('beat-dots').append(n);return n});
function selectDifficulty(value){selected=value;document.querySelectorAll('.difficulty[data-difficulty]').forEach(n=>{const yes=n.dataset.difficulty===value;n.classList.toggle('selected',yes);n.setAttribute('aria-pressed',String(yes))});const best=prefs.bests[selectedFighter+':'+value];$('best-label').textContent=best?'ЛИЧНЫЙ РЕКОРД '+best.score+' · РАНГ '+best.rank:'45 секунд · оригинальный грув · наушники рекомендуются'}
function selectFighter(id){selectedFighter=CoreFighters.get(id).id;prefs.fighter=selectedFighter;save();for(const b of document.querySelectorAll('.fighter-card')){const yes=b.dataset.fighter===selectedFighter;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes))}$('fighter-tag').textContent=CoreFighters.get(id).tag;selectDifficulty(selected);updateRecipes(id)}
function updateRecipes(id){const entries=Object.entries(CoreFighters.get(id).recipes);document.querySelectorAll('.combo').forEach((n,i)=>{const [recipe,f]=entries[i];n.dataset.recipe=recipe;n.querySelector('b').textContent=recipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · ');n.querySelector('small').textContent=f.name})}
for(const f of Object.values(CoreFighters.roster)){const b=document.createElement('button');b.className='fighter-card';b.dataset.fighter=f.id;b.setAttribute('aria-label',f.name+' — '+f.style);const im=document.createElement('img');im.src=CoreSprites.assets[f.id].portrait;im.alt='';const name=document.createElement('b');name.textContent=f.name;b.append(im,name);b.onclick=()=>selectFighter(f.id);$('roster').append(b)}
selectFighter(selectedFighter);selectDifficulty(selected);for(const n of document.querySelectorAll('.difficulty[data-difficulty]'))n.onclick=()=>selectDifficulty(n.dataset.difficulty);
function resize(){w=app.clientWidth;h=app.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const rect=app.getBoundingClientRect();hudBottom=document.querySelector('.hud').getBoundingClientRect().bottom-rect.top;ground=document.querySelector('.bottom').getBoundingClientRect().top-rect.top-9;const landscape=w>550&&h<510,teaching=lessons.state.active,reserve=teaching&&!landscape?Math.max(100,$('lesson-panel').getBoundingClientRect().height+28):s.practice?62:42;scale=Math.max(.4,Math.min(w/210,(ground-hudBottom-reserve)/152,2.2));worldLeft=w*(teaching&&landscape?.64:.5)-180*scale;document.querySelector('.scene-label').style.top=(hudBottom+8)+'px';$('lesson-panel').style.top=(landscape?hudBottom+14:hudBottom+8)+'px';$('practice-tools').style.top=(hudBottom+8)+'px';railWidth=document.querySelector('.beat-rail').clientWidth;backdrop=createBackdrop();const head=ground-150*scale;$('feedback').style.top=Math.max(hudBottom+3+reserve,head-48)+'px';$('intent').style.top=Math.max(hudBottom+8,head-25)+'px';$('guard-hint').style.top=Math.max(hudBottom+35,head+5)+'px';invalidate()}
new ResizeObserver(resize).observe(app);
function startBusy(value){for(const b of document.querySelectorAll('#start,#training-start,#practice-start,#practice-go,#practice-cancel,.fighter-card,[data-difficulty],[data-opponent],[data-practice-mode]'))b.disabled=value;$('start-overlay').setAttribute('aria-busy',String(value));$('practice-panel').setAttribute('aria-busy',String(value))}
async function startFight(difficulty=selected,training=false,resumeLesson=0,practice=null){
 if(starting)return;starting=true;paused=true;const epoch=++lifecycleEpoch,fighterId=selectedFighter;let phase='audio';startBusy(true);
 try{
  if(!audio||audio.ctx.state==='closed'){
   const muted=audio?.muted??false;audio?.stop();const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Браузер не поддерживает Web Audio');
   const ac=new AC({latencyHint:'interactive'});audio=CoreAudio.create(ac);if(muted)audio.mute(true);watchAudio(ac);
  }
  const running=await requestAudio(true);if(epoch!==lifecycleEpoch)return;if(!running)throw Error('Не удалось включить звук');audio.start();phase='assets';
  const ids=Object.keys(CoreFighters.roster),enemy=practice?.enemy??ids[(ids.indexOf(fighterId)+1)%ids.length];await Promise.all([CoreSprites.load(fighterId),CoreSprites.load(enemy),CoreSprites.load('stage')]);if(epoch!==lifecycleEpoch)return;if(audio.ctx.state!=='running'){phase='audio';throw Error('audio interrupted during load')}CoreSprites.retain([fighterId,enemy]);
  prefs.difficulty=difficulty;prefs.fighter=fighterId;selectedFighter=fighterId;save();selected=difficulty;matchOffset=prefs.latency;paused=false;focusRecipe=null;auditErrors=0;lastLessonState='';lessons.exit();if(training)lessons.begin(fighterId,now(),resumeLesson);else game.reset(now(),difficulty,fighterId,!!practice,practice);app.classList.toggle('learning',training);app.classList.toggle('dojo',!!practice);$('practice-tools').hidden=!practice;$('lesson-panel').hidden=!training;updateRecipes(fighterId);updateLesson();
  for(const id of ['start-overlay','pause-overlay','result-overlay','practice-panel'])$(id).hidden=true;resize();$('start-error').hidden=true;$('audio-error').hidden=true;$('pause-overlay').classList.remove('audio-recovery','audio-closed');if(document.hidden)await pause();
 }catch(e){
  if(epoch!==lifecycleEpoch)return;lessons.exit();s.practice=null;s.buffer=null;s.player.action=null;s.freeze=null;held.clear();paused=false;app.classList.remove('learning','dojo');
  for(const id of ['pause-overlay','result-overlay','practice-panel','practice-tools','lesson-panel'])$(id).hidden=true;
  $('start-overlay').hidden=false;$('start-error').hidden=false;$('start-error').textContent=phase==='audio'?'Не удалось включить звук. Повтори запуск в Chrome.':'Не удалось загрузить бойцов. Повтори запуск или обнови страницу.';resize();
 }finally{starting=false;startBusy(false)}
}
// Free practice uses the same input windows and recovery, with isolated resources.
function showPracticeSetup(){
 const ids=Object.keys(CoreFighters.roster);if(!dojoOptions.enemy)dojoOptions.enemy=ids[(ids.indexOf(selectedFighter)+1)%ids.length];
 $('start-overlay').hidden=true;$('practice-panel').hidden=false;syncPracticeSetup();
}
function syncPracticeSetup(){for(const b of document.querySelectorAll('[data-opponent]')){const yes=b.dataset.opponent===dojoOptions.enemy;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes))}for(const b of document.querySelectorAll('[data-practice-mode]')){const yes=b.dataset.practiceMode===dojoOptions.mode;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes))}}
for(const f of Object.values(CoreFighters.roster)){const b=document.createElement('button');b.className='difficulty';b.dataset.opponent=f.id;b.textContent=f.name;b.onclick=()=>{dojoOptions.enemy=f.id;syncPracticeSetup()};$('practice-opponents').append(b)}
for(const b of document.querySelectorAll('[data-practice-mode]'))b.onclick=()=>{dojoOptions.mode=b.dataset.practiceMode;syncPracticeSetup()};
$('practice-start').onclick=showPracticeSetup;$('practice-cancel').onclick=()=>{$('practice-panel').hidden=true;$('start-overlay').hidden=false;$('practice-start').focus()};$('practice-go').onclick=()=>startFight(selected,false,0,{...dojoOptions});
$('practice-charge').onclick=()=>{if(s.practice&&!paused)game.charge(100,now())};$('practice-tempo').onclick=()=>{if(s.practice&&!paused){const values=[120,'auto',160,200,240];game.practiceTempo(values[(values.indexOf(s.practice.tempo)+1)%values.length],now())}};$('practice-level').onclick=()=>{if(s.practice&&!paused)game.practiceLevel(s.practice.level===5?null:(s.practice.level??0)+1,now())};
$('practice-exit').onclick=()=>{if(paused)return;game.release(now());lessons.exit();s.practice=null;app.classList.remove('dojo','learning');$('practice-tools').hidden=true;$('lesson-panel').hidden=true;$('start-overlay').hidden=false;resize()};
async function pause(){
 if(!audio||!['fight','ending','lessonWait'].includes(s.mode)||paused&&!audioDesired)return;
 const epoch=++lifecycleEpoch;paused=true;game.release(now());s.buffer=null;held.clear();$('defend').classList.remove('pressed');$('pause-overlay').hidden=false;$('pause-overlay').classList.remove('audio-recovery','audio-closed');$('audio-error').hidden=true;$('resume').disabled=false;syncSettings();invalidate();
 if(audio.ctx.state==='closed'){audioDesired=false;audio.stop();audioProblem(true);return}
 try{await requestAudio(false);if(epoch===lifecycleEpoch)invalidate()}catch{if(epoch===lifecycleEpoch)audioProblem(audio.ctx.state==='closed')}
}
async function resume(){
 if(!audio||!paused||document.hidden)return;const epoch=++lifecycleEpoch;$('resume').disabled=true;
 try{const running=await requestAudio(true);if(epoch!==lifecycleEpoch)return;if(!running){audioProblem();return}paused=false;$('pause-overlay').hidden=true;$('audio-error').hidden=true;$('pause-overlay').classList.remove('audio-recovery','audio-closed');invalidate()}
 catch{if(epoch===lifecycleEpoch){paused=true;audioProblem(audio.ctx.state==='closed')}}
 finally{if(epoch===lifecycleEpoch)$('resume').disabled=audio?.ctx.state==='closed'}
}
function syncSettings(){$('restart').textContent=lessons.state.active?'НАЧАТЬ УРОК ЗАНОВО':s.practice?'СБРОСИТЬ ПРАКТИКУ':'НАЧАТЬ ЗАНОВО';$('haptic-toggle').textContent=prefs.haptic?'ВКЛ':'ВЫКЛ';$('haptic-toggle').setAttribute('aria-pressed',String(prefs.haptic));$('latency').value=prefs.latency;$('latency-value').textContent=prefs.latency+' ms'}
$('haptic-toggle').onclick=()=>{prefs.haptic=!prefs.haptic;save();syncSettings()};$('latency').oninput=()=>{prefs.latency=Number($('latency').value);save();syncSettings()};
$('start').onclick=()=>startFight();$('training-start').onclick=()=>startFight('rookie',true,prefs.lesson||0);$('lesson-next').onclick=()=>{lessons.next(now());updateLesson();resize()};$('lesson-exit').onclick=()=>{lessons.exit();app.classList.remove('learning');$('lesson-panel').hidden=true;$('start-overlay').hidden=false;resize()};$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=()=>startFight(s.difficulty,lessons.state.active,lessons.state.index,s.practice?{mode:s.practice.mode,enemy:s.practice.enemy}:null);$('rematch').onclick=()=>startFight(s.difficulty);
$('next-difficulty').onclick=()=>startFight(s.difficulty==='rookie'?'fighter':'master');$('back-menu').onclick=()=>{$('result-overlay').hidden=true;$('start-overlay').hidden=false;selectDifficulty(s.difficulty)};
$('mute').onclick=async()=>{if(!audio||audio.ctx.state==='closed'){try{const AC=window.AudioContext||window.webkitAudioContext;audio?.stop();audio=CoreAudio.create(new AC({latencyHint:'interactive'}),'menu');watchAudio(audio.ctx);audio.setScene('menu');await requestAudio(true);audio.start();$('mute').setAttribute('aria-label','Выключить звук');$('menu-music').setAttribute('aria-label','Выключить музыку меню');$('menu-music').setAttribute('aria-pressed','true')}catch{}return}audio.mute(!audio.muted);$('mute').textContent=audio.muted?'×':'♫';$('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').setAttribute('aria-label',audio.muted?'Включить звук':'Выключить звук')};
$('menu-music').onclick=()=>{const result=$('mute').onclick();Promise.resolve(result).then(()=>{const playing=audio&&!audio.muted;$('menu-music').textContent=playing?'♫':'×';$('menu-music').setAttribute('aria-pressed',String(!!playing));$('menu-music').setAttribute('aria-label',playing?'Выключить музыку меню':'Включить музыку меню')})};
function syncSound(){const playing=!!audio&&!audio.muted;$('menu-music').textContent=playing?'♫':'×';$('menu-music').setAttribute('aria-pressed',String(playing));$('menu-music').setAttribute('aria-label',playing?'Выключить музыку меню':'Включить музыку меню')}
function showResult(winner,stats,rating){if(s.training)return;
 const won=winner==='player',bestKey=s.fighterId+':'+s.difficulty,old=prefs.bests[bestKey],better=!old||stats.score>old.score;
 if(better){prefs.bests[bestKey]={score:stats.score,rank:rating.rank};save()}
 audio?.setScene?.('menu');const focus=game.review(),timing=game.timing();$('result-focus').hidden=false;$('focus-title').textContent=focus.title;$('focus-detail').textContent=focus.detail;$('focus-goal').textContent=focus.goal;$('rank').textContent=rating.rank;$('result-title').textContent=won?'Это был твой бит.':'Ты уже слышишь его.';$('result-subtitle').textContent=won?'Теперь сделай это ещё чище.':stats.dodges?'Больше точных серий. Меньше лишних ударов.':'На красную долю — точный уход.';
 $('result-stats').replaceChildren(...[['ОЧКИ',stats.score],['ТОЧНОСТЬ',rating.accuracy+'%'],['ОШИБКА РИТМА',timing.samples?timing.meanAbs+' ms':'—'],['УХОДЫ / КОНТРЫ',stats.dodges+' / '+stats.counters],['ФИНАЛЫ',stats.variety.length+' / 3'],['РАЗГОН',stats.maxTempo+' BPM']].map(([label,value])=>{const n=document.createElement('div');n.className='stat';const b=document.createElement('b');b.textContent=value;n.append(b,document.createTextNode(label));return n}));
 $('new-best').textContent=better?'↑ НОВЫЙ ЛИЧНЫЙ РЕКОРД':'ЛИЧНЫЙ РЕКОРД '+old.score;$('next-difficulty').hidden=!won||s.difficulty==='master';$('next-difficulty').textContent=s.difficulty==='rookie'?'ДАЛЬШЕ: ДУЭЛЬ →':'ДАЛЬШЕ: МАСТЕР →';$('result-overlay').hidden=false;
}
function showTrainingResult(){audio?.setScene?.('menu');$('result-focus').hidden=true;app.classList.remove('learning');$('lesson-panel').hidden=true;$('rank').textContent='✓';$('result-title').textContent='Ритм освоен.';$('result-subtitle').textContent='Бой, защита, комбо, Groove и супер — теперь твои.';$('result-stats').replaceChildren();$('new-best').textContent='13 УРОКОВ ПРОЙДЕНО';$('next-difficulty').hidden=true;$('result-overlay').hidden=false;updateTrainingButton();resize()}
let lastLessonState='';function updateLesson(){const l=lessons.state;if(!l.active)return;const key=l.index+':'+l.waiting+':'+l.progress+':'+l.stage+':'+l.recipe;if(key===lastLessonState)return;lastLessonState=key;$('lesson-title').textContent='УРОК '+String(l.index+1).padStart(2,'0')+'/13 · '+lessons.titles[l.index];$('lesson-description').textContent=l.waiting?'Отлично. Этот навык выполнен в игре. Переходи дальше, когда будешь готов.':lessons.description();$('lesson-progress').textContent=l.progress+' / '+l.total;$('lesson-next').hidden=!l.waiting;$('lesson-next').textContent=l.index===12?'В БОЙ →':'ДАЛЬШЕ →';focusRecipe=l.recipe;resize()}
function eventAt(e,t=now()){const age=e&&Number.isFinite(e.timeStamp)?performance.now()-e.timeStamp:0;return audio?.eventTime?audio.eventTime(age>=0&&age<1000?age:0,matchOffset):t-(age>=0&&age<1000?age:0)}
function press(key,event){if(!canInput())return;const t=now(),at=eventAt(event,t);game.step(Math.max(s.now,at));const result=game.input(key,at,t);game.step(t);if(!result.accepted&&result.reason==='recovery'){$('coach-text').textContent='ВЫДОХ. СЛЕДУЮЩИЙ УДАР — ПОСЛЕ ВОССТАНОВЛЕНИЯ.'}}
for(const [id,key]of [['hand','L'],['foot','H'],['special','S']]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();press(key,e)});$(id).onclick=e=>{if(e.detail===0)press(key,e)}}
$('defend').addEventListener('pointerdown',e=>{e.preventDefault();if(!canInput())return;$('defend').setPointerCapture(e.pointerId);const t=now(),at=eventAt(e,t);game.step(Math.max(s.now,at));game.defend(at,t);game.step(t);$('defend').classList.add('pressed')});
function release(){game.release(now());$('defend').classList.remove('pressed')}
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('defend').addEventListener(type,release);$('defend').onclick=e=>{if(e.detail===0&&canInput()){const t=now(),at=eventAt(e,t);game.step(Math.max(s.now,at));game.defend(at,t);game.step(t);game.release(t)}};
for(const n of document.querySelectorAll('.combo'))n.onclick=()=>{focusRecipe=n.dataset.recipe};
const held=new Set();window.addEventListener('keydown',e=>{if(starting)return;if(e.code==='Space'&&e.target.closest?.('button')&&!['hand','foot','defend','special'].includes(e.target.id))return;if(e.code!=='Escape'&&(paused||['idle','result','lessonWait'].includes(s.mode)))return;if(['KeyJ','KeyK','KeyI','Space','Escape'].includes(e.code))e.preventDefault();if(held.has(e.code))return;held.add(e.code);if(e.code==='Escape'){paused?resume():pause();return}if(!canInput())return;if(e.code==='KeyJ')press('L',e);if(e.code==='KeyK')press('H',e);if(e.code==='KeyI')press('S',e);if(e.code==='Space'){const t=now(),at=eventAt(e,t);game.step(Math.max(s.now,at));game.defend(at,t);game.step(t);$('defend').classList.add('pressed')}});window.addEventListener('keyup',e=>{held.delete(e.code);if(e.code==='Space')release()});window.addEventListener('blur',()=>{held.clear();release();pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();release();pause()}});
function createBackdrop(){
 const c=document.createElement('canvas');c.width=w*dpr;c.height=h*dpr;const b=c.getContext('2d');b.scale(dpr,dpr);b.fillStyle='#100f1c';b.fillRect(0,0,w,h);
 const stage=CoreSprites.image('stage');if(stage){const ratio=Math.max(w/stage.width,(ground+30)/(stage.height*.82)),dx=(w-stage.width*ratio)*.5,dy=ground-stage.height*ratio*.82;b.drawImage(stage,dx,dy,stage.width*ratio,stage.height*ratio);b.fillStyle='#0b071936';b.fillRect(0,0,w,h)}
 const shade=b.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#0b071b88');shade.addColorStop(.45,'#100b1a00');shade.addColorStop(1,'#100a1e88');b.fillStyle=shade;b.fillRect(0,0,w,h);
 b.strokeStyle='#d7c1e31c';b.lineWidth=1;b.beginPath();b.moveTo(w*.12,ground+3);b.lineTo(w*.88,ground+3);b.stroke();return c;
}
function line(a,b,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
function circle(p,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fill()}
function fighter(a,token,t,enemy=false){if(!CoreSprites.ready(a.fighter)){if(s.mode!=='idle')auditErrors++;return}
 const f=CoreFighters.get(a.fighter),rootX=worldLeft+a.x*scale,rootY=ground+(enemy?-2:1)*scale,level=enemy?s.enemyLevel:s.level;
 const bodyX=rootX+token.x*scale*a.facing,bodyY=rootY+token.y*scale;
 ctx.save();const lift=Math.max(0,-token.y);ctx.fillStyle=`rgba(3,2,11,${.53-lift*.009})`;ctx.beginPath();ctx.ellipse(bodyX,rootY+2*scale,(37-lift*.38)*scale,(5-lift*.045)*scale,0,0,Math.PI*2);ctx.fill();
 if(level>=2){const g=ctx.createRadialGradient(bodyX,bodyY-75*scale,10,bodyX,bodyY-75*scale,85*scale);g.addColorStop(0,level===5?f.color+'32':f.color+'18');g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(bodyX-100*scale,bodyY-190*scale,200*scale,195*scale)}
 if(CoreSprites.draw(ctx,token,rootX,rootY,scale,a.facing)){drawCount++}else auditErrors++;
 if(level>=4&&!reduced){for(let i=0;i<level;i++){const y=-15-(t*.035+i*29)%140,x=Math.sin(t*.002+i*3)*32;circle([bodyX+x*scale,bodyY+y*scale],scale,f.color)}}
 ctx.restore();
}
function render(t){
 ctx.setTransform(dpr,0,0,dpr,0,0);if(backdrop)ctx.drawImage(backdrop,0,0,w,h);else ctx.clearRect(0,0,w,h);
 const phase=((t%500)+500)%500/500,pulse=Math.max(0,1-phase*4),stageY=ground-90*scale;
 if(!reduced){ctx.save();ctx.globalAlpha=.025+pulse*.035;ctx.fillStyle=s.phase===3?'#ff638f':'#a98aff';for(let i=0;i<3;i++){const x=w*(i+.5)/3;ctx.beginPath();ctx.moveTo(x,stageY-170*scale);ctx.lineTo(x-65*scale,ground);ctx.lineTo(x+35*scale,ground);ctx.fill()}ctx.restore()}
 for(let i=0;i<10;i++){const x=(i+.3)*w/10,bar=(12+(Math.sin(i*2.3+t*.002)+1)*8+pulse*11)*scale;ctx.fillStyle=i%2?'#b77cbd35':'#ff638f26';ctx.fillRect(x,ground-bar,3,bar)}
 const superAction=s.player.action?.super?s.player.action:null;if(superAction&&t-superAction.start<500){const f=CoreFighters.get(s.fighterId),a=Math.sin(Math.PI*(t-superAction.start)/500);ctx.fillStyle=f.color+'14';ctx.fillRect(0,0,w,h);if(!reduced){ctx.strokeStyle=f.color+'88';ctx.lineWidth=2;for(let i=0;i<7;i++){const y=ground-155*scale+i*23*scale;line([0,y],[w*.35*a,y-10],1,f.color+'66')}}}
 const frozen=s.freeze&&t<s.freeze.until?s.freeze:null,player=frozen?.player??game.getPose(s.player,t),enemy=frozen?.enemy??game.getPose(s.enemy,t);
 if(s.level>=3&&!reduced&&!frozen&&t-lastTrail>16&&s.player.action&&t-s.player.action.start<300){const point=CoreFighters.contact(s.player,t);s.trails.push({x:s.player.x+point.x,y:point.y,at:t});lastTrail=t;if(s.trails.length>14)s.trails.shift()}
 for(const p of s.trails){const age=t-p.at;if(age<0||age>145)continue;circle([worldLeft+p.x*scale,ground+p.y*scale],(s.level===5?4:2.5)*scale,`rgba(221,255,120,${(1-age/145)*.20})`)}
 ctx.save();if(frozen&&!reduced)ctx.translate(Math.sin(t*.12)*2.5,Math.cos(t*.1)*1.2);fighter(s.enemy,enemy,t,true);fighter(s.player,player,t);ctx.restore();
 // Small local impact drawings, bounded and distinct from blocked contacts.
 for(const hit of s.impacts){const age=t-hit.at;if(age<0||age>150)continue;const u=age/150,x=worldLeft+hit.x*scale,y=ground+hit.y*scale;ctx.save();ctx.globalAlpha=(1-u)*(hit.kind==='guard'?.35:.6);ctx.translate(x,y);const size=(reduced?5:hit.strong?16:9)*scale*(reduced?1:.65+u*.8);if(hit.kind==='guard'){ctx.strokeStyle='#c0b3ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size,-1.3,1.3);ctx.stroke()}else{const color=hit.kind==='enemy'?'#ff8fae':hit.kind==='counter'?'#c0b3ff':'#f5ffd4';for(let i=0;i<6;i++){const a=i*Math.PI/3;line([Math.cos(a)*size*.4,Math.sin(a)*size*.4],[Math.cos(a)*size,Math.sin(a)*size],hit.strong?2:1,color)}if(hit.strong&&!reduced){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,size*1.4,size*.65,-.3,0,Math.PI*2);ctx.stroke()}}ctx.restore()}
 for(const p of s.particles){const age=(t-p.at)/1000;if(age<0||age>.44)continue;const x=worldLeft+(p.x+p.vx*age)*scale,y=ground+(p.y+p.vy*age+90*age*age)*scale;ctx.globalAlpha=1-age/.44;line([x,y],[x-p.vx*.025*scale,y-p.vy*.025*scale],p.strong?2.5:1.5,p.kind==='guard'?'#c0b3ff':p.kind==='enemy'?'#ff638f':'#edffa4');ctx.globalAlpha=1}
 if(t<s.flash&&!reduced){ctx.fillStyle=`rgba(225,215,255,${Math.min(1,Math.max(0,(s.flash-t)/100))*.07})`;ctx.fillRect(0,0,w,h)}
}
const feedbackStrong=$('feedback').querySelector('strong'),feedbackSmall=$('feedback').querySelector('small');let lastMessage=null;
const energyNodes=[...document.querySelectorAll('#player-groove i')],enemyEnergyNodes=[...document.querySelectorAll('#enemy-groove i')],comboNodes=[...document.querySelectorAll('.combo')],controls=document.querySelector('.controls');let lastHP='';
function setText(node,value){value=String(value);if(node.textContent!==value)node.textContent=value}
function grooveMeter(nodes,energy,level){
 nodes.forEach((n,i)=>{n.classList.toggle('on',i<level);const value=(i===0?1:Math.max(0,Math.min(1,(energy-(i-1)*20)/20))).toFixed(3);if(n.style.getPropertyValue('--charge')!==value)n.style.setProperty('--charge',value)});
 const meter=nodes[0].parentElement,value=Math.min(5,1+energy/20).toFixed(2);if(meter.getAttribute('aria-valuenow')!==value){meter.setAttribute('aria-valuenow',value);meter.setAttribute('aria-valuetext','Уровень '+level+' из 5'+(level===5?' — максимум':', следующий заполнен на '+Math.round(energy%20/20*100)+'%'))}
}
function pace(t,bpm){
 const next=audio?.nextTempo?.(t),beats=next?Math.max(1,Math.ceil(next.inBeats-1e-7)):0;setText($('shared-groove'),'МУЗЫКА '+s.musicLevel+'/5');
 setText($('pace-status'),next?next.bpm>bpm?'РАЗГОН '+next.bpm+' · ЧЕРЕЗ '+beats+' '+(beats===1?'ДОЛЮ':beats<5?'ДОЛИ':'ДОЛЕЙ'):'НОВЫЙ РАУНД · 120 BPM':bpm>=240?'MAX ТЕМП · 240':s.practice?.tempo!=='auto'&&s.practice?'ТЕМП ЗАКРЕПЛЁН':s.training?'УЧЕБНЫЙ ТЕМП':'АВТОРАЗГОН · ДО 240');$('pace-status').classList.toggle('pending',!!next&&next.bpm>bpm);
}
function hud(t){
 syncSound();
 if(s.practice)setText($('practice-tempo'),s.practice.tempo==='auto'?'BPM АВТО':'BPM '+s.practice.tempo);if(s.practice)setText($('practice-level'),'GROOVE '+(s.practice.level??'АВТО'));
 const hpKey=s.player.hp+':'+s.player.maxHP+':'+s.enemy.hp+':'+s.enemy.maxHP;if(lastHP!==hpKey){$('hp-player').style.width=100*s.player.hp/s.player.maxHP+'%';$('hp-enemy').style.width=100*s.enemy.hp/s.enemy.maxHP+'%';lastHP=hpKey}setText($('hp-player-label'),Math.ceil(s.player.hp));setText($('hp-enemy-label'),Math.ceil(s.enemy.hp));setText($('clock'),lessons.state.active?'L'+(lessons.state.index+1):s.practice?'∞':s.mode==='idle'?'45':String(Math.min(45,Math.max(0,Math.ceil(game.remaining(t)/1000)))).padStart(2,'0'));
 const phase=t/500,whole=Math.floor(phase),fraction=phase-whole;
 const threats=game.threats();for(let i=0;i<beatNodes.length;i++){const beat=whole+i-1,n=beatNodes[i],danger=threats.some(inc=>inc&&!inc.cancelled&&!inc.resolved&&Math.round(inc.beatAt/500)===beat);n.style.translate=(i-1-fraction)*railWidth*.23+'px 0';const className='beat-node'+(danger?' danger':beat%4===0?' down':'')+(!danger&&s.player.action?.strong&&beat*500<s.player.ready&&beat*500>s.player.action.start?' rest':'');if(n.className!==className)n.className=className}
 const count=t<s.start?Math.ceil((s.start-t)/500):0;
 if(count>0&&s.mode==='fight'){feedbackStrong.textContent=String(Math.min(3,count));feedbackSmall.textContent='СЛУШАЙ БИТ';$('feedback').style.color='var(--lime)';$('feedback').style.opacity=1;lastMessage=null}
 else if(s.mode==='fight'&&t<s.start+250&&!s.feedback){feedbackStrong.textContent='GO';feedbackSmall.textContent='ТВОЙ БИТ';$('feedback').style.color='var(--lime)';$('feedback').style.opacity=1}
 else if(s.feedback&&t-s.feedback.at<850){if(lastMessage!==s.feedback){feedbackStrong.textContent=s.feedback.label;feedbackSmall.textContent=s.feedback.detail;lastMessage=s.feedback}$('feedback').style.color=({perfect:'var(--lime)',good:'var(--paper)',combo:'var(--lime)',counter:'var(--blue)',off:'var(--pink)',hurt:'var(--pink)',guard:'var(--blue)',super:CoreFighters.get(s.fighterId).color})[s.feedback.kind];$('feedback').style.opacity=Math.min(1,(850-t+s.feedback.at)/200)}else $('feedback').style.opacity=0;
 setText($('player-name'),CoreFighters.get(s.player.fighter).name);setText($('enemy-name'),s.training&&!s.practice?'ПРАКТИКА':CoreFighters.get(s.enemy.fighter).name);if(s.training){setText($('hp-player-label'),'∞');$('hp-enemy-label').textContent='∞'}
 setText($('energy-label'),'ТЫ · '+s.level);setText($('enemy-energy-label'),'СОПЕРНИК · '+s.enemyLevel);grooveMeter(energyNodes,s.energy,s.level);grooveMeter(enemyEnergyNodes,s.enemyEnergy,s.enemyLevel);const bpm=Math.round(audio?.bpmAt?.(t)??120);setText($('tempo'),bpm+' BPM'+(s.tempoTarget>bpm?' → '+(bpm+10):''));$('tempo').classList.toggle('accelerated',bpm>120);pace(t,bpm);setText($('streak'),'×'+s.streak);
 $('special').disabled=s.super<100||s.mode!=='fight'||paused;$('special').classList.toggle('ready',s.super>=100);setText($('special'),s.super>=100?'✦ СУПЕР · I':'СУПЕР '+Math.floor(s.super)+'%');$('special').style.setProperty('--super-charge',s.super+'%');
 const locked=s.comboLock,recovering=t<s.player.stun,warning=game.warning(t),run=threats.reduce((count,inc,i)=>i===0?1:count===i&&!inc.cancelled&&inc.beatAt===threats[i-1].beatAt+500?count+1:count,0);$('intent').style.opacity=warning&&!locked&&!recovering?1:0;setText($('intent'),recovering?(s.player.recovery?.kind==='whiff'?'ПРОМАХ · ВОССТАНОВЛЕНИЕ':'ОБА ВОССТАНАВЛИВАЮТСЯ'):locked?'КОМБО · СОПЕРНИК ОГЛУШЁН':run>=3?'! ТРИ УДАРА → УХОД В КАЖДУЮ ДОЛЮ':run===2?'! ДВА УДАРА → УХОД · УХОД':s.incoming?.signature?'! СИЛОВОЙ УДАР → УХОД':'! УХОД НА КРАСНУЮ ДОЛЮ');const guard=game.getGuard(t);$('guard-hint').style.opacity=guard&&!warning?1:0;setText($('guard-hint'),guard==='L'?'ЗАЩИЩАЕТ ГОЛОВУ → НОГА':'ЗАЩИЩАЕТ КОРПУС → РУКА');
 const prefix=s.series?.prefix??'';for(const n of comboNodes){n.classList.toggle('active',prefix?n.dataset.recipe.startsWith(prefix):n.dataset.recipe===focusRecipe);n.classList.toggle('done',s.stats.variety.includes(n.dataset.recipe))}
 const rest=!!(s.player.action?.strong&&t<s.player.ready)||!!recovering;controls.classList.toggle('stunned',!!recovering);controls.classList.toggle('recovering',rest);
 setText($('coach-text'),recovering?'ОДНА ДОЛЯ ВОССТАНОВЛЕНИЯ':locked?'СТАН СОПЕРНИКА · УДАР НА ДОЛЮ':t<s.start?'СЛУШАЙ. НАЖИМАЙ ПРЯМО НА ДОЛЮ.':warning?'КРАСНАЯ ДОЛЯ → ТОЧНЫЙ УХОД':t<s.counterUntil?'КОНТРА ОТКРЫТА → РУКА ИЛИ НОГА':rest?'ВЫДОХ · ЗАЩИТА ДОСТУПНА':focusRecipe?'ТВОЙ ФИНАЛ: '+focusRecipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · '):s.stats.combos===0?'ПОПРОБУЙ '+Object.keys(game.book().recipes)[0].replaceAll('L','Р').replaceAll('H','Н').split('').join(' · '):'СМЕНИ СЕРИЮ. СОБЕРИ ТРИ РАЗНЫХ ФИНАЛА.');
 if(lessons.state.active){$('feedback').style.opacity=0;const l=lessons.state;$('lesson-progress').textContent=l.progress+' / '+l.total+(s.feedback&&t-s.feedback.at<850?' · '+s.feedback.label:'')}
 setText($('scene-name'),s.practice?(s.practice.mode==='dummy'?'ПРАКТИКА / МАНЕКЕН':'ПРАКТИКА / ЖИВОЙ СОПЕРНИК'):t<s.start?CoreFighters.get(s.enemy.fighter).name+' / '+game.rival().name:s.phase===1?'AFTERHOURS':s.phase===2?'PRESSURE':'LAST LIGHT');
}
CoreSprites.load('stage').then(()=>{backdrop=createBackdrop();invalidate()}).catch(()=>{});
resize();
function frame(){
 loopTicks++;
 const state=paused+':'+s.mode+':'+document.hidden;
 if(state!==lastLoopState){lastLoopState=state;invalidate()}
 if(!document.hidden){
  const active=!paused&&(s.mode==='fight'||s.mode==='ending');
  if(active||paintDirty){const t=now();if(!paused){game.step(t);lessons.tick(t)}updateLesson();render(t);hud(t);paintCount++;paintDirty=false}
 }
 requestAnimationFrame(frame);
}
// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.
requestAnimationFrame(frame);
})();
