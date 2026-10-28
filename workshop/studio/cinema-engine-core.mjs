// DuoForge Cinema Engine Core V1 – written from scratch.
//
// Owns deterministic offline sampling, photographic shutter timing, linear-light
// pixel accumulation and export. Three.js remains the GLB/WebGL scene backend.
// Nothing here invokes a remote model, render farm, paid API or ChatGPT Work.
export const ENGINE_VERSION="duoforge-cinema-core@1";
export const ENGINE_PROFILES=Object.freeze({
 mobile:Object.freeze({maxWidth:1280,maxHeight:720,maxSamples:2,maxBatch:24}),
 desktop:Object.freeze({maxWidth:3840,maxHeight:2160,maxSamples:4,maxBatch:48})
});
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const VALID_FPS=new Set([12,20,24,25,30,60]);
export function filmClock({duration=20,fps=24,startFrame=0,samples=1,
 shutterAngle=180,platform="desktop"}={}){
 if(!Number.isFinite(duration)||duration<=0||duration>1800)throw Error("Ogiltig filmlängd.");
 if(!VALID_FPS.has(Number(fps)))throw Error("Stödjer 12, 20, 24, 25, 30 eller 60 fps.");
 const profile=ENGINE_PROFILES[platform]||ENGINE_PROFILES.desktop;
 const frames=Math.round(duration*fps);
 if(Math.abs(frames/fps-duration)>1e-7)throw Error("Filmlängden måste motsvara hela bildrutor.");
 if(!Number.isInteger(startFrame)||startFrame<0||startFrame>=frames)
  throw Error("Startbildruta ligger utanför filmens längd.");
 if(!Number.isInteger(samples)||samples<1||samples>profile.maxSamples)
  throw Error("För många prover per ruta för enheten.");
 const angle=clamp(Number(shutterAngle)||180,0,360);
 const shutter=angle/360/fps;
 const maxTime=(frames-1)/fps;
 return Object.freeze({
  fps,duration,frames,startFrame,samples,shutterAngle:angle,platform,
  timeAt(index){
   if(!Number.isInteger(index)||index<0||index>=frames)throw Error("Bildruta utanför tidslinjen.");
   return index/fps;
  },
  shutterTimes(index){
   if(!Number.isInteger(index)||index<0||index>=frames)throw Error("Bildruta utanför tidslinjen.");
   const time=index/fps;
   // Expose only causal shutter positions to preserve last frame coverage
   // and avoid sampling future cuts at exact timeline boundaries.
   return Array.from({length:samples},(_,j)=>clamp(
    time+((j+.5)/samples-.5)*shutter,0,maxTime));
  }
 });
}
export function validateRenderSize(width,height,platform="desktop"){
 const p=ENGINE_PROFILES[platform]||ENGINE_PROFILES.desktop;
 if(!Number.isInteger(width)||!Number.isInteger(height)||
  width<64||height<36||width>p.maxWidth||height>p.maxHeight)
  throw Error("Upplösningen är för stor för denna enhet.");
 return {width,height,bytes:width*height*4,linearBytes:width*height*3*4};
}
const encodeSRGB=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
const decodeSRGB=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
const LUT=Float32Array.from({length:256},(_,i)=>decodeSRGB(i/255));
const LINEAR_LUT=Uint8ClampedArray.from({length:4097},(_,i)=>
 Math.round(encodeSRGB(i/4096)*255));
function encode(v){return LINEAR_LUT[Math.max(0,Math.min(4096,Math.round(v*4096)))]}
/**
 * Render sample frames into the existing WebGL canvas, feed them here,
 * then export a spatially consistent PNG averaged in *linear light*.
 * The scratch 2D canvas is completely independent of Three.js rendering.
 *
 * Blending tone-mapped frames is not HDR path tracing. This is a
 * bounded optical motion-blur/temporal antialiasing compositing stage.
 */
export class TemporalFilmCompositor{
 constructor({width,height,platform="desktop",canvasFactory=null}={}){
  validateRenderSize(width,height,platform);
  const make=canvasFactory||(()=>document.createElement("canvas"));
  this.surface=make();this.surface.width=width;this.surface.height=height;
  this.context=this.surface.getContext("2d",{willReadFrequently:true,alpha:false});
  if(!this.context)throw Error("2D-bildbuffert är inte tillgänglig.");
  this.width=width;this.height=height;
  this.linear=new Float32Array(width*height*3);
  this.count=0;
 }
 reset(){this.linear.fill(0);this.count=0}
 add(source){
  if(!source||source.width!==this.width||source.height!==this.height)
   throw Error("Bildrutans upplösning stämmer inte.");
  const ctx=this.context;
  ctx.clearRect(0,0,this.width,this.height);
  ctx.drawImage(source,0,0,this.width,this.height);
  const rgba=ctx.getImageData(0,0,this.width,this.height).data;
  const rgb=this.linear;const weight=1/(this.count+1);
  if(this.count===0){
   for(let i=0,j=0;i<rgba.length;i+=4,j+=3){
    rgb[j]=LUT[rgba[i]];rgb[j+1]=LUT[rgba[i+1]];rgb[j+2]=LUT[rgba[i+2]];
   }
  }else{
   for(let i=0,j=0;i<rgba.length;i+=4,j+=3){
    rgb[j]+=(LUT[rgba[i]]-rgb[j])*weight;
    rgb[j+1]+=(LUT[rgba[i+1]]-rgb[j+1])*weight;
    rgb[j+2]+=(LUT[rgba[i+2]]-rgb[j+2])*weight;
   }
  }
  this.count++;
 }
 finish(){
  if(!this.count)throw Error("Ingen bildruta finns att exportera.");
  const img=this.context.createImageData(this.width,this.height),rgba=img.data;
  for(let i=0,j=0;i<rgba.length;i+=4,j+=3){
   rgba[i]=encode(this.linear[j]);rgba[i+1]=encode(this.linear[j+1]);
   rgba[i+2]=encode(this.linear[j+2]);rgba[i+3]=255;
  }
  this.context.putImageData(img,0,0);
  return this.surface;
 }
 async png(){
  const surface=this.finish();
  const blob=await new Promise(resolve=>surface.toBlob(resolve,"image/png"));
  if(!blob?.size)throw Error("Kunde inte skapa bildruta från Cinema Engine.");
  return blob;
 }
 dispose(){this.linear=null;this.surface.width=this.surface.height=0;this.context=null}
}
