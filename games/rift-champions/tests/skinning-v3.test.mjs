import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=f('main.mjs'),loader=f('fighter-loader.mjs');
test('realistic Ara HD is preferred; genuine V3 and V2 retained as fallback',()=>{
  assert.match(main,/loadAraFighter/);
  assert.match(main,/_skinned_v3\\.glb/);
  assert.match(main,/loadDetailedFighter/);
  assert.match(main,/createFighter/);
  assert.ok(main.indexOf('loadAraFighter(')<main.indexOf('loadDetailedFighter('));
  assert.ok(main.indexOf('_skinned_v3.glb')<main.lastIndexOf("name+'.glb'"));
});
test('faces and skinned meshes are required and driven by combat events',()=>{
  assert.match(loader,/isSkinnedMesh/);
  assert.match(loader,/morphTargets<8/);
  assert.match(loader,/browAngry/);
  assert.match(main,/updateFacialRig\\(rigs\\[i\\]/);
});
test('Character Forge viewer includes BVH and accessible fighter selector',()=>{
  const viewer=f('character-forge/index.html');
  assert.match(viewer,/mocap-retarget\\.mjs/);
  assert.match(viewer,/id="fighter"/);
  assert.match(viewer,/id="face"/);
  assert.match(viewer,/id="import"/);
  assert.doesNotMatch(viewer,/@import\\s+url\\('https:/);
});
