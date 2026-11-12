/* BREAKLINE CORE: constrained IK/FK math from BREAKLINE 3.14.0 (5dc1ff2).
 * Intentionally independent of the 3.15 half-beat experiment. No bone scaling. */
const CoreRig = (() => {
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rigRadians=d=>d*Math.PI/180;
const RIG=Object.freeze({shoulder:13,hips:13,arm:29,forearm:29,thigh:36,shin:36,pelvisSpine:14,lumbarSpine:16,thoracicSpine:15});
function rigWrap(angle){return Math.atan2(Math.sin(angle),Math.cos(angle))}
function rigRootAngle(angle,reference,min,max){
 const relative=rigWrap(angle-reference);
 if(relative>=min&&relative<=max)return relative;
 // Clamp on a circle, so an angle just beyond -PI cannot jump to the opposite
 // shoulder/hip limit merely because atan2 represented it as +PI.
 return Math.abs(rigWrap(relative-min))<Math.abs(rigWrap(relative-max))?min:max;
}
function solveLimb(start,target,a,b,options={}){
 const {bend=1,minFlex=rigRadians(4),maxFlex=rigRadians(148),reference=Math.PI/2,minRoot=-Math.PI,maxRoot=Math.PI}=options;
 let dx=target[0]-start[0],dy=target[1]-start[1];
 if(Math.hypot(dx,dy)<1e-9){dx=Math.cos(reference);dy=Math.sin(reference)}
 const raw=Math.hypot(dx,dy);
 const reach=flex=>Math.sqrt(Math.max(0,a*a+b*b+2*a*b*Math.cos(flex)));
 const distance=clamp(raw,reach(maxFlex),reach(minFlex));
 const flex=Math.acos(clamp((distance*distance-a*a-b*b)/(2*a*b),-1,1));
 const offset=Math.acos(clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1));
 const root=rigRootAngle(Math.atan2(dy,dx)+bend*offset,reference,minRoot,maxRoot);
 return forwardLimb(start,a,b,root,flex,{reference,bend,minRoot,maxRoot,minFlex,maxFlex});
}
function forwardLimb(start,a,b,root,flex,options){
 const {reference,bend}=options,upper=reference+root,lower=upper-bend*flex;
 const joint=[start[0]+a*Math.cos(upper),start[1]+a*Math.sin(upper)];
 const end=[joint[0]+b*Math.cos(lower),joint[1]+b*Math.sin(lower)];
 return {start,joint,end,a,b,root,flex,upper,lower,bend,reference,limits:options};
}

const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const lerp=(a,b,t)=>a+(b-a)*t;
const angleCache=new WeakMap();
function anglesOf(p){if(p.angles)return p.angles;if(angleCache.has(p))return angleCache.get(p);const out={};for(const [name,l]of Object.entries(skeleton(p).limbs))out[name]={root:l.root,flex:l.flex};angleCache.set(p,out);return out}
const base={hip:[0,-71],spine:[.02,.09,.02],lh:[27,-119],rh:[12,-125],lf:[29,-2],rf:[-28,-2],turn:0};
const pose=(changes={})=>({...base,...changes});
function mix(a,b,t){
 const p={};for(const key of ['hip','spine','lh','rh','lf','rf'])p[key]=a[key].map((v,i)=>lerp(v,b[key][i],t));
 p.turn=lerp(a.turn,b.turn,t);
 // Interpolate constrained FK angles, not a hand target through its shoulder.
 // IK supplies authored key poses; FK preserves elbow/knee continuity in between.
 const sa=anglesOf(a),sb=anglesOf(b);p.angles={};
 for(const name of Object.keys(sa))p.angles[name]={root:lerp(sa[name].root,sb[name].root,t),flex:lerp(sa[name].flex,sb[name].flex,t)};
 return p;
}
const moves={
 jab:{impact:85,duration:490,recovery:390,limb:'leftArm',contact:pose({hip:[8,-72],spine:[.10,.15,.08],lh:[76,-117],rh:[18,-123],turn:.22}),chamber:pose({hip:[-2,-73],lh:[22,-121],spine:[-.04,-.02,.02]}),follow:pose({hip:[10,-71],spine:[.12,.18,.08],lh:[69,-112],rh:[25,-124],turn:.26}),exit:pose({hip:[4,-72],lh:[30,-116],rh:[24,-123],spine:[.05,.10,.03]})},
 cross:{impact:95,duration:530,recovery:390,limb:'rightArm',contact:pose({hip:[12,-70],spine:[.16,.22,.12],lh:[26,-123],rh:[80,-115],lf:[33,-2],rf:[-20,-2],turn:-.4}),chamber:pose({hip:[3,-72],spine:[-.07,.02,.04],rh:[16,-124],turn:.2}),follow:pose({hip:[14,-69],spine:[.18,.26,.14],lh:[30,-122],rh:[76,-108],turn:-.48}),exit:pose({hip:[6,-72],spine:[.06,.13,.04],lh:[28,-119],rh:[27,-118],rf:[-24,-2],turn:-.12})},
 hook:{impact:100,duration:540,recovery:390,limb:'leftArm',contact:pose({hip:[11,-68],spine:[.11,.18,.08],lh:[76,-113],rh:[19,-121],turn:.48}),chamber:pose({hip:[2,-75],spine:[-.14,-.08,.02],lh:[17,-110],turn:-.28}),follow:pose({hip:[15,-68],spine:[.18,.23,.12],lh:[59,-102],rh:[27,-122],turn:.65}),exit:pose({hip:[4,-72],spine:[.03,.1,.02],lh:[28,-116],rh:[24,-124],turn:.18})},
 bodyKick:{impact:125,duration:570,recovery:390,limb:'leftLeg',contact:pose({hip:[7,-71],spine:[-.14,-.15,-.08],lh:[19,-123],rh:[-3,-112],lf:[75,-71],rf:[-20,-2],turn:.28}),chamber:pose({hip:[-4,-74],spine:[-.12,-.08,-.02],lf:[28,-49],rf:[-20,-2],lh:[24,-124],rh:[10,-125]}),follow:pose({hip:[10,-70],spine:[-.17,-.18,-.08],lf:[70,-66],rf:[-19,-2],lh:[17,-124],rh:[-4,-109],turn:.36}),exit:pose({hip:[3,-72],spine:[-.02,.03,0],lf:[25,-20],rf:[-24,-2],lh:[25,-121],turn:.08})},
 uppercut:{impact:115,duration:675,recovery:675,limb:'rightArm',contact:pose({hip:[15,-73],spine:[.12,.24,.10],rh:[68,-129],lh:[29,-124],lf:[35,-2],rf:[-17,-2],turn:-.5}),chamber:pose({hip:[3,-63],spine:[.13,-.08,-.1],rh:[25,-94],lh:[25,-116],turn:.26}),follow:pose({hip:[17,-74],spine:[.14,.28,.1],rh:[60,-147],lh:[30,-123],lf:[35,-2],rf:[-15,-2],turn:-.6}),exit:pose({hip:[6,-72],rh:[25,-127],spine:[.02,.11,.02],rf:[-24,-2],turn:-.1})},
 frontKick:{impact:130,duration:660,recovery:675,limb:'leftLeg',contact:pose({hip:[-3,-72],spine:[-.18,-.16,-.06],lf:[75,-79],rf:[-19,-2],lh:[18,-126],rh:[-1,-114],turn:.18}),chamber:pose({hip:[-3,-74],spine:[-.12,-.06,0],lf:[28,-51],rf:[-21,-2],lh:[26,-127]}),follow:pose({hip:[12,-71],spine:[-.20,-.18,-.08],lf:[76,-73],rf:[-18,-2],lh:[17,-124],rh:[-3,-110],turn:.24}),exit:pose({hip:[4,-72],lf:[27,-20],rf:[-25,-2],spine:[-.03,.02,0],lh:[26,-123]})},
 spinKick:{impact:150,duration:720,recovery:675,limb:'rightLeg',contact:pose({hip:[12,-72],spine:[-.15,-.20,-.10],rh:[-18,-100],lh:[20,-124],rf:[79,-104],lf:[-13,-2],turn:1}),chamber:pose({hip:[-1,-72],spine:[-.12,-.17,-.05],rh:[-8,-106],lh:[24,-128],rf:[7,-45],lf:[-16,-2],turn:-.85}),follow:pose({hip:[16,-71],spine:[-.14,-.20,-.09],rf:[69,-96],lf:[-12,-2],lh:[17,-123],rh:[-20,-103],turn:.75}),exit:pose({hip:[3,-72],spine:[-.04,.03,0],rf:[-10,-23],lf:[27,-2],rh:[17,-121],lh:[29,-122],turn:.2})},
 knee:{impact:135,duration:720,recovery:675,limb:'leftLeg',contact:pose({hip:[30,-82],spine:[.20,.15,.06],lf:[37,-62],rf:[-9,-6],lh:[55,-136],rh:[31,-136],turn:.35}),chamber:pose({hip:[4,-66],spine:[.12,.08,.03],lf:[25,-30],rf:[-20,-2],lh:[33,-127]}),follow:pose({hip:[32,-79],spine:[.22,.18,.08],lf:[37,-58],rf:[-6,-3],lh:[47,-130],rh:[26,-127],turn:.42}),exit:pose({hip:[6,-72],spine:[.03,.1,.02],lf:[26,-16],rf:[-24,-2],lh:[28,-122]})}
};
function idle(t){const b=Math.sin(t*.006)*1.2;return pose({hip:[Math.sin(t*.003)*.7,-71+b],spine:[.02,.09+Math.sin(t*.003)*.015,.02],lh:[27,-119+b],rh:[12,-125+b]})}
const limbNames=['leftArm','rightArm','leftLeg','rightLeg'];
function vector(p){const a=anglesOf(p);return [...p.hip,...p.spine,p.turn,...p.lh,...p.rh,...p.lf,...p.rf,...limbNames.flatMap(n=>[a[n].root,a[n].flex])]}
function unvector(v){const p=pose({hip:v.slice(0,2),spine:v.slice(2,5),turn:v[5],lh:v.slice(6,8),rh:v.slice(8,10),lf:v.slice(10,12),rf:v.slice(12,14)});p.angles={};limbNames.forEach((n,i)=>p.angles[n]={root:v[14+i*2],flex:v[15+i*2]});return p}
function clip(action,linked){
 const m=moves[action.move],i=m.impact,times=[0,i*.48,i,i+85,m.duration*.76,m.duration],poses=[action.from,m.chamber,m.contact,m.follow,m.exit,linked?m.exit:idle(action.start+m.duration)],values=poses.map(vector),tangents=values.map(v=>v.map(()=>0));
 // Shape-preserving Hermite: joints carry momentum through a contact key while
 // every scalar remains within its neighbouring constrained FK poses.
 for(let k=1;k<values.length-1;k++)for(let j=0;j<values[k].length;j++){
  const h0=times[k]-times[k-1],h1=times[k+1]-times[k],d0=(values[k][j]-values[k-1][j])/h0,d1=(values[k+1][j]-values[k][j])/h1;
  if(d0*d1>0){const w1=2*h1+h0,w2=h1+2*h0;tangents[k][j]=(w1+w2)/(w1/d0+w2/d1)}
 }
 return {times,values,tangents};
}
function sample(action,t){
 if(!action)return idle(t);
 const m=moves[action.move],elapsed=Math.max(0,t-action.start),linked=!!(action.series&&!action.finish&&action.series.clean);
 if(elapsed>m.duration)return linked?mix(m.exit,idle(t),smooth((elapsed-1250)/220)):idle(t);
 if(!action.clip||action.clipLinked!==linked){action.clip=clip(action,linked);action.clipLinked=linked}
 const {times,values,tangents}=action.clip;let k=1;while(k<times.length-1&&elapsed>times[k])k++;
 const dt=times[k]-times[k-1],u=clamp((elapsed-times[k-1])/dt,0,1),u2=u*u,u3=u2*u;
 return unvector(values[k-1].map((v,j)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*dt*tangents[k-1][j]+(-2*u3+3*u2)*values[k][j]+(u3-u2)*dt*tangents[k][j]));
}
function skeleton(p){
 const hip=p.hip.slice(),sp=[hip];let at=hip;
 for(let i=0;i<3;i++){const a=-Math.PI/2+p.spine[i];at=[at[0]+Math.cos(a)*[14,16,15][i],at[1]+Math.sin(a)*[14,16,15][i]];sp.push(at)}
 const shoulder=sp[3],width=6.5*(1-.23*Math.abs(p.turn)),ls=[shoulder[0]+width,shoulder[1]+1],rs=[shoulder[0]-width,shoulder[1]-1];
 const arm={reference:Math.PI/2,bend:1,minRoot:rigRadians(-172),maxRoot:rigRadians(88),minFlex:rigRadians(4),maxFlex:rigRadians(148)};
 const leg={reference:Math.PI/2,bend:-1,minRoot:rigRadians(-148),maxRoot:rigRadians(85),minFlex:rigRadians(5),maxFlex:rigRadians(150)};
 const limbs={leftArm:solveLimb(ls,p.lh,29,29,arm),rightArm:solveLimb(rs,p.rh,29,29,arm),leftLeg:solveLimb([hip[0]+6.5,hip[1]],p.lf,36,36,leg),rightLeg:solveLimb([hip[0]-6.5,hip[1]],p.rf,36,36,leg)};
 if(p.angles)for(const [name,l]of Object.entries(limbs)){const v=p.angles[name];limbs[name]=forwardLimb(l.start,l.a,l.b,v.root,v.flex,l.limits)}
 const bones=[];for(const [name,l]of Object.entries(limbs)){bones.push({name:name+'.'+(name.includes('Arm')?'upperArm':'thigh'),start:l.start,end:l.joint,length:l.a});bones.push({name:name+'.'+(name.includes('Arm')?'forearm':'shin'),start:l.joint,end:l.end,length:l.b})}
 for(let i=0;i<3;i++)bones.push({name:'spine.'+['pelvis','lumbar','thorax'][i],start:sp[i],end:sp[i+1],length:[14,16,15][i]});
 return {hip,sp,shoulder,limbs,bones,pose:p};
}
function measure(s,matrix={a:1,b:0,c:0,d:1},displayScale=1){
 const violations=[];let maxRelativeError=0;
 for(const b of s.bones){const e=Math.abs(Math.hypot(matrix.a*(b.end[0]-b.start[0])+matrix.c*(b.end[1]-b.start[1]),matrix.b*(b.end[0]-b.start[0])+matrix.d*(b.end[1]-b.start[1]))/(b.length*displayScale)-1);maxRelativeError=Math.max(maxRelativeError,e);if(!Number.isFinite(e)||e>1e-6)violations.push(b.name)}
 for(const [name,l]of Object.entries(s.limbs)){const o=l.limits;if(l.root<o.minRoot-1e-7||l.root>o.maxRoot+1e-7||l.flex<o.minFlex-1e-7||l.flex>o.maxFlex+1e-7)violations.push(name+'.limits')}
 for(let i=1;i<3;i++)if(Math.abs(poseAngle(s,i)-poseAngle(s,i-1))>.55)violations.push('spine.limit');
 return {valid:!violations.length,violations,maxRelativeError,segments:s.bones.length};
}
function poseAngle(s,i){return s.pose.spine[i]}
return {RIG,moves,base,pose,mix,idle,sample,skeleton,measure,smooth,solveLimb,forwardLimb};
})();
