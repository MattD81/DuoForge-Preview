/**
 * DuoForge GPU Deluxe V2: true elapsed GPU time when WebGL2 timer queries work.
 * These are asynchronous/nonblocking queries, not CPU frame duration estimates.
 * No paid GPU services, no vendor-specific or proprietary shader sources.
 */
export const GPU_DELUXE_V2_VERSION="duoforge-gpu-deluxe@2";
export function createGpuTimer(renderer,{maxPending=3}={}){
 const gl=renderer?.getContext?.();
 let ext=null;
 try{
  if(renderer?.capabilities?.isWebGL2&&gl?.createQuery&&gl?.beginQuery&&gl?.getQueryParameter)
   ext=gl.getExtension("EXT_disjoint_timer_query_webgl2");
 }catch{}
 let pending=[],active=null,disposed=false,ms=null,samples=0,disjointCount=0;
 const supported=!!ext;
 const clear=()=>{
  for(const q of pending){try{gl.deleteQuery(q)}catch{}}
  pending=[];
 };
 const snapshot=()=>Object.freeze({supported,
  source:supported?"EXT_disjoint_timer_query_webgl2":"unavailable",
  gpuMs:ms===null?null:Number(ms.toFixed(2)),samples,disjointCount,
  pending:pending.length,active:!!active});
 function begin(){
  if(disposed||!supported||active||pending.length>=maxPending)return false;
  try{
   if(gl.isContextLost?.())return false;
   if(gl.getQuery?.(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return false;
   const q=gl.createQuery();if(!q)return false;
   try{gl.beginQuery(ext.TIME_ELAPSED_EXT,q);active=q;return true}
   catch{gl.deleteQuery(q);return false}
  }catch{return false}
 }
 function end(){
  if(!active||disposed)return false;
  const q=active;active=null;
  try{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);return true}
  catch{try{gl.deleteQuery(q)}catch{};return false}
 }
 function poll(){
  if(disposed||!supported)return snapshot();
  try{
   if(gl.isContextLost?.()){clear();ms=null;return snapshot()}
   if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
    clear();ms=null;disjointCount++;return snapshot();
   }
   while(pending.length){
    const q=pending[0];
    if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;
    const ns=gl.getQueryParameter(q,gl.QUERY_RESULT);
    pending.shift();gl.deleteQuery(q);
    if(Number.isFinite(ns)&&ns>=0&&ns<1e12){ms=ns/1e6;samples++}
   }
  }catch{clear();ms=null}
  return snapshot();
 }
 function dispose(){
  if(disposed)return;
  if(active){try{gl.endQuery(ext.TIME_ELAPSED_EXT)}catch{}
   try{gl.deleteQuery(active)}catch{};active=null}
  clear();disposed=true;
 }
 return Object.freeze({begin,end,poll,snapshot,dispose,get supported(){return supported}});
}
export function reconstructionPolicy({width=1280,height=720,scale=.7,mobile=false}={}){
 const w=Math.max(1,Math.floor(Number(width)||1)),h=Math.max(1,Math.floor(Number(height)||1));
 const ratio=Math.max(.5,Math.min(1,Number.isFinite(scale)?scale:.7));
 const budget=mobile?1_500_000:3_000_000;
 const effective=Math.min(ratio,Math.sqrt(budget/(w*h)));
 return Object.freeze({outputWidth:w,outputHeight:h,
  renderWidth:Math.max(1,Math.round(w*effective)),
  renderHeight:Math.max(1,Math.round(h*effective)),
  scale:Number(effective.toFixed(3)),mode:"temporal-reconstruction",
  neural:false,usesMotionVectors:false});
}
