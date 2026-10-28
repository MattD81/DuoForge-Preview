import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATIVE_FORMAT, categorizeAsset, createLocalAgentPlan, findReuse,
  inspectManifest, makeCreativeManifest, makeCreativeZip, qualitySettings, safeAssetName
} from "../workshop/studio/creative-core.mjs";

const hash = "a".repeat(64);

test("safe names and asset categories", () => {
  assert.equal(safeAssetName("../My new: Car"), "___My-new_-Car");
  assert.equal(categorizeAsset("DuoForge Kart"), "fordon");
  assert.equal(categorizeAsset("Ek träd"), "natur");
  assert.equal(categorizeAsset("Island ship"), "fartyg");
});

test("portable manifest validates SHA and filename without private data", () => {
  const m = makeCreativeManifest({name:"Mitt spel",hash,filename:"scene.glb",objects:[{name:"Bil",kind:"mesh"}]});
  assert.equal(m.format, CREATIVE_FORMAT);
  assert.deepEqual(inspectManifest(m), {file:"scene.glb",hash});
  assert.equal(m.objects[0].category, "fordon");
  assert.equal(m.source.projectId, null);
  assert.throws(() => inspectManifest({...m,asset:{file:"../secret.glb",sha256:hash}}));
  assert.throws(() => makeCreativeManifest({name:"oops",hash:"x",filename:"scene.glb"}));
});

test("reuse only reuses matching digest, not matching name alone", () => {
  const library = [{name:"Car",sha256:hash,category:"fordon"}];
  assert.equal(findReuse({sha256:hash,name:"Car"},library).status, "reuse");
  assert.equal(findReuse({sha256:"b".repeat(64),name:"Car"},library).status, "review");
  assert.equal(findReuse({sha256:"b".repeat(64),name:"Boat"},library).status, "new");
});

test("local agent does not pretend to generate missing assets", () => {
  const assets = [{name:"Kart",sha256:hash,category:"fordon"}];
  const plan = createLocalAgentPlan("Skapa en bil, ett hus och träd",assets);
  assert.deepEqual(plan.requested,["fordon","byggnad","natur"]);
  assert.equal(plan.reusable.length,1);
  assert.deepEqual(plan.missing,["byggnad","natur"]);
  assert.equal(plan.mode,"local-rules");
});

test("device graphics profiles cap pixel ratio", () => {
  assert.equal(qualitySettings("eco",3).pixelRatio,1);
  assert.equal(qualitySettings("balanced",3).pixelRatio,1.5);
  assert.equal(qualitySettings("high",3).pixelRatio,2);
});

test("ZIP has valid local directory, central directory and correct payload", () => {
  const payload = new TextEncoder().encode("DuoForge 3D");
  const zip = makeCreativeZip([{name:"scene.glb",bytes:payload}]);
  const dv = new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
  assert.equal(dv.getUint32(0,true),0x04034b50);
  const nameSize = dv.getUint16(26,true);
  const fileStart = 30 + nameSize;
  assert.equal(new TextDecoder().decode(zip.slice(fileStart,fileStart+payload.length)),"DuoForge 3D");
  const central = fileStart+payload.length;
  assert.equal(dv.getUint32(central,true),0x02014b50);
  assert.equal(dv.getUint32(zip.length-22,true),0x06054b50);
  assert.throws(() => makeCreativeZip([{name:"../hidden",bytes:payload}]));
});
