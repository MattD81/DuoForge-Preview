/**
 * DuoForge LookDev: deterministic art-direction presets for the EXISTING editor.
 * Controls only viewport lighting, never materials, mesh buffers, exported GLB
 * or project serialization. Values are deliberately bounded for mobile GPUs.
 */
export const LOOKDEV_PRESETS=Object.freeze({
 studio:Object.freeze({
  name:"Graphite Studio",background:0x10151f,sky:0xe4efff,ground:0x263e57,
  hemisphere:1.25,key:0xf3f5ff,keyPower:3.3,keyPosition:[7,11,8],
  fill:0xa3c8ff,fillPower:1.05,rim:0xb9e9ff,rimPower:2.25,
  environment:.85,exposure:1.12,shadow:.33
 }),
 daylight:Object.freeze({
  name:"Soft Daylight",background:0x9baab8,sky:0xf0f6ff,ground:0x718394,
  hemisphere:1.85,key:0xfff7e8,keyPower:2.8,keyPosition:[-7,13,9],
  fill:0xe2f5ff,fillPower:.72,rim:0xffffff,rimPower:1.15,
  environment:.7,exposure:1,shadow:.23
 }),
 golden:Object.freeze({
  name:"Golden Hour",background:0x312538,sky:0xffdfb8,ground:0x524266,
  hemisphere:1.1,key:0xffb86b,keyPower:4,keyPosition:[-9,7,-5],
  fill:0x809edc,fillPower:1.35,rim:0xffdfaa,rimPower:1.9,
  environment:.55,exposure:1.12,shadow:.39
 }),
 neon:Object.freeze({
  name:"Neon Noir",background:0x080d1f,sky:0x566daf,ground:0x0c1735,
  hemisphere:.48,key:0x4ccfff,keyPower:3,keyPosition:[8,9,3],
  fill:0xad68ff,fillPower:2,rim:0xff4baf,rimPower:4.2,
  environment:.58,exposure:1.28,shadow:.37
 })
});
const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
export function lookdevSettings(preset="studio",exposure=1){
 const key=Object.hasOwn(LOOKDEV_PRESETS,preset)?preset:"studio";
 const config=LOOKDEV_PRESETS[key];
 const multiplier=Number.isFinite(exposure)?clamp(exposure,.6,1.6):1;
 return Object.freeze({...config,key,
  exposure:Number((config.exposure*multiplier).toFixed(3))});
}
/** Tightens the light shadow frustum around editor models at the origin. */
export function lookdevShadowExtent(bounds){
 if(!bounds||bounds.isEmpty?.()||!bounds.min||!bounds.max)return 25;
 const coords=[...bounds.min.toArray(),...bounds.max.toArray()];
 if(!coords.every(Number.isFinite))return 25;
 const radius=Math.max(...coords.map(Math.abs));
 return Number(clamp(radius*1.4+1.6,5,60).toFixed(2));
}
