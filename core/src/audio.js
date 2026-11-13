/* Original procedural composition, AFTERHOURS / 120 BPM. No samples or voices. */
const CoreAudio = (() => {
'use strict';
const BPM=120,BEAT=.5,STEP=BEAT/4,LOOK=.12;
function estimateLatency(ctx,when){
 const fallback=Math.min(.4,Math.max(0,(ctx.baseLatency||0)+(ctx.outputLatency||0)));
 try{const ts=ctx.getOutputTimestamp?.();if(ts&&ts.contextTime>0&&ts.performanceTime>0){const delay=ctx.currentTime-(ts.contextTime+(when-ts.performanceTime)/1000);if(delay>=0&&delay<.5)return delay}}catch{}
 return fallback;
}
function create(context){
 const ctx=context,origin=ctx.currentTime+.15,master=ctx.createGain(),compressor=ctx.createDynamicsCompressor(),music=ctx.createGain(),effects=ctx.createGain(),fillBus=ctx.createGain();
 master.gain.value=.75;music.gain.value=.74;effects.gain.value=.62;fillBus.gain.value=.42;
 compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.008;compressor.release.value=.15;
 music.connect(compressor);effects.connect(compressor);fillBus.connect(compressor);compressor.connect(master);master.connect(ctx.destination);
 const buses=Array.from({length:5},(_,i)=>{const g=ctx.createGain();g.gain.value=i?0:1;g.connect(music);return g});
 const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=noise.getChannelData(0);let seed=23051;
 for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}
 const warm=ctx.createPeriodicWave(new Float32Array(8),new Float32Array([0,1,.35,.22,.12,.07,.04,.02]));
 let latency=estimateLatency(ctx,performance.now()),lastNow=-Infinity;const latencySamples=[];
 function now(){if(ctx.state==='running'&&ctx.currentTime-origin<1.15){latencySamples.push(estimateLatency(ctx,performance.now()));if(latencySamples.length>31)latencySamples.shift();latency=[...latencySamples].sort((a,b)=>a-b)[Math.floor(latencySamples.length/2)]}const t=(ctx.currentTime-origin-latency)*1000;lastNow=Math.max(lastNow,t);return lastNow}
 const plans=[{at:origin,level:1}],fills=[],events=[];let next=0,requested=1,muted=false,timer=null;
 const hz=n=>440*2**((n-69)/12),rootAt=step=>[45,41,48,43][Math.floor(step/32)%4],thirdAt=step=>Math.floor(step/32)%4===0?3:4;
 function tone(bus,at,freq,duration,volume,type='sine',filter=0,pan=0){
  const o=ctx.createOscillator(),g=ctx.createGain();if(type==='warm')o.setPeriodicWave(warm);else o.type=type;o.frequency.setValueAtTime(freq,at);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+(duration>1?.07:.008));g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.45),at+duration*.65);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  if(filter){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(filter,at);f.frequency.exponentialRampToValueAtTime(Math.max(250,filter*.35),at+duration);o.connect(f);f.connect(g)}else o.connect(g);
  const panner=pan&&ctx.createStereoPanner?ctx.createStereoPanner():null;if(panner){panner.pan.value=pan;g.connect(panner);panner.connect(bus)}else g.connect(bus);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();panner?.disconnect()};
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
   // A full groove at level one: four-to-the-floor, offbeat hats, syncopated bass.
   if(bar%4===0)kick(buses[0],at,bar===0?.32:.26);
   if(bar===4||bar===12){percussion(buses[0],at,.14,.15,1300,'highpass');tone(buses[0],at,185,.1,.05,'triangle')}
   if(bar%2===0)percussion(buses[0],at,.035,bar%4===2?.028:.014,7200);
   if([0,3,6,8,10,14].includes(bar)){const octave=bar===14?0:-12;tone(buses[0],at,hz(root+octave),bar===0?.26:.17,.10,'warm',850)}
   const phrase=Math.floor(step/16)%8;
   if([2,7,10,14].includes(bar)){
    const melody=[12,19,12+third,24],note=melody[[2,7,10,14].indexOf(bar)];
    tone(buses[0],at,hz(root+note),bar===14?.30:.18,.043,'warm',2300);
    if(phrase===7&&bar===14)tone(buses[0],at+STEP,hz(root+19),.12,.024,'triangle');
   }
   if(level>=2){if(bar%2===1)percussion(buses[1],at,.045,.032,5200);if([3,11,15].includes(bar)){tone(buses[1],at,bar===15?410:290,.085,.04,'sine');percussion(buses[1],at,.04,.02,1800,'bandpass')}}
   if(level>=3&&bar===0){for(const [i,interval]of [0,third,7].entries())tone(buses[2],at,hz(root+12+interval),1.85,.034,'warm',1350,(i-1)*.55)}
   if(level>=4&&[1,6,9,14].includes(bar)){const notes=[19,12+third,24,19];tone(buses[3],at,hz(root+notes[Math.floor(bar/4)]),.22,.046,'triangle',3200);tone(buses[3],at+.015,hz(root+notes[Math.floor(bar/4)])*1.003,.24,.014,'sine')}
   if(level>=5){if(bar%2===0)percussion(buses[4],at,.10,.025,5000);if(bar===0||bar===8){tone(buses[4],at,hz(root+24),.5,.036,'warm',2800);tone(buses[4],at,hz(root+31),.6,.018,'triangle')}if(bar===4||bar===12)percussion(buses[4],at+.015,.11,.05,2100);if(bar===15)kick(buses[4],at,.08)}
   events.push({step,at,level});if(events.length>256)events.shift();
  }
 }
 function requestFill(id,quality,now=ctx.currentTime){
  if(!quality||fills.some(f=>f.id===id)||fills.length&&now-fills.at(-1).at<BEAT*2)return false;
  const at=origin+Math.ceil((now+.045-origin)/(BEAT/2))*(BEAT/2),step=Math.round((at-origin)/STEP),root=rootAt(step),third=thirdAt(step);
  for(let i=0;i<4;i++){percussion(fillBus,at+i*STEP,.08,.065-i*.007,1800,'highpass');tone(fillBus,at+i*STEP,hz(root+[19,12+third,12,24][i]),.16,.045,'triangle',2600)}
  fills.push({id,at});if(fills.length>32)fills.shift();return true;
 }
 function sfx(kind,strong=false,at=ctx.currentTime+.003){
  if(kind==='handAccent'||kind==='kickAccent'){const root=rootAt(Math.max(0,Math.round((at-origin)/STEP)));tone(effects,at,hz(root+(kind==='handAccent'?24:19)),.095,.045,'triangle',2900);return}
  if(kind==='warning'){tone(effects,at,660,.09,.025,'triangle');return}
  if(kind==='counter'||kind==='counterReady'){const root=rootAt(Math.max(0,Math.round((at-origin)/STEP)));tone(effects,at,hz(root+24),.20,.08,'warm',2600);tone(effects,at+.06,hz(root+31),.24,.045,'sine');if(kind==='counterReady')return}
  if(kind==='swing'){percussion(effects,at,.07,.035,3000,'bandpass');return}
  if(kind==='block'){percussion(effects,at,.07,.075,1700,'bandpass');tone(effects,at,320,.07,.055,'triangle');return}
  if(kind==='dodge'){percussion(effects,at,.12,.04,4300,'highpass');return}
  if(kind==='off'){tone(effects,at,110,.09,.025,'sine');return}
  kick(effects,at,strong?.36:.18);percussion(effects,at,strong?.18:.085,strong?.13:.075,850,'lowpass');
  if(strong){tone(effects,at,82,.35,.09,'triangle',500);percussion(effects,at+.09,.13,.033,1200,'bandpass')}
 }
 function warning(beatAt){const at=origin+beatAt/1000-BEAT;if(at>=ctx.currentTime+.005){tone(effects,at,660,.09,.025,'triangle');percussion(effects,at,.04,.025,3500,'highpass')}}
 function superCharge(fighter,at=ctx.currentTime+.003){
  const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type=fighter==='brick'?'triangle':'sawtooth';const base=fighter==='brick'?42:fighter==='iris'?220:100;
  o.frequency.setValueAtTime(base,at);o.frequency.exponentialRampToValueAtTime(base*4,at+.44);f.type='lowpass';f.frequency.setValueAtTime(500,at);f.frequency.exponentialRampToValueAtTime(fighter==='iris'?3400:1700,at+.44);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.095,at+.30);g.gain.exponentialRampToValueAtTime(.0001,at+.49);o.connect(f);f.connect(g);g.connect(effects);o.start(at);o.stop(at+.50);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect()};
  const root=rootAt(Math.max(0,Math.round((at-origin)/STEP)));for(let i=0;i<4;i++){if(fighter==='brick')kick(effects,at+i*.1,.08+i*.012);else tone(effects,at+i*.1,hz(root+[12,19,24,31][i]),.17,.035,fighter==='iris'?'sine':'triangle',2400)}
 }
 function superHit(fighter,at=ctx.currentTime+.003){
  kick(effects,at,fighter==='brick'?.5:.4);percussion(effects,at,.25,.18,950,'lowpass');tone(effects,at,fighter==='brick'?42:65,.48,.14,'triangle',500);
  const root=rootAt(Math.max(0,Math.round((at-origin)/STEP)));for(let i=0;i<3;i++){const t=at+i*.13;tone(effects,t,hz(root+(fighter==='iris'?24:12)+[0,7,12][i]),.30,.07/(i+1),fighter==='iris'?'sine':'warm',2300);if(i)percussion(effects,t,.10,.04/(i+1),1200,'bandpass')}
 }
 function mute(value){muted=value;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(value?.0001:.75,ctx.currentTime,.025)}
 function start(){if(!timer)timer=setInterval(()=>schedule(),25);schedule()}
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {ctx,origin,BPM,BEAT,STEP,plans,events,fills,buses,master,music,effects,fillBus,noise,levelAt,setLevel,schedule,requestFill,sfx,warning,superCharge,superHit,mute,start,stop,now,latency:()=>latency,get muted(){return muted}};
}
return {create,estimateLatency,BPM,BEAT,STEP};
})();
