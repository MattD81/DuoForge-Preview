// LAST LIGHT v2 — deterministic, reproducible archipelago heightfields.
// No external meshes, GPU compute service or paid textures.
export const ISLAND_SITES=Object.freeze([
 Object.freeze({x:-145,z:-88,r:25,seed:11,lighthouse:true}),
 Object.freeze({x:118,z:-185,r:39,seed:29,lighthouse:true}),
 Object.freeze({x:155,z:-268,r:32,seed:41}),
 Object.freeze({x:-160,z:-254,r:43,seed:57}),
 Object.freeze({x:-108,z:53,r:29,seed:71,harbor:true}),
 Object.freeze({x:159,z:26,r:45,seed:83}),
 Object.freeze({x:132,z:-340,r:34,seed:101}),
 Object.freeze({x:-131,z:-360,r:26,seed:109})
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
function hash(x,y,seed){
 return fract(Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453);
}
function smoothNoise(x,y,seed){
 const xi=Math.floor(x),yi=Math.floor(y),u=x-xi,v=y-yi;
 const sx=u*u*(3-2*u),sy=v*v*(3-2*v);
 const a=hash(xi,yi,seed),b=hash(xi+1,yi,seed);
 const c=hash(xi,yi+1,seed),d=hash(xi+1,yi+1,seed);
 return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
export function coastlineRadius(theta,seed=0){
 return 1+.095*Math.sin(theta*3.0+seed*.67)
  +.066*Math.sin(theta*7.0-seed*.31)
  +.035*Math.cos(theta*13+seed*.23);
}
export function terrainHeight(dx,dz,radius,seed=0){
 if(!Number.isFinite(dx+dz+radius+seed)||radius<=0)return -8;
 const bearing=Math.atan2(dz/1.12,dx);
 const rr=Math.hypot(dx,dz/1.12)/(radius*coastlineRadius(bearing,seed));
 if(rr>1)return -.6-Math.min(5,(rr-1)*radius*.48);
 const u=clamp(rr,0,1),land=Math.pow(1-u,1.29);
 const top=8+radius*.31;
 const detail=(smoothNoise(dx*.095+3.1,dz*.095-2.4,seed)*2-1)*2.7;
 const strata=Math.sin(dx*.47+seed*.3)*Math.cos(dz*.34-seed*.23)*.47;
 return -.6+land*top+Math.sin(u*8.1+seed)*.5*land+(detail+strata)*Math.pow(land,.65);
}
export function isLand(dx,dz,radius,seed=0){
 const bearing=Math.atan2(dz/1.12,dx);
 return Math.hypot(dx,dz/1.12)<radius*coastlineRadius(bearing,seed);
}
export function selectTerrainResolution(quality="medium"){
 return quality==="low"?{rings:9,segments:28,trees:34,rocks:15}:
  quality==="high"?{rings:22,segments:64,trees:220,rocks:88}:
  {rings:15,segments:44,trees:100,rocks:40};
}
export function deterministicRandom(seed){
 let state=(seed>>>0)||1;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
