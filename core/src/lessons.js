/* Interactive curriculum. A lesson advances only on verified gameplay events. */
const CoreLessons=(()=>{
'use strict';
const titles=['ПОЙМАЙ ДОЛЮ','ДОБАВЬ НОГУ','ПЕРВОЕ КОМБО','ДОЛЯ ВЫДОХА','ОБЫЧНЫЙ БЛОК','ТОЧНЫЙ УХОД','КОНТРУДАР','ЧИТАЙ ЗАЩИТУ','ТРИ ФИНАЛА','МУЗЫКА И GROOVE','ТВОЙ СУПЕР','СВОБОДНЫЙ СПАРРИНГ'];
function create(game,hooks={}){
 const state={active:false,index:0,waiting:false,graduated:false,progress:0,total:1,cursor:0,started:0,stage:0,seen:[],fighter:'nova',completed:[]};
 function enter(index,now){
  const f=CoreFighters.get(state.fighter),recipes=Object.keys(f.recipes);game.reset(now,'rookie',f.id,true);const s=game.s;
  Object.assign(state,{index,waiting:false,progress:0,total:[3,2,1,2,1,1,1,1,2,1,1,3][index],cursor:0,started:now,stage:0,seen:[],levelAt:0});
  s.incoming=null;s.guard=null;s.super=0;s.energy=0;s.level=1;
  if([4,5,6,11].includes(index)){const at=s.start+1500;s.incoming={id:1,beatAt:at,contactAt:at+115,move:'cross',started:false,resolved:false,cancelled:false,warned:false}}
  if(index===7)s.guard={key:'L',start:s.start,end:s.start+1e9};
  if(index===9){game.energy(70,now);game.charge(80,now)}
  if(index===10){game.charge(100,now);game.energy(80,now)};
  if(index===11)game.charge(70,now);
  state.recipe=recipes[index===8?1:0];hooks.progress?.(index,false);return state;
 }
 function begin(fighter,now,resume=0){state.active=true;state.graduated=false;state.fighter=CoreFighters.get(fighter).id;state.completed=[];return enter(Math.max(0,Math.min(titles.length-1,resume)),now)}
 function done(now){if(state.waiting)return;state.waiting=true;state.progress=state.total;game.s.mode='lessonWait';game.s.incoming=null;game.s.block=false;game.s.buffer=null;state.completed.push(state.index);hooks.progress?.(state.index+1,state.index===titles.length-1)}
 function tick(now){
  if(!state.active||state.waiting)return;const s=game.s,recipes=Object.keys(CoreFighters.get(state.fighter).recipes),index=state.index;
  const events=s.events.filter(e=>e.id>state.cursor);for(const e of events){state.cursor=Math.max(state.cursor,e.id);
   if(index===0&&e.type==='hit'&&e.key==='L')state.progress++;
   if(index===1&&e.type==='hit'&&e.key==='H')state.progress++;
   if(index===2&&e.type==='combo'&&e.recipe===recipes[0])state.progress=1;
   if(index===3){if(e.type==='combo'){state.stage=1;state.progress=1;state.ready=s.player.ready}else if(state.stage===1&&e.type==='hit'&&e.t>=state.ready)state.progress=2}
   if(index===4&&e.type==='block')state.progress=1;
   if(index===5&&e.type==='dodge')state.progress=1;
   if(index===6&&e.type==='hit'&&e.counter)state.progress=1;
   if(index===7&&e.type==='hit'&&e.key==='H'&&!e.strong)state.progress=1;
   if(index===8&&e.type==='combo'&&[recipes[1],recipes[2]].includes(e.recipe)&&!state.seen.includes(e.recipe)){state.seen.push(e.recipe);state.progress=state.seen.length;state.recipe=state.seen.includes(recipes[1])?recipes[2]:recipes[1]}
   if(index===10&&e.type==='super')state.progress=1;
   if(index===11){const k=e.type==='combo'?'combo':e.type==='dodge'?'dodge':e.type==='super'?'super':null;if(k&&!state.seen.includes(k)){state.seen.push(k);state.progress=state.seen.length}}
  }
  if(index===9){if(s.level===5){if(!state.levelAt)state.levelAt=now;if(now-state.levelAt>650)state.progress=1}else state.levelAt=0}
  if(state.progress>=state.total)done(now);
 }
 function next(now){if(!state.active||!state.waiting)return false;if(state.index===titles.length-1){state.active=false;state.graduated=true;game.s.mode='idle';hooks.complete?.();return true}enter(state.index+1,now);return true}
 function exit(){state.active=false;state.waiting=false;game.s.mode='idle';game.s.incoming=null;game.s.block=false}
 function description(){const f=CoreFighters.get(state.fighter),r=state.recipe.replaceAll('L','Р').replaceAll('H','Н').split('').join(' · ');return [
 'Нажми РУКУ на музыкальную долю три раза. PERFECT и GOOD засчитываются.',
 'Теперь два чистых удара НОГОЙ. OFF двигает бойца, но не наносит урон.',
 'Собери '+r+'. Общие начала комбо одинаковы; неверная кнопка прерывает серию.',
 state.stage?'Финал завершён. Пропусти следующую долю и снова ударь в ритм.':'Сделай '+r+'. После финала кнопки атаки на одну долю уходят в восстановление.',
 'Удерживай УХОД до атаки соперника. Это блок: часть урона проходит.',
 'На красную треугольную долю коротко нажми УХОД. Это активная защита.',
 'Сделай PERFECT-уход, затем сразу ударь на следующую долю: контра даёт ×1,45.',
 'Соперник защищает голову. Попади обычной НОГОЙ в корпус. Повторы он начинает блокировать.',
 'Освой ещё два финала. Сейчас '+r+'. Чистая серия даёт заряд и музыкальный ответ.',
 'Groove усиливает эффекты и пять слоёв музыки. Точно атакуй, чтобы поднять уровень с 4 до 5.',
 'Супер заряжен. Нажми в долю — контакт на следующей. Заряд дают попадания, комбо и уходы; Groove не тратится. Броня уменьшает урон. Контакт — через долю; следующая восстановительная.',
 'Свободная тренировка: выполни чистое комбо, уход и супер. Раненые бойцы здесь не проигрывают. В дуэли счёт и ранг растут от точности, защиты и разных финалов.'
 ][state.index]}
 return {state,begin,enter,tick,next,exit,description,titles};
}
return {create,titles};
})();
