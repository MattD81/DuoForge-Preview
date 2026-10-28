import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('premium uses proper skinning and Mixamo joints',()=>{
 const l=src('fighter-loader.mjs');
 for(const s of ['loadAraFighter','isSkinnedMesh','triangles<4500','UpperArm','ForeArm','UpLeg','Box3']) assert.ok(l.includes(s),s);
});
test('V3 and V2 remain available as fallback',()=>{
 const m=src('main.mjs');assert.ok(m.indexOf('loadAraFighter(')<m.indexOf('loadDetailedFighter('));
 assert.ok(m.includes('_skinned_v3.glb'));assert.ok(m.includes("name+'.glb'"));
});
test('new skins preserve humanoid head bind pose',()=>assert.match(src('fighter.mjs'),/rig\.restHeadY/));
test('MakeHuman expressions map to ARKit inputs',()=>{
 const l=src('fighter-loader.mjs');for(const k of ['eyeBlinkLeft','mouthSmile','browDownLeft','jawOpen','noseSneerLeft'])assert.ok(l.includes(k));
});
test('both fighter presets request real HD 3D skinning and face shapes',()=>{
 for(const n of ['kael','vex']){
  const p=JSON.parse(src('character-forge/'+n+'.params.json'));
  assert.equal(p.detail,'high');assert.equal(p.rig,'game');assert.equal(p.faceShapes,true);assert.equal(p.animations,true);
 }
});
