/* Musical time is continuous in beats; tempo changes never restart the phrase. */
const CoreTransport=(()=>{
'use strict';
function create(origin=0,bpm=120){
 const segments=[{beat:0,time:origin,bpm}];
 function find(value,key){let lo=0,hi=segments.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(segments[mid][key]<=value)lo=mid;else hi=mid-1}return segments[lo]}
 function beatAt(time){const s=find(time,'time');return s.beat+(time-s.time)*s.bpm/60}
 function timeAt(beat){const s=find(beat,'beat');return s.time+(beat-s.beat)*60/s.bpm}
 function bpmAt(beat){return find(beat,'beat').bpm}
 function setTempo(bpm,beat){if(!Number.isFinite(bpm)||bpm<60||bpm>240||!Number.isFinite(beat)||beat<0)throw Error('Invalid tempo');const time=timeAt(beat);while(segments.length>1&&segments.at(-1).beat>=beat)segments.pop();if(beat===0)segments[0]={beat:0,time,bpm};else if(bpmAt(beat)!==bpm)segments.push({beat,time,bpm});return {beat,time,bpm}}
 return {segments,beatAt,timeAt,bpmAt,setTempo};
}
return {create};
})();
