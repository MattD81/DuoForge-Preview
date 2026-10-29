/**
 * DuoForge Neural Engine v0.1 — real trained convolutional inference in WebGL.
 * Offline generated weights, zero runtime model downloads, no ONNX requirement.
 * Not DLSS, temporal neural reconstruction, or a substitute for higher detail meshes.
 */
import {NEURAL_SR_MODEL} from "./neural-sr-weights.mjs";
export {NEURAL_SR_MODEL};
export const NEURAL_ENGINE_VERSION="duoforge-neural-engine@0.1";
const isVector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=16);
export function validateNeuralModel(m){
 if(!m||m.version!=="duoforge-neural-sr@0.1"||m.scale!==2||
  !Number.isInteger(m.features)||m.features<1||m.features>8||
  !isVector(m.conv1Weight,m.features*3*3*3)||
  !isVector(m.conv1Bias,m.features)||
  !isVector(m.conv2Weight,m.features*3)||
  !isVector(m.conv2Bias,3))throw new TypeError("Unsupported/invalid neural SR weights");
 return true;
}
const glsl=x=>(Number(x).toFixed(7));
export function createNeuralSRShader(model=NEURAL_SR_MODEL){
 validateNeuralModel(model);
 const n=model.features;
 const lines=[
  "precision highp float;",
  "uniform sampler2D tCurrent;",
  "uniform vec2 uOutputTexel;",
  "varying vec2 vUv;",
  "void main(){",
  "vec3 base=texture2D(tCurrent,vUv).rgb;"
 ];
 for(let i=0;i<n;i++)lines.push("float f"+i+"="+glsl(model.conv1Bias[i])+";");
 for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
  const key="s"+(y+1)+(x+1);
  lines.push("vec3 "+key+"=texture2D(tCurrent,clamp(vUv+uOutputTexel*vec2("+x+".0,"+y+".0),vec2(0.0),vec2(1.0))).rgb;");
  const tap=(y+1)*3+(x+1);
  for(let i=0;i<n;i++){
   const w=[0,1,2].map(c=>glsl(model.conv1Weight[i*27+c*9+tap]));
   lines.push("f"+i+"+=dot("+key+",vec3("+w.join(",")+"));");
  }
 }
 for(let i=0;i<n;i++)lines.push("f"+i+"=max(f"+i+",0.0);");
 const channels=[0,1,2].map(c=>{
  const sum=Array.from({length:n},(_,i)=>"f"+i+"*"+glsl(model.conv2Weight[c*n+i])).join("+");
  return "("+glsl(model.conv2Bias[c])+"+"+sum+")";
 });
 lines.push("vec3 correction=vec3("+channels.join(",")+");");
 // Limit synthetic-model overshoot; never hallucinate more than 15% per channel.
 lines.push("gl_FragColor=vec4(clamp(base+clamp(correction,vec3(-0.15),vec3(0.15)),0.0,1.0),1.0);");
 lines.push("}");
 return Object.freeze({
  vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
  fragmentShader:lines.join("\n")
 });
}
/** Timed GPU query circuit-breaker; only counts *new* valid query samples. */
export function createNeuralBudget({maxGpuMs=20,consecutive=8}={}){
 if(!Number.isFinite(maxGpuMs)||maxGpuMs<=0||!Number.isInteger(consecutive)||consecutive<1)throw TypeError("Invalid neural GPU budget");
 let misses=0,disabled=false,lastSamples=0;
 return Object.freeze({
  sample(q){
   if(disabled||!q?.supported||q.gpuMs===null||!Number.isFinite(q.gpuMs)||
    !Number.isInteger(q.samples)||q.samples<=lastSamples)return disabled;
   lastSamples=q.samples;
   misses=q.gpuMs>maxGpuMs?misses+1:0;
   if(misses>=consecutive)disabled=true;
   return disabled;
  },
  reset(samples=0){misses=0;disabled=false;lastSamples=samples;},
  snapshot(){return Object.freeze({disabled,misses,maxGpuMs,lastSamples});}
 });
}
