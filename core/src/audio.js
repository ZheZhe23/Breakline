/* Original procedural composition, CORE CIRCUIT / 120 BPM. No samples or voices. */
const CoreAudio = (() => {
'use strict';
const BPM=120,BEAT=.5,STEP=BEAT/4,LOOK=.12;
function create(context){
 const ctx=context,origin=ctx.currentTime+.15,master=ctx.createGain(),compressor=ctx.createDynamicsCompressor(),music=ctx.createGain(),effects=ctx.createGain(),fillBus=ctx.createGain();
 master.gain.value=.72;music.gain.value=.64;effects.gain.value=.62;fillBus.gain.value=.46;
 compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.008;compressor.release.value=.15;
 music.connect(compressor);effects.connect(compressor);fillBus.connect(compressor);compressor.connect(master);master.connect(ctx.destination);
 const buses=Array.from({length:5},(_,i)=>{const g=ctx.createGain();g.gain.value=i?0:1;g.connect(music);return g});
 const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=noise.getChannelData(0);let seed=23051;
 for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}
 const plans=[{at:origin,level:1}],fills=[],events=[];let next=0,requested=1,muted=false,timer=null;
 const hz=n=>440*2**((n-69)/12),rootAt=step=>[45,41,48,43][Math.floor(step/32)%4],thirdAt=step=>Math.floor(step/32)%4===0?3:4;
 function tone(bus,at,freq,duration,volume,type='sine',filter=0){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  if(filter){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(filter,at);o.connect(f);f.connect(g)}else o.connect(g);
  g.connect(bus);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect()};
 }
 function percussion(bus,at,duration,volume,cutoff=6500,type='highpass'){
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type=type;f.frequency.value=cutoff;
  g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f);f.connect(g);g.connect(bus);s.start(at);s.stop(at+duration+.02);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect()};
 }
 function kick(bus,at,volume=.27){
  const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,at);o.frequency.exponentialRampToValueAtTime(43,at+.12);g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+.25);o.connect(g);g.connect(bus);o.start(at);o.stop(at+.27);o.onended=()=>{o.disconnect();g.disconnect()};
 }
 function levelAt(at){let level=1;for(const p of plans){if(p.at<=at+1e-7)level=p.level;else break}return level}
 function setLevel(level,now=ctx.currentTime){
  level=Math.max(1,Math.min(5,level));if(level===requested)return;
  requested=level;const at=origin+Math.max(0,Math.ceil((now+LOOK+.006-origin)/BEAT))*BEAT,previous=levelAt(at-1e-6);
  while(plans.length>1&&plans.at(-1).at>=at)plans.pop();plans.push({at,level});
  buses.forEach((bus,i)=>{const g=bus.gain;g.cancelScheduledValues(at);g.setValueAtTime(i<previous?1:.0001,at);g.linearRampToValueAtTime(i<level?1:.0001,at+.24)});
  return {at,level};
 }
 function schedule(now=ctx.currentTime){
  while(origin+next*STEP<now+LOOK){
   const at=origin+next*STEP,step=next++;if(at<now-.02)continue;
   const bar=step%16,root=rootAt(step),third=thirdAt(step),level=levelAt(at);
   if(bar%4===0)kick(buses[0],at,bar===0?.25:.19);
   if(bar===4||bar===12){percussion(buses[0],at,.14,.12,1400,'highpass');tone(buses[0],at,175,.11,.065,'triangle')}
   if(bar%2===0){tone(buses[0],at,hz(root-12),.21,.105,'triangle',700);if(bar===6||bar===14)tone(buses[0],at,hz(root-5),.12,.05,'sine')}
   if(bar%4===2)tone(buses[0],at,hz(root+12+[0,7,third,12][Math.floor(bar/4)]),.25,.042,'triangle',2200);
   if(level>=2){percussion(buses[1],at,.035,bar%2?.038:.021,7500);if(bar===7||bar===15)percussion(buses[1],at,.065,.035,2200,'bandpass')}
   if(level>=3&&bar===0){for(const interval of [0,third,7])tone(buses[2],at,hz(root+12+interval),1.85,.024,'triangle',1200)}
   if(level>=4&&[1,6,9,14].includes(bar)){const notes=[19,12+third,24,19];tone(buses[3],at,hz(root+notes[Math.floor(bar/4)]),.19,.024,'sine');if(bar===9)tone(buses[3],at,hz(root+7),.15,.015,'triangle')}
   if(level>=5){if(bar%2===0)percussion(buses[4],at,.08,.022,5200);if(bar===0||bar===8){tone(buses[4],at,hz(root+24),.42,.018,'triangle');tone(buses[4],at,hz(root+31),.5,.012,'sine')}if(bar===11||bar===15)kick(buses[4],at,.075)}
   events.push({step,at,level});if(events.length>256)events.shift();
  }
 }
 function requestFill(id,quality,now=ctx.currentTime){
  if(!quality||fills.some(f=>f.id===id)||fills.length&&now-fills.at(-1).at<BEAT*2)return false;
  const at=origin+Math.ceil((now+.045-origin)/(BEAT/2))*(BEAT/2),step=Math.round((at-origin)/STEP),root=rootAt(step),third=thirdAt(step);
  for(let i=0;i<4;i++){percussion(fillBus,at+i*STEP,.08,.065-i*.007,1800,'highpass');tone(fillBus,at+i*STEP,hz(root+[19,12+third,12,24][i]),.16,.045,'triangle',2600)}
  fills.push({id,at});if(fills.length>32)fills.shift();return true;
 }
 function sfx(kind,strong=false){
  const at=ctx.currentTime+.003;
  if(kind==='swing'){percussion(effects,at,.07,.035,3000,'bandpass');return}
  if(kind==='block'){percussion(effects,at,.07,.075,1700,'bandpass');tone(effects,at,320,.07,.055,'triangle');return}
  if(kind==='dodge'){percussion(effects,at,.12,.04,4300,'highpass');return}
  if(kind==='off'){tone(effects,at,110,.09,.025,'sine');return}
  kick(effects,at,strong?.36:.18);percussion(effects,at,strong?.18:.085,strong?.13:.075,850,'lowpass');
  if(strong){tone(effects,at,82,.35,.09,'triangle',500);percussion(effects,at+.09,.13,.033,1200,'bandpass')}
 }
 function mute(value){muted=value;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(value?.0001:.72,ctx.currentTime,.025)}
 function start(){if(!timer)timer=setInterval(()=>schedule(),25);schedule()}
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {ctx,origin,BPM,BEAT,STEP,plans,events,fills,buses,master,music,effects,fillBus,noise,levelAt,setLevel,schedule,requestFill,sfx,mute,start,stop,now:()=> (ctx.currentTime-origin)*1000,get muted(){return muted}};
}
return {create,BPM,BEAT,STEP};
})();
