import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createNeuralSRShader,createNeuralBudget,validateNeuralModel,NEURAL_SR_MODEL} from "../workshop/studio/neural-sr.mjs";
test("pretrained CNN has real, finite learned weights",()=>{
 assert.ok(validateNeuralModel(NEURAL_SR_MODEL));
 assert.equal(NEURAL_SR_MODEL.training.kind,"deterministic-synthetic-v1");
 assert.equal(NEURAL_SR_MODEL.scale,2);
 assert.equal(NEURAL_SR_MODEL.conv1Weight.length,216);
 assert.ok(NEURAL_SR_MODEL.training.modelPsnrDb>NEURAL_SR_MODEL.training.baselinePsnrDb);
 assert.ok(NEURAL_SR_MODEL.conv1Weight.some(x=>x<-.1));
});
test("shader implements 3x3 RGB convolution, 8 ReLU channels, residual output",()=>{
 const s=createNeuralSRShader().fragmentShader;
 assert.equal((s.match(/vec3 s[0-2][0-2]=texture2D/g)||[]).length,9);
 assert.equal((s.match(/\+=dot\(/g)||[]).length,72);
 assert.match(s,/f7=max\(f7,0\.0\)/);
 assert.match(s,/clamp\(base\+clamp\(correction/);
 assert.doesNotMatch(s,/fetch\(|http:|https:/);
});
test("malformed or tampered model weights are refused",()=>{
 assert.throws(()=>validateNeuralModel({...NEURAL_SR_MODEL,conv1Weight:[NaN]}));
 assert.throws(()=>validateNeuralModel({...NEURAL_SR_MODEL,features:500}));
 assert.throws(()=>validateNeuralModel({...NEURAL_SR_MODEL,conv2Bias:[1,2,Infinity]}));
});
test("GPU budget only accepts new valid samples and resets",()=>{
 const b=createNeuralBudget({maxGpuMs:20,consecutive:3});
 for(let n=1;n<3;n++){assert.equal(b.sample({supported:true,samples:n,gpuMs:30}),false);}
 assert.equal(b.sample({supported:true,samples:2,gpuMs:30}),false);
 assert.equal(b.sample({supported:false,samples:3,gpuMs:100}),false);
 assert.equal(b.sample({supported:true,samples:3,gpuMs:30}),true);
 assert.equal(b.snapshot().disabled,true);
 b.reset(3);
 assert.equal(b.snapshot().disabled,false);
 assert.equal(b.sample({supported:true,samples:4,gpuMs:9}),false);
 assert.equal(b.snapshot().misses,0);
});
test("original 3D studio retains normal/temporal/raytracing paths",()=>{
 const studio=readFileSync(new URL("../workshop/studio/gpu-deluxe-v2-studio.mjs",import.meta.url),"utf8");
 assert.match(studio,/id="gpuV2Neural"/);
 assert.match(studio,/if\(mode==="raytrace"\)raytrace\(\);else if\(mode==="neural"\)neural\(\);else temporal\(\)/);
 assert.match(studio,/renderer\.setRenderTarget\(null\);renderer\.render\(fullscreen,quadCamera\)/);
 assert.match(studio,/mode==="off"\|\|disposed\|\|isBusy\(\)/);
});
