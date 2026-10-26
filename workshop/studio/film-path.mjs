// Pure math for cinematic camera moves. No Three.js, network, APIs or GPU required.
export const SHOTS=Object.freeze(["orbit","dolly","crane","flyover","custom"]);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const toPoint=(p,fallback=[0,0,0])=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?p.slice():fallback.slice();
const pointPlus=(a,b)=>a.map((x,i)=>x+b[i]);
const pointMinus=(a,b)=>a.map((x,i)=>x-b[i]);
const pointScale=(a,t)=>a.map(x=>x*t);
const pointMix=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
export function normalizedDuration(value){return clamp(Number(value)||12,4,40)}
export function normalizeKeyframes(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,24).filter(item=>item&&Array.isArray(item.position)&&Array.isArray(item.target)&&
  item.position.length===3&&item.target.length===3&&[...item.position,...item.target].every(Number.isFinite))
  .map(item=>({position:toPoint(item.position),target:toPoint(item.target)}));
}
function catmull(p0,p1,p2,p3,t){
 const t2=t*t,t3=t2*t;
 return [0,1,2].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t
  +(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2
  +(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3));
}
export function sampleCameraPath(keyframes,progress,{ease=true}={}){
 const frames=normalizeKeyframes(keyframes);
 if(frames.length===0)throw Error("En film måste ha minst två kamerapositioner.");
 if(frames.length===1)return {...frames[0]};
 const t=clamp(Number(progress)||0,0,1);
 const u=ease?(t*t*(3-2*t)):t;
 const n=frames.length-1,i=Math.min(n-1,Math.floor(u*n));
 const f=clamp(u*n-i,0,1),a=frames[Math.max(0,i-1)],b=frames[i],c=frames[i+1],d=frames[Math.min(n,i+2)];
 return {position:catmull(a.position,b.position,c.position,d.position,f),
  target:catmull(a.target,b.target,c.target,d.target,f)};
}
const frame=(position,target)=>({position,target});
export function createShot(name,{world="showroom",focus=[0,1,0],size=4,custom=[]}={}){
 const center=toPoint(focus),extent=clamp(Number(size)||4,1,32);
 if(name==="custom"){
  const frames=normalizeKeyframes(custom);
  if(frames.length<2)throw Error("Lägg till minst två kamerapunkter för en egen filmsekvens.");
  return frames;
 }
 const px=center[0],py=center[1],pz=center[2],r=Math.max(6,extent*2.5);
 if(name==="orbit"){
  const keys=[];
  // More points avoid the cusps that a 2-point arc produces; seamless near-full sweep.
  for(let k=0;k<=12;k++){
   const a=Math.PI*.19+(Math.PI*1.9)*k/12;
   keys.push(frame([px+Math.sin(a)*r,py+r*.31+Math.sin(a*2)*r*.055,pz+Math.cos(a)*r],center));
  }
  return keys;
 }
 if(name==="dolly"){
  return [
   frame([px+r*.86,py+r*.43,pz+r*1.15],center),
   frame([px+r*.49,py+r*.33,pz+r*.72],pointPlus(center,[0,.12,0])),
   frame([px+r*.19,py+r*.21,pz+r*.38],pointPlus(center,[0,.08,0])),
   frame([px+r*.06,py+r*.18,pz+r*.26],center)
  ];
 }
 if(name==="crane"){
  return [
   frame([px-r*.9,py+r*.14,pz+r*.7],center),
   frame([px-r*.78,py+r*.36,pz+r*.44],center),
   frame([px-r*.52,py+r*.65,pz+r*.2],center),
   frame([px-r*.25,py+r*.96,pz-r*.35],center)
  ];
 }
 if(name==="flyover"){
  // Ocean flyover passes the actual raft and island coastline.
  if(world==="ocean"){
   return [
    frame([-24,4,-33],[-20,0,1]),
    frame([-26,5,-8],[-21,0,19]),
    frame([-12,7,28],[1,-1,58]),
    frame([17,8,62],[37,0,95]),
    frame([51,15,112],[91,1,144])
   ];
  }
  return [
   frame([px-r*1.8,py+r*.8,pz-r*1.3],pointPlus(center,[0,0,-r*.5])),
   frame([px-r*.9,py+r*.55,pz-r*.4],center),
   frame([px+.3*r,py+r*.4,pz+.6*r],pointPlus(center,[0,.3,.4*r])),
   frame([px+1.5*r,py+r*.85,pz+1.6*r],pointPlus(center,[.5*r,0,r]))
  ];
 }
 throw Error("Okänd kamerarörelse: "+String(name));
}
export function normalizeFilmSettings(input={}){
 const quality=["720","1080"].includes(String(input.quality))?String(input.quality):"1080";
 const fps=Number(input.fps)===30?30:24;
 const fov=clamp(Number(input.fov)||40,20,85);
 const duration=normalizedDuration(input.duration);
 const shot=SHOTS.includes(input.shot)?input.shot:"orbit";
 return {quality,fps,fov,duration,shot,width:quality==="720"?1280:1920,height:quality==="720"?720:1080};
}
