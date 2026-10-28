import * as THREE from "three";
// Smooth subdued hull wake strips attached to ship kinematics.
// Draws two low-cost dynamic translucent ribbons rather than noisy foam sprites.
export function createWakeTrails({world,ocean,quality="medium"}){
 const max=quality==="low"?12:quality==="medium"?19:27;
 const paths=[[],[]],geometries=[],meshes=[];
 for(let side=0;side<2;side++){
  const pos=new Float32Array(max*2*3),rgb=new Float32Array(max*2*3);
  const idx=new Uint16Array((max-1)*6);
  for(let j=0;j<max-1;j++){
   const a=j*2,k=j*6;idx[k]=a;idx[k+1]=a+1;idx[k+2]=a+2;
   idx[k+3]=a+1;idx[k+4]=a+3;idx[k+5]=a+2;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color",new THREE.BufferAttribute(rgb,3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx,1));geo.setDrawRange(0,0);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
   color:0x9fc3c3,vertexColors:true,transparent:true,opacity:quality==="low"?.17:.24,
   depthWrite:false,side:THREE.DoubleSide,fog:true,polygonOffset:true,polygonOffsetFactor:-1
  }));
  mesh.name="Subtle water-current wake ribbon "+(side===0?"port":"starboard");
  mesh.frustumCulled=false;mesh.renderOrder=1;world.add(mesh);
  meshes.push(mesh);geometries.push(geo);
 }
 let lastSample=-1;
 function update(time,dt,state){
  const moving=state.speed>1.6;
  if(moving&&(time-lastSample>.13||lastSample<0)){
   lastSample=time;
   for(let side=0;side<2;side++){
    const sign=side===0?-1:1;
    const out=1.45+Math.min(state.speed*.045,.5);
    const across=sign*out;
    const x=state.x-Math.sin(state.yaw)*6.4+Math.cos(state.yaw)*across;
    const z=state.z+Math.cos(state.yaw)*6.4+Math.sin(state.yaw)*across;
    paths[side].unshift({x,z,yaw:state.yaw,time,speed:state.speed});
    if(paths[side].length>max)paths[side].length=max;
   }
  }
  for(let side=0;side<2;side++){
   const path=paths[side],geo=geometries[side],positions=geo.attributes.position.array;
   const colors=geo.attributes.color.array;
   while(path.length&&time-path.at(-1).time>4.2)path.pop();
   const n=path.length;
   geo.setDrawRange(0,Math.max(0,n-1)*6);
   for(let j=0;j<n;j++){
    const sample=path[j],age=Math.max(0,time-sample.time),fade=Math.max(0,1-age/4.2);
    const width=(.22+j*.055)*(Math.min(sample.speed/9,1))+.09;
    const dx=Math.cos(sample.yaw),dz=Math.sin(sample.yaw);
    const sea=ocean.heightAt(sample.x,sample.z,time)+.035;
    for(let v=0;v<2;v++){
     const sign=v===0?-1:1,offset=6*(j*2+v);
     positions[offset]=sample.x+dx*width*sign;
     positions[offset+1]=sea+.008;
     positions[offset+2]=sample.z+dz*width*sign;
     const edge=v===0?.43:.67;
     colors[offset]=fade*.48*edge;
     colors[offset+1]=fade*.72*edge;
     colors[offset+2]=fade*.83*edge;
    }
   }
   geo.attributes.position.needsUpdate=true;
   geo.attributes.color.needsUpdate=true;
   // Wake geometry ends when stationary; old wakes fade rather than teleporting.
  }
 }
 function reset(){
  lastSample=-1;
  for(let i=0;i<2;i++){paths[i].length=0;geometries[i].setDrawRange(0,0);}
 }
 return {update,reset,meshes,geometries};
}
