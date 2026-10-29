import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseFailure,isLatestFailedRun,renderSummary} from '../scripts/ci-guardian-core.mjs';
test('WebGL duplicate shader attributes',()=>{
  assert.equal(diagnoseFailure("THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false\nERROR: 0:69: 'position' : redefinition").code,'shader-duplicate-attribute');
});
test('Playwright movie editor timeout',()=>{
  assert.equal(diagnoseFailure("locator.click: Timeout 30000ms exceeded.\nwaiting for locator('#filmMovieEditor summary')").code,'ui-click-timeout');
});
test('V5 floating point strict equality',()=>{
  assert.equal(diagnoseFailure('strictEqual ERR_ASSERTION expected: 0.35 actual: 0.3499999940395355').code,'float-precision');
});
test('Unknown errors remain unknown',()=>{
  assert.equal(diagnoseFailure('Process exit 1').code,'unclassified');
});
test('Only latest failed SHA is diagnosed',()=>{
  assert.equal(isLatestFailedRun({head_sha:'abc',conclusion:'failure'},'abc'),true);
  assert.equal(isLatestFailedRun({head_sha:'abc',conclusion:'failure'},'def'),false);
  assert.equal(isLatestFailedRun({head_sha:'abc',conclusion:'success'},'abc'),false);
});
test('Summary clearly disclaims repairs',()=>{
  const t=renderSummary({id:1,name:'Studio',head_branch:'feat/x',head_sha:'1234567890',repository:{full_name:'MattD81/DuoForge-Preview'}},
    [{job:'web',step:'test',diagnosis:diagnoseFailure('locator.click: Timeout 30000ms exceeded')}],true);
  assert.match(t,/ui-click-timeout/);
  assert.match(t,/Inga kodändringar eller merge/);
});