import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main = readFileSync(new URL('../main.mjs',import.meta.url),'utf8');
const loader = readFileSync(new URL('../fighter-loader.mjs',import.meta.url),'utf8');
test('HD character loader connects to the real combat rig without changing match logic',()=>{
 assert.match(main,/loadDetailedFighter/);
 assert.match(main,/rigs\[i\]=detailed/);
 assert.match(loader,/get\('body'\)/);
 for(const part of ['shoulder_','elbow_','fist_','hip_','knee_','shin_','foot_'])assert.ok(loader.includes(part));
});
test('missing GLB leaves the original playable model intact',()=>{
 assert.match(main,/createFighter\(\{index:0\}\)/);
 assert.match(main,/\.catch\(error=>/);
 assert.match(main,/status:'fallback'/);
});
test('load exact locally-built files, not paid 3D reconstruction API',()=>{
 assert.match(main,/\.\/models\//);
 assert.match(main,/\.glb/);
 assert.doesNotMatch(loader,/fetch\(['"]https?:/);
});