/* Original procedural composition: OVERDRIVE, D / Phrygian. 120–160 BPM. No samples or voices. */
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
 master.gain.value=.82;music.gain.value=.88;effects.gain.value=.58;fillBus.gain.value=.34;
 compressor.threshold.value=-6;compressor.knee.value=4;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.10;
 music.connect(compressor);effects.connect(compressor);fillBus.connect(compressor);compressor.connect(master);master.connect(ctx.destination);
 const transport=CoreTransport.create(origin,BPM),bassBus=ctx.createGain(),bedBus=ctx.createGain();bassBus.gain.value=1;bedBus.gain.value=1;bassBus.connect(music);bedBus.connect(music);
 const buses=Array.from({length:5},(_,i)=>{const g=ctx.createGain();g.gain.value=i?0:1;g.connect(i?bedBus:music);return g});
 const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=noise.getChannelData(0);let seed=23051;
 for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}
 const warm=ctx.createPeriodicWave(new Float32Array(8),new Float32Array([0,1,.35,.22,.12,.07,.04,.02]));
 let latency=estimateLatency(ctx,performance.now()),lastNow=-Infinity;const latencySamples=[];
 function sampleLatency(){if(ctx.state==='running'&&ctx.currentTime-origin<1.15){latencySamples.push(estimateLatency(ctx,performance.now()));if(latencySamples.length>31)latencySamples.shift();latency=[...latencySamples].sort((a,b)=>a-b)[Math.floor(latencySamples.length/2)]}}
 function now(offset=0){sampleLatency();const t=transport.beatAt(ctx.currentTime-latency+offset/1000)*500;lastNow=Math.max(lastNow,t);return lastNow}
 function eventTime(age=0,offset=0){return transport.beatAt(ctx.currentTime-latency+(offset-age)/1000)*500}
 function delayUntil(ticks,offset=0){return (transport.timeAt(ticks/500)+latency-offset/1000-ctx.currentTime)*1000}
 function rhythmError(ticks){const beat=ticks/500;return (transport.timeAt(beat)-transport.timeAt(Math.round(beat)))*1000}
 function elapsedMs(a,b){return (transport.timeAt(b/500)-transport.timeAt(a/500))*1000}
 const plans=[{at:origin,level:1}],fills=[],events=[],cues=[],accents=[],warnings=[];let next=0,requested=1,muted=false,timer=null;
 const hz=n=>440*2**((n-69)/12),rootAt=step=>[38,38,39,36][Math.floor(step/32)%4];
 function safeBeat(now=ctx.currentTime,unit=1){return Math.max(0,Math.ceil((transport.beatAt(now+LOOK+.04)-1e-8)/unit)*unit)}
 function setTempo(target,now=ctx.currentTime){
  target=Math.max(120,Math.min(160,Math.round(target/10)*10));let bpm=transport.segments.at(-1).bpm,beat=Math.max(safeBeat(now,4),transport.segments.at(-1).beat+4);
  while(bpm<target){bpm+=10;transport.setTempo(bpm,beat);beat+=4}return transport.segments;
 }
 function resetTempo(now=ctx.currentTime){warnings.length=0;accents.length=0;return transport.setTempo(120,safeBeat(now))}
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
 function kick(bus,at,volume=.48){
  const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(165,at);o.frequency.exponentialRampToValueAtTime(54,at+.028);o.frequency.exponentialRampToValueAtTime(43,at+.13);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.0015);g.gain.exponentialRampToValueAtTime(volume*.48,at+.038);g.gain.exponentialRampToValueAtTime(.0001,at+.19);o.connect(g);g.connect(bus);o.start(at);o.stop(at+.21);o.onended=()=>{o.disconnect();g.disconnect()};percussion(bus,at,.013,volume*.16,3200,'highpass');
 }
 function duck(bus,at){const g=bus.gain;g.cancelScheduledValues(at);g.setValueAtTime(.25,at);g.exponentialRampToValueAtTime(1,at+.11)}
 function bass(at,root,length){tone(bassBus,at,hz(root-12),length,.27,'sine');tone(bassBus,at,hz(root),length*.90,.19,'warm',1800);tone(bassBus,at,hz(root+12),length*.64,.055,'triangle',2200)}
 function levelAt(at){let level=1;for(const p of plans){if(p.at<=at+1e-7)level=p.level;else break}return level}
 function setLevel(level,now=ctx.currentTime){
  level=Math.max(1,Math.min(5,level));if(level===requested)return;
  requested=level;const at=transport.timeAt(safeBeat(now)),previous=levelAt(at-1e-6);
  while(plans.length>1&&plans.at(-1).at>=at)plans.pop();plans.push({at,level});
  buses.forEach((bus,i)=>{const g=bus.gain;g.cancelScheduledValues(at);g.setValueAtTime(i<previous?1:.0001,at);g.linearRampToValueAtTime(i<level?1:.0001,at+.16)});
  return {at,level};
 }
 function schedule(now=ctx.currentTime){
  while(transport.timeAt(next/4)<now+LOOK){
   const at=transport.timeAt(next/4),step=next++;if(at<now-.02)continue;
   const bar=step%16,root=rootAt(step),level=levelAt(at),duration=60/transport.bpmAt(step/4),sixteenth=duration/4;
   // The quarter-note kick is invariant. Upper layers stay short and out of its way.
   if(bar%4===0){kick(buses[0],at,bar===0?.55:.48);duck(bassBus,at);duck(bedBus,at)}
   if(bar===4||bar===12){percussion(buses[0],at,.085,.20,1450,'highpass');tone(buses[0],at,185,.065,.12,'triangle');percussion(buses[0],at+.012,.045,.07,2600,'bandpass')}
   if(bar%2===0)percussion(buses[0],at,.024,bar%4===2?.047:.018,7800);
   if([1,3,6,9,11,14].includes(bar))bass(at,root+(bar===14?-2:0),Math.min(.14,sixteenth*.95));
   if([2,7,10,15].includes(bar))tone(buses[0],at,hz(root+[12,13,12,7][[2,7,10,15].indexOf(bar)]),.075,.037,'warm',1900);
   if(level>=2){if([3,7,11,15].includes(bar))percussion(buses[1],at,.026,.038,5500);if([6,14].includes(bar))tone(buses[1],at,bar===6?108:144,.065,.052,'triangle')}
   if(level>=3&&[2,10].includes(bar))for(const interval of [0,3,7])tone(buses[2],at,hz(root+12+interval),.15,.035,'warm',1450,interval===3?-.25:.25);
   if(level>=4&&[3,6,11,14].includes(bar))tone(buses[3],at,hz(root+[12,7,13,10][[3,6,11,14].indexOf(bar)]),.085,.065,'warm',2300);
   if(level>=5){if([2,6,10,14].includes(bar))percussion(buses[4],at,.055,.048,6200);if([7,15].includes(bar)){tone(buses[4],at,hz(root),.09,.075,'warm',1350);percussion(buses[4],at,.045,.035,2100,'bandpass')}}
   events.push({step,at,level,bpm:transport.bpmAt(step/4)});if(events.length>256)events.shift();
  }
  for(const a of accents){if(!a.done&&transport.timeAt(a.beat)<now+LOOK){a.done=true;const at=transport.timeAt(a.beat);if(at<now-.02)continue;cues.push({kind:'fill',beat:a.beat,at});if(cues.length>64)cues.shift();const root=rootAt(Math.round(a.beat*4));percussion(fillBus,at,.055,.075-a.index*.008,1800,'highpass');tone(fillBus,at,hz(root+[12,10,7,0][a.index]),.085,.055,'warm',1700)}}
  for(const w of warnings){if(!w.done&&transport.timeAt(w.beat)<now+LOOK){w.done=true;const at=transport.timeAt(w.beat);if(at>=now-.02){cues.push({kind:'warning',beat:w.beat,at});if(cues.length>64)cues.shift();tone(effects,at,660,.065,.045,'triangle');percussion(effects,at,.025,.035,3500,'highpass')}}}
  while(accents.length&&accents[0].done)accents.shift();while(warnings.length&&warnings[0].done)warnings.shift();
 }
 function requestFill(id,quality,now=ctx.currentTime){
  const beat=Math.ceil(transport.beatAt(now+LOOK+.01)*2)/2;
  if(!quality||fills.some(f=>f.id===id)||fills.length&&beat-fills.at(-1).beat<2)return false;
  for(let i=0;i<4;i++)accents.push({beat:beat+i/4,index:i,done:false});fills.push({id,beat,at:transport.timeAt(beat)});if(fills.length>32)fills.shift();return true;
 }
 function sfx(kind,strong=false,at=ctx.currentTime+.003){
  if(kind==='handAccent'||kind==='kickAccent'){percussion(effects,at,.035,.035,kind==='handAccent'?2200:1100,'bandpass');return}
  if(kind==='warning'){tone(effects,at,660,.09,.025,'triangle');return}
  if(kind==='counter'||kind==='counterReady'){const root=rootAt(Math.max(0,Math.round(transport.beatAt(at)*4)));tone(effects,at,hz(root+24),.20,.08,'warm',2600);tone(effects,at+.06,hz(root+31),.24,.045,'sine');if(kind==='counterReady')return}
  if(kind==='swing'){percussion(effects,at,.07,.035,3000,'bandpass');return}
  if(kind==='block'){percussion(effects,at,.07,.075,1700,'bandpass');tone(effects,at,320,.07,.055,'triangle');return}
  if(kind==='dodge'){percussion(effects,at,.12,.04,4300,'highpass');return}
  if(kind==='off'){tone(effects,at,110,.09,.025,'sine');return}
  kick(effects,at,strong?.36:.18);percussion(effects,at,strong?.18:.085,strong?.13:.075,850,'lowpass');
  if(strong){tone(effects,at,82,.35,.09,'triangle',500);percussion(effects,at+.09,.13,.033,1200,'bandpass')}
 }
 function warning(beatAt){const beat=beatAt/500-1;if(transport.timeAt(beat)>=ctx.currentTime+.005&&!warnings.some(w=>w.beat===beat)){warnings.push({beat,done:false});if(warnings.length>32)warnings.shift()}}
 function superCharge(fighter,at=ctx.currentTime+.003){
  const scale=(transport.timeAt(transport.beatAt(at)+1)-at)/.5,o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type=fighter==='brick'?'triangle':'sawtooth';const base=fighter==='brick'?42:fighter==='iris'?220:100;
  o.frequency.setValueAtTime(base,at);o.frequency.exponentialRampToValueAtTime(base*4,at+.44*scale);f.type='lowpass';f.frequency.setValueAtTime(500,at);f.frequency.exponentialRampToValueAtTime(fighter==='iris'?3400:1700,at+.44*scale);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.095,at+.30*scale);g.gain.exponentialRampToValueAtTime(.0001,at+.49*scale);o.connect(f);f.connect(g);g.connect(effects);o.start(at);o.stop(at+.50*scale);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect()};
  const root=rootAt(Math.max(0,Math.round(transport.beatAt(at)*4)));for(let i=0;i<4;i++){if(fighter==='brick')kick(effects,at+i*.1*scale,.08+i*.012);else tone(effects,at+i*.1*scale,hz(root+[0,7,12,13][i]),.17,.035,fighter==='iris'?'sine':'triangle',2400)}
 }
 function superHit(fighter,at=ctx.currentTime+.003){
  kick(effects,at,fighter==='brick'?.5:.4);percussion(effects,at,.25,.18,950,'lowpass');tone(effects,at,fighter==='brick'?42:65,.48,.14,'triangle',500);
  const root=rootAt(Math.max(0,Math.round(transport.beatAt(at)*4)));for(let i=0;i<3;i++){const t=at+i*.13;tone(effects,t,hz(root+(fighter==='iris'?24:12)+[0,7,12][i]),.30,.07/(i+1),fighter==='iris'?'sine':'warm',2300);if(i)percussion(effects,t,.10,.04/(i+1),1200,'bandpass')}
 }
 function mute(value){muted=value;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(value?.0001:.82,ctx.currentTime,.025)}
 function start(){if(!timer)timer=setInterval(()=>schedule(),25);schedule()}
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {ctx,origin,BPM,BEAT,STEP,transport,bassBus,bedBus,setTempo,resetTempo,eventTime,delayUntil,rhythmError,elapsedMs,bpmAt:t=>transport.bpmAt(t/500),plans,events,cues,fills,buses,master,music,effects,fillBus,noise,levelAt,setLevel,schedule,requestFill,sfx,warning,superCharge,superHit,mute,start,stop,now,latency:()=>latency,get muted(){return muted}};
}
return {create,estimateLatency,BPM,BEAT,STEP};
})();
