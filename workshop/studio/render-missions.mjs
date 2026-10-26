// Deterministic checkpoint tests independent of rendering frame rate.
// Coordinates are metres in the world X/Z plane.
export function checkpointReached(x,z,gateX,gateZ,radius=3.4){
 const px=Number(x),pz=Number(z),gx=Number(gateX),gz=Number(gateZ);
 if(![px,pz,gx,gz].every(Number.isFinite))return false;
 const r=Math.max(.1,Math.min(Number(radius)||3.4,10));
 return (px-gx)*(px-gx)+(pz-gz)*(pz-gz)<=r*r;
}
export function checkpointProgress(current,total,positions,vehicleX,vehicleZ){
 const index=Math.max(0,Math.min(Math.trunc(current)||0,total));
 if(index>=total)return {next:index,completed:true,advanced:false};
 const gate=positions[index];
 if(!gate||!checkpointReached(vehicleX,vehicleZ,gate.x,gate.z))
  return {next:index,completed:false,advanced:false};
 return {next:index+1,completed:index+1>=total,advanced:true};
}
