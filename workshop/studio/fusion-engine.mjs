/**
 * DuoForge Fusion Engine V1
 * Original deterministic combination of research-inspired:
 * (1) scene structure fingerprints, (2) importance + camera-space geometry budgets,
 * (3) temporal hysteresis, (4) repeatable cinematic scene planning.
 * Browser-native algorithms only. No copying of patented/vendor rendering implementations.
 */
export const FUSION_VERSION="duoforge-scene-fusion@1";
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const finite=(n,otherwise=0)=>Number.isFinite(n)?n:otherwise;
const vec=value=>Array.isArray(value)&&value.length===3?value.map(v=>finite(v)):[0,0,0];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const norm=a=>Math.hypot(...a);
const unit=a=>mul(a,1/(norm(a)||1));
const dist=(a,b)=>norm(sub(a,b));
const quant=(n,q)=>Math.round(finite(n)/q)*q;
const round=(n,decimals=3)=>Number(finite(n).toFixed(decimals));
const safeText=(s,max=100)=>String(s||"").replace(/[\u0000-\u001f<>]/g,"").slice(0,max);
const roles=Object.freeze([
 ["actor",/(actor|avatar|character|fighter|human|person|player|hero|figur|spelare|karaktär)/i],
 ["vehicle",/(wheel|hjul|tire|car|bil|kart|truck|traktor|bike|fordon|vehicle)/i],
 ["vessel",/(boat|båt|ship|fartyg|skepp|steamship)/i],
 ["environment",/(tree|träd|rock|stone|sten|plant|grass|gräs|house|hus|building|terrain|landskap|mountain)/i]
]);
export function sceneRole(name,flags={}){
 if(flags.skinned||flags.animated)return "actor";
 for(const [role,re] of roles)if(re.test(String(name||"")))return role;
 return "prop";
}
export function sanitizeDescriptor(raw,index=0){
 const r=raw||{},triangles=clamp(Math.floor(finite(r.triangles)),0,50_000_000);
 const center=vec(r.center),radius=clamp(finite(r.radius,0.5),0.001,1_000_000);
 const role=sceneRole(r.name,r);
 return {
  id:safeText(r.id??("mesh-"+index),120),name:safeText(r.name||("Mesh "+index)),
  role,triangles,center:center.map(x=>round(x,4)),radius:round(radius,4),
  skinned:!!r.skinned,animated:!!r.animated,visible:r.visible!==false,
  material:safeText(r.material||"",64),geometry:safeText(r.geometry||"",100),
  // This is for recommendations; not a semantic ML model.
  critical:!!(r.critical||r.skinned||r.animated||["actor","vehicle","vessel"].includes(role))
 };
}
export function normalizeScene(raw,limit=1000){
 if(!Array.isArray(raw))throw Error("Scenen måste vara en lista av objekt.");
 if(raw.length>limit)throw Error("Scenen är för stor för en interaktiv Fusion-analys.");
 return raw.map((r,i)=>sanitizeDescriptor(r,i));
}
function fnv32(s){
 let h=0x811c9dc5;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}
 return (h>>>0).toString(16).padStart(8,"0");
}
export function sceneDNA(input){
 const objects=normalizeScene(input);
 const signatures=objects.map(o=>{
  // Scale-invariant proxy on purpose; no raw vertices or private texture data included.
  const geometryKey=o.geometry||("tri:"+o.triangles+"|size:"+quant(o.radius,0.1));
  return {id:o.id,name:o.name,role:o.role,key:fnv32(geometryKey+"|"+o.role+"|"+o.material),geometryKey};
 });
 const matches=new Map();
 for(const s of signatures){
  const group=matches.get(s.key)||[];group.push({id:s.id,name:s.name,role:s.role});
  matches.set(s.key,group);
 }
 const groups=[...matches].filter(([,items])=>items.length>1).map(([key,items])=>({key,items}));
 const sceneKey=fnv32(signatures.map(s=>s.key).sort().join("|"));
 return {
  version:FUSION_VERSION,sceneKey,objects:objects.length,
  approximateGeometryMatches:groups,distinctSignatures:matches.size,
  precision:"heuristic-not-cryptographic",
  note:"Scen-DNA är en strukturheuristik och får aldrig användas för automatisk deduplicering."
 };
}
export function normalizeCamera(camera={}){
 const position=vec(camera.position??[0,2,6]);
 const direction=unit(vec(camera.direction??[0,0,-1]));
 return {
  position,direction:norm(direction)>0?direction:[0,0,-1],
  fovDegrees:clamp(finite(camera.fovDegrees,55),15,125),
  near:clamp(finite(camera.near,.05),.001,100),
  far:clamp(finite(camera.far,1000),10,100000),
  aspect:clamp(finite(camera.aspect,1.7),.4,5),
  heightPixels:clamp(Math.round(finite(camera.heightPixels,900)),100,4320)
 };
}
export function projectedImportance(object,cameraInput){
 const o=sanitizeDescriptor(object),camera=normalizeCamera(cameraInput);
 const displacement=sub(o.center,camera.position);
 const z=dot(displacement,camera.direction),range=norm(displacement);
 // Approximate bounding-sphere screen-space projection; NOT true occlusion/frustum culling.
 const focal=camera.heightPixels/(2*Math.tan(camera.fovDegrees*Math.PI/360));
 const pixels=clamp(o.radius*focal/Math.max(camera.near,range),0,camera.heightPixels*2);
 const outside=z+o.radius<camera.near||z-o.radius>camera.far||z< -o.radius;
 const attenuation=outside?0:clamp((z+o.radius)/(o.radius*2),0,1);
 const importance=pixels*pixels * attenuation * (o.critical?2.4:1);
 return {pixels:round(pixels,2),distance:round(range,2),behind:outside,importance:round(importance,2)};
}
export function planDetailBudget(input,cameraInput,{triangleBudget=100000,previous=null}={}){
 const objects=normalizeScene(input);
 const budget=clamp(Math.floor(finite(triangleBudget,100000)),1000,20_000_000);
 let requested=0;
 const rows=objects.map(o=>{
  const projection=projectedImportance(o,cameraInput);
  requested+=o.visible?o.triangles:0;
  const priority=o.visible&&!projection.behind
   ?projection.importance/(1+Math.log2(1+o.triangles)) : 0;
  return {...o,...projection,priority,quality:"full",suggestedTriangles:o.triangles};
 });
 let remaining=budget,planned=0;
 // Critical subjects first then high projected detail per geometry-cost, deterministic ties.
 const sorted=[...rows].sort((a,b)=>Number(b.critical)-Number(a.critical)||b.priority-a.priority||a.id.localeCompare(b.id));
 const byId=new Map();
 const prior=new Map((Array.isArray(previous)?previous:[]).map(x=>[x.id,x]));
 for(const row of sorted){
  let quality="full",allocated=0;
  if(!row.visible||row.behind){quality="out-of-view";allocated=0;}
  else{
   // Graceful reduction request: planner never modifies meshes or rigs.
   const min=row.critical?Math.min(row.triangles,Math.max(500,Math.ceil(row.triangles*.6))):Math.min(row.triangles,Math.max(40,Math.ceil(row.triangles*.15)));
   if(row.triangles<=remaining){allocated=row.triangles;quality="full";}
   else if(remaining>=min){allocated=remaining;quality="suggest-low-detail";}
   else if(row.critical){allocated=min;quality="preserve-critical";} // can exceed budget; explicitly reported.
   else{allocated=0;quality="defer-detail";}
   // Avoid oscillation for nearby budgets when a previous allocation is close.
   const before=prior.get(row.id);
   if(before&&Math.abs(before.suggestedTriangles-allocated)<Math.max(80,row.triangles*.08)&&
      before.quality===quality){allocated=before.suggestedTriangles;}
  }
  planned+=allocated;remaining=Math.max(0,remaining-allocated);
  byId.set(row.id,{id:row.id,name:row.name,role:row.role,critical:row.critical,visible:row.visible,
   triangles:row.triangles,suggestedTriangles:allocated,projectedPixels:row.pixels,quality});
 }
 const decisions=rows.map(r=>byId.get(r.id));
 return {
  version:FUSION_VERSION,budget,requestedTriangles:requested,
  plannedTriangles:planned,overBudget:planned>budget,
  estimatedSavings:Math.max(0,requested-planned),
  decisions,mode:"analysis-only",
  warning:"Planen föreslår detaljnivåer men genererar INTE ny mesh eller GPU-besparing. Kritiska objekt kan överskrida budgeten."
 };
}
export function createTemporalBudgetGovernor({
 targetFps=60,minScale=.65,maxScale=1,initialScale=1,windowFrames=48
}={}){
 const target=clamp(finite(targetFps,60),24,120),min=clamp(finite(minScale,.65),.4,1),
 max=clamp(finite(maxScale,1),min,2),window=clamp(Math.floor(finite(windowFrames,48)),12,120);
 let scale=clamp(initialScale,min,max),average=null,frames=0,lastChanged=-window,slowWindows=0,fastWindows=0;
 function snapshot(changed=false){return {version:FUSION_VERSION,targetFps:target,scale:round(scale),averageMs:average===null?null:round(average,2),samples:frames,changed};}
 return {
  sample(frameMs){
   if(!Number.isFinite(frameMs)||frameMs<1||frameMs>200)return snapshot();
   average=average===null?frameMs:average*.90+frameMs*.10;frames++;
   if(frames%window!==0)return snapshot();
   const goal=1000/target;
   slowWindows=average>goal*1.18?slowWindows+1:0;
   fastWindows=average<goal*.78?fastWindows+1:0;
   if(frames-lastChanged<window)return snapshot();
   const before=scale;
   if(slowWindows>=2){scale=Math.max(min,round(scale-.10));slowWindows=0;fastWindows=0;}
   else if(fastWindows>=3){scale=Math.min(max,round(scale+.05));slowWindows=0;fastWindows=0;}
   const changed=scale!==before;
   if(changed)lastChanged=frames;
   return snapshot(changed);
  },
  getState:()=>snapshot(),
  reset:()=>{scale=clamp(initialScale,min,max);average=null;frames=0;lastChanged=-window;slowWindows=0;fastWindows=0;return snapshot();}
 };
}
export function createCinemaPlan(input,{name="DuoForge Film",aspect=16/9}={}){
 const objects=normalizeScene(input);
 const visible=objects.filter(o=>o.visible&&o.radius>0);
 if(!visible.length)throw Error("Lägg in en synlig 3D-modell först.");
 const top=visible.slice().sort((a,b)=>Number(b.critical)-Number(a.critical)||b.radius-a.radius||a.id.localeCompare(b.id));
 const hero=top[0];
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const o of visible)for(let i=0;i<3;i++){
  min[i]=Math.min(min[i],o.center[i]-o.radius);
  max[i]=Math.max(max[i],o.center[i]+o.radius);
 }
 const center=min.map((v,i)=>(v+max[i])/2),radius=Math.max(1,dist(min,max)/2);
 const verticalFov=50*Math.PI/180;
 const distance=Math.max(radius*2.0,radius/Math.sin(verticalFov/2)*1.35);
 const heroDistance=Math.max(hero.radius*3.2,distance*.68);
 const focus=hero.center,up=[0,1,0];
 const shots=[
  {kind:"establishing",durationSec:5,position:add(center,[distance*.95,distance*.5,distance]),target:center},
  {kind:"lateral",durationSec:5,position:add(center,[-distance,distance*.28,distance*.45]),target:center},
  {kind:"hero",durationSec:5,position:add(focus,[heroDistance*.55,heroDistance*.2,heroDistance]),target:focus},
  {kind:"overhead",durationSec:5,position:add(center,[distance*.05,distance*1.5,distance*.2]),target:center},
  {kind:"finale",durationSec:5,position:add(center,[distance*.65,distance*.38,-distance*.9]),target:center}
 ].map((s,i)=>({id:"shot-"+(i+1),name:s.kind,seconds:s.durationSec,
  camera:{position:s.position.map(v=>round(v)),target:s.target.map(v=>round(v)),up,fov:50,aspect:clamp(aspect,.4,5)}}));
 return {
  format:"duoforge-cinema-fusion@1",title:safeText(name,120),seconds:25,
  source:"scene-bounds-heuristic",hero:hero.name,shots,
  limitations:"Automatiskt kameraförslag, ej renderad video eller produktionsklar regissör.",
  editable:true
 };
}
export function cameraAt(plan,seconds){
 if(!Array.isArray(plan?.shots)||!plan.shots.length)throw Error("Ogiltig kameraplan.");
 const shots=plan.shots,period=Math.max(.001,shots.reduce((s,x)=>s+(Number.isFinite(x.seconds)?x.seconds:0),0));
 let t=clamp(finite(seconds),0,period);
 for(let i=0;i<shots.length;i++){
  const shot=shots[i],length=clamp(finite(shot.seconds,5),.1,120),next=shots[Math.min(i+1,shots.length-1)];
  if(t<=length||i===shots.length-1){
   // Smoothstep interpolation, repeatable regardless of frame rate.
   const phase=clamp(t/length,0,1),u=phase*phase*(3-2*phase);
   const p=add(mul(shot.camera.position,1-u),mul(next.camera.position,u));
   const target=add(mul(shot.camera.target,1-u),mul(next.camera.target,u));
   return {position:p,target,shotId:shot.id,progress:round(u,4)};
  }
  t-=length;
 }
 throw Error("Kameraplanens längd är ogiltig.");
}

