/** Non-network, user-triggered training image capture. One PNG atlas per click. */
import * as THREE from "three";
export function captureTrainingAtlas({renderer,scene,camera,canvas}){
 if(!renderer||!scene||!camera)throw TypeError("Missing active Studio renderer");
 const drawing=new THREE.Vector2();
 renderer.getDrawingBufferSize(drawing);
 const factor=Math.min(1,960/Math.max(1,drawing.x),540/Math.max(1,drawing.y));
 const w=Math.max(32,Math.floor(drawing.x*factor/2)*2);
 const h=Math.max(32,Math.floor(drawing.y*factor/2)*2);
 const high=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,format:THREE.RGBAFormat});
 const low=new THREE.WebGLRenderTarget(w/2,h/2,{depthBuffer:true,format:THREE.RGBAFormat});
 const previous=renderer.getRenderTarget();
 try{
  renderer.setRenderTarget(high);renderer.clear();renderer.render(scene,camera);
  renderer.setRenderTarget(low);renderer.clear();renderer.render(scene,camera);
  const atlas=document.createElement("canvas");atlas.width=w*2;atlas.height=h;
  const ctx=atlas.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw Error("2D canvas unavailable");
  function extract(t,tw,th){
   const pixels=new Uint8Array(tw*th*4);
   renderer.readRenderTargetPixels(t,0,0,tw,th,pixels);
   const img=ctx.createImageData(tw,th);
   for(let y=0;y<th;y++)img.data.set(pixels.subarray((th-y-1)*tw*4,(th-y)*tw*4),y*tw*4);
   const c=document.createElement("canvas");c.width=tw;c.height=th;
   c.getContext("2d").putImageData(img,0,0);
   return c;
  }
  ctx.drawImage(extract(high,w,h),0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(extract(low,w/2,h/2),w,0,w,h);
  const a=document.createElement("a");
  a.href=atlas.toDataURL("image/png");
  a.download="duoforge-neural-pair-"+Date.now()+".png";
  a.click();
  return {width:w,height:h,scale:2,exported:true};
 }finally{
  renderer.setRenderTarget(previous);
  high.dispose();low.dispose();
 }
}
