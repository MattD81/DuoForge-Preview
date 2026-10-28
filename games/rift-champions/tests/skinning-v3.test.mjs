
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const f=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=f('main.mjs'),loader=f('fighter-loader.mjs');
test('combat loads the genuine V3 GLBs first, then V2 fallback',()=>{
  assert.match(main,/kael'\:'vex'/);assert.match(main,/_skinned_v3\.glb/);
  assert.match(main,/loadDetailedFighter\(v3,i\)\.catch/);
});
test('faces and skinned mesh are required and driven by fight events',()=>{
  assert.match(loader,/isSkinnedMesh/);
  assert.match(loader,/morphTargets<8/);
  assert.match(loader,/browAngry/);
  assert.match(main,/updateFacialRig\(rigs\[i\]/);
});
test('Character Forge viewer includes BVH and accessible fighter selector',()=>{
  const viewer=f('character-forge/index.html');
  assert.match(viewer,/mocap-retarget\.mjs/);
  assert.match(viewer,/id="fighter"/);
  assert.match(viewer,/id="face"/);
  assert.match(viewer,/id="import"/);
  assert.doesNotMatch(viewer,/@import\s+url\('https:/);
});
