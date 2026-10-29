// DuoForge Shape DNA Lab v1 — deterministic, local, shape-constrained surface evolution.
// This module has no browser/Three.js dependencies and can be tested in Node.
// Not an AI reconstruction, novel research claim, or reference-image matching algorithm.
export const SHAPE_DNA_VERSION="shape-dna@1";
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const finite=x=>Number.isFinite(x);
const kinds=new Set(["stone","bark","organic","scales"]);
export function normalizeSettings(input={}){
 const kind=kinds.has(input.kind)?input.kind:"organic";
 const seed=clamp(Math.round(Number(input.seed)||1),1,2147483646);
 const intensity=clamp(Number(input.intensity)||.36,.08,1);
 return {kind,seed,intensity};
}
function hash(x,y,z,seed){
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041)^Math.imul(seed,2166136261);
 h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
 return (h>>>0)/4294967295*2-1;
}
const fade=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
function noise(x,y,z,seed){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
 const dx=fade(x-ix),dy=fade(y-iy),dz=fade(z-iz);
 const lerpX=(oy,oz)=>mix(hash(ix,iy+oy,iz+oz,seed),hash(ix+1,iy+oy,iz+oz,seed),dx);
 return mix(mix(lerpX(0,0),lerpX(1,0),dy),mix(lerpX(0,1),lerpX(1,1),dy),dz);
}
export function morphology(x,y,z,kind,seed){
 // Coordinates are normalised by the longest local bbox dimension.
 // Anisotropic warp adds structured material-specific relief, not white-noise freckles.
 const w=noise(x*3.1,y*3.1,z*3.1,seed);
 const xw=x+.07*w, yw=y+.05*w, zw=z+.07*w;
 const a=noise(xw*8,yw*8,zw*8,seed+31);
 const b=noise(xw*17,yw*17,zw*17,seed+59);
 if(kind==="stone"){
  const crack=Math.pow(Math.abs(noise(xw*5,yw*5,zw*5,seed+103)),5);
  return clamp(.50*a+.18*b-.55*crack,-1,1);
 }
 if(kind==="bark"){
  const around=Math.atan2(zw+.00017,xw+.00013);
  const ridges=Math.sin(around*18+yw*22+noise(xw*2,yw*3,zw*2,seed+4)*3);
  return clamp(.47*ridges+.32*a+.12*b,-1,1);
 }
 if(kind==="scales"){
  // Overlapping tile-like relief in object-space to avoid separate geometry on each scale.
  const theta=Math.atan2(zw+.0001,xw+.0001);
  const layer=Math.floor(yw*19);
  const pattern=Math.cos(theta*21+(layer%2)*Math.PI*.5)*Math.cos(yw*19*Math.PI);
  return clamp(.34*pattern+.35*a+.1*b,-1,1);
 }
 return clamp(.37*w+.38*a+.12*b,-1,1);
}
export function inspectMeshData(positions,indices=null,uv=null){
 if(!positions||positions.length%3!==0||positions.length<9)throw Error("Mesh måste ha minst tre 3D-punkter.");
 const count=positions.length/3;
 if(count>250000)throw Error("Max 250 000 vertices per mesh");
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<positions.length;i+=3)for(let j=0;j<3;j++){
  const v=positions[i+j];if(!finite(v))throw Error("Icke-finit meshposition");
  low[j]=Math.min(low[j],v);high[j]=Math.max(high[j],v);
 }
 const tri=indices||null;
 if(tri&&tri.length%3!==0)throw Error("Ogiltig index-triangulering");
 const faces=tri?tri.length/3:count/3;
 let badFaces=0, totalArea=0;
 const trisToCheck=Math.min(faces,8000),step=Math.max(1,Math.floor(faces/trisToCheck));
 function point(v){const k=v*3;return [positions[k],positions[k+1],positions[k+2]]}
 for(let f=0;f<faces;f+=step){
  const a=tri?tri[f*3]:f*3,b=tri?tri[f*3+1]:f*3+1,c=tri?tri[f*3+2]:f*3+2;
  if(![a,b,c].every(v=>Number.isInteger(v)&&v>=0&&v<count))throw Error("Felaktigt mesh-index");
  const A=point(a),B=point(b),C=point(c);
  const x=B[0]-A[0],y=B[1]-A[1],z=B[2]-A[2];
  const X=C[0]-A[0],Y=C[1]-A[1],Z=C[2]-A[2];
  const area=.5*Math.hypot(y*Z-z*Y,z*X-x*Z,x*Y-y*X);
  if(area<1e-12)badFaces++;totalArea+=area;
 }
 const size=high.map((v,i)=>v-low[i]),diagonal=Math.hypot(...size);
 if(diagonal<1e-7)throw Error("Nollstor mesh");
 const extent=[size[0]/diagonal,size[1]/diagonal,size[2]/diagonal];
 const sorted=[...size].sort((a,b)=>a-b);
 const depthRatio=sorted[0]/Math.max(sorted[2],1e-8);
 const hasUV=Boolean(uv&&uv.length>=count*2);
 return {vertices:count,triangles:faces,low,high,size,diagonal,extent,
  depthRatio,hasUV,degenerateSample:badFaces,inspectedFaces:Math.ceil(faces/step),
  approxArea:totalArea*step};
}
function normalsFromGeometry(positions,indices=null){
 const n=new Float32Array(positions.length),count=positions.length/3;
 const faces=indices?indices.length/3:count/3;
 for(let f=0;f<faces;f++){
  const a=indices?indices[f*3]:f*3,b=indices?indices[f*3+1]:f*3+1,c=indices?indices[f*3+2]:f*3+2;
  const ia=a*3,ib=b*3,ic=c*3;
  const abx=positions[ib]-positions[ia],aby=positions[ib+1]-positions[ia+1],abz=positions[ib+2]-positions[ia+2];
  const acx=positions[ic]-positions[ia],acy=positions[ic+1]-positions[ia+1],acz=positions[ic+2]-positions[ia+2];
  const x=aby*acz-abz*acy,y=abz*acx-abx*acz,z=abx*acy-aby*acx;
  for(const i of [ia,ib,ic]){n[i]+=x;n[i+1]+=y;n[i+2]+=z;}
 }
 for(let i=0;i<n.length;i+=3){
  const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;
 }
 return n;
}
function flipFraction(before,after,indices){
 const vertexCount=before.length/3,faces=indices?indices.length/3:vertexCount/3;
 const step=Math.max(1,Math.ceil(faces/2500));let flips=0,count=0;
 function n(a,b,c,buffer){
  const i=a*3,j=b*3,k=c*3;
  const x=buffer[j]-buffer[i],y=buffer[j+1]-buffer[i+1],z=buffer[j+2]-buffer[i+2];
  const u=buffer[k]-buffer[i],v=buffer[k+1]-buffer[i+1],w=buffer[k+2]-buffer[i+2];
  return [y*w-z*v,z*u-x*w,x*v-y*u];
 }
 for(let f=0;f<faces;f+=step){
  const a=indices?indices[f*3]:f*3,b=indices?indices[f*3+1]:f*3+1,c=indices?indices[f*3+2]:f*3+2;
  const old=n(a,b,c,before),fresh=n(a,b,c,after);
  const dot=old[0]*fresh[0]+old[1]*fresh[1]+old[2]*fresh[2];
  if(dot<0)flips++;count++;
 }
 return {flips,faceSamples:count,flipFraction:count?flips/count:0};
}
function calculateCandidate(before,normals,indices,options,metrics,amplitude){
 const opts=normalizeSettings(options),out=new Float32Array(before.length);
 const center=metrics.low.map((v,i)=>v+metrics.size[i]/2);
 // Amplitude depends on local mesh dimensions and is capped to preserve coarse geometry.
 const envelope=Math.min(metrics.diagonal*.012,metrics.diagonal*.04*opts.intensity);
 const amp=envelope*amplitude;
 let energy=0,maxDelta=0;
 for(let i=0;i<before.length;i+=3){
  const x=before[i],y=before[i+1],z=before[i+2];
  const u=(x-center[0])/metrics.diagonal,v=(y-center[1])/metrics.diagonal,w=(z-center[2])/metrics.diagonal;
  const relief=morphology(u,v,w,opts.kind,opts.seed);
  const nx=normals[i],ny=normals[i+1],nz=normals[i+2],mag=Math.hypot(nx,ny,nz);
  const d=mag>1e-7?relief*amp:0;
  const dx=mag?d*nx/mag:0,dy=mag?d*ny/mag:0,dz=mag?d*nz/mag:0;
  out[i]=x+dx;out[i+1]=y+dy;out[i+2]=z+dz;
  maxDelta=Math.max(maxDelta,Math.abs(d));energy+=d*d;
 }
 const risk=flipFraction(before,out,indices);
 // Silhouette-preservation heuristic: max displacement and orientation changes.
 // This is NOT a multi-view render or artistic similarity score.
 const rms=Math.sqrt(energy/metrics.vertices);
 const ratio=maxDelta/metrics.diagonal;
 const fitness=Math.round(clamp(100-1000*risk.flipFraction-300*ratio+Math.min(10,rms/metrics.diagonal*200),0,100));
 return {positions:out,metrics:{...risk,fitness,maxShift:maxDelta,relativeShift:ratio,rms,
  safe:risk.flipFraction<.006&&ratio<.021}};
}
export function evolveSurface({positions,normals=null,indices=null,uv=null,kind="stone",seed=1,intensity=.35}={}){
 const basic=inspectMeshData(positions,indices,uv);
 const ns=normals&&normals.length===positions.length?normals:normalsFromGeometry(positions,indices);
 const settings=normalizeSettings({kind,seed,intensity});
 // Propose a constrained deformation. Back off if triangle inversion increases.
 let candidate;
 for(const amplitude of [1,.5,.25,0]){
  candidate=calculateCandidate(positions,ns,indices,settings,basic,amplitude);
  if(candidate.metrics.safe)break;
 }
 return {positions:candidate.positions,report:{...candidate.metrics,
  vertices:basic.vertices,triangles:basic.triangles,hasUV:basic.hasUV,
  depthRatio:basic.depthRatio,kind:settings.kind,seed:settings.seed,baseDiagonal:basic.diagonal}};
}
export function proposeSeeds(seed=1){const n=normalizeSettings({seed}).seed;
 return [n,((n+8190)%2147483646)+1,((n+16380)%2147483646)+1];
}
export function rankCandidates(results){
 return [...results].sort((a,b)=>Number(b?.fitness||0)-Number(a?.fitness||0));
}
