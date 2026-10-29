import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createBiomechanicsAdapter} from "../games/rift-champions/character-forge/biomechanics-three.mjs";

function skinnedDummy(){
 const root=new THREE.Group();
 const bones=["body","pelvis","spine","chest","neck","head",
 "shoulder_left","shoulder_right","elbow_left","elbow_right",
 "fist_left","fist_right","hip_left","hip_right","knee_left",
 "knee_right","foot_left","foot_right"];
 for(const name of bones){
  const b=new THREE.Bone();b.name=name;root.add(b);
 }
 const mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(1,2,1),
  new THREE.MeshStandardMaterial());
 mesh.name="connected-humanoid-mesh";
 mesh.morphTargetDictionary={jawOpen:0,blinkLeft:1,blinkRight:2,browAngry:3,
  smile:4,pain:5,snarl:6,surprise:7,bicepsBulgeLeft:8};
 mesh.morphTargetInfluences=new Array(9).fill(0);
 root.add(mesh);
 return root;
}

test("real GLB-style bone aliases map and preserve original quaternions",()=>{
 const root=skinnedDummy();
 const leftShoulder=root.getObjectByName("shoulder_left");
 const original=leftShoulder.quaternion.clone();
 const adapter=createBiomechanicsAdapter(root);
 const diagnostics=adapter.diagnostics();
 assert.ok(diagnostics.mappedChannels>=15,JSON.stringify(diagnostics));
 assert.equal(diagnostics.skinnedMeshes,1);
 assert.ok(diagnostics.totalChannels>=70);
 assert.ok(diagnostics.unmapped.includes("left.index.middle"),"V3 has no finger bones");
 assert.equal(diagnostics.muscleGroups,144);
 adapter.setMotion("reach");
 for(let i=0;i<100;i++)adapter.update(1/60);
 assert.ok(leftShoulder.quaternion.angleTo(original)>.05,
  "Real bone transforms change when a motion is active");
 const mesh=root.getObjectByName("connected-humanoid-mesh");
 assert.ok(mesh.morphTargetInfluences.every(Number.isFinite));
 adapter.stop();
 assert.ok(leftShoulder.quaternion.angleTo(original)<1e-5,
  "Stopping restores bone local pose without modifying skinned vertex topology");
});
test("an unrigged decorative mesh is rejected and cannot silently fake full-body motion",()=>{
 const root=new THREE.Group();
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
 assert.throws(()=>createBiomechanicsAdapter(root),/SkinnedMesh/);
});
test("mixed coordinated movements reuse same bones without NaN",()=>{
 const root=skinnedDummy(),adapter=createBiomechanicsAdapter(root);
 adapter.setMotion("walk");
 adapter.engine.setOverlay("wave",{weight:.85,mask:["left.shoulder.flex","left.elbow.flex"]});
 let report;
 for(let n=0;n<240;n++)report=adapter.update(1/120);
 assert.equal(report.motion,"walk");
 assert.ok(report.strongest.length>0);
 for(const joint of Object.values(report.joints))assert.ok(Number.isFinite(joint));
 const pose=root.getObjectByName("elbow_left").quaternion;
 assert.ok([pose.x,pose.y,pose.z,pose.w].every(Number.isFinite));
 adapter.stop();
 assert.equal(adapter.update(1/60),null);
});
