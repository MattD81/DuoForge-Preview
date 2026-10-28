import test from "node:test";
import assert from "node:assert/strict";
import {inspectGLB,inspectScene,recommendReuse,makeIndexEntry,makePortableReport,STACK_VERSION} from "../workshop/studio/research-stack-core.mjs";
function glb(doc,bin=new Uint8Array(4)){
 const json=new TextEncoder().encode(JSON.stringify(doc)),size=Math.ceil(json.length/4)*4;
 const out=new Uint8Array(12+8+size+(bin?8+bin.length:0)),v=new DataView(out.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);
 v.setUint32(12,size,true);v.setUint32(16,0x4e4f534a,true);
 out.fill(32,20,20+size);out.set(json,20);
 if(bin){const offset=20+size;v.setUint32(offset,bin.length,true);v.setUint32(offset+4,0x004e4942,true);out.set(bin,offset+8);}
 return out;
}
const base={asset:{version:"2.0"},scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],accessors:[{count:9},{count:12}],buffers:[{byteLength:4}]};
test("valid GLB estimates triangles and does not modify input",()=>{
 const original=glb(base),bytes=original.slice(),report=inspectGLB(original);
 assert.equal(report.estimatedTriangles,4);
 assert.equal(report.hasBinaryChunk,true);
 assert.equal(report.meshes,1);
 assert.deepEqual(original,bytes);
});
test("malformed headers, lengths and missing JSON are rejected",()=>{
 const valid=glb(base);
 const broken=valid.slice();broken[0]=0;
 assert.throws(()=>inspectGLB(broken),/header/);
 const trunc=valid.slice(0,-1);
 assert.throws(()=>inspectGLB(trunc),/längd/);
 assert.throws(()=>inspectGLB(new Uint8Array(20)),/header/);
});
test("non-self-contained GLB and decoder requirements are reported, not auto-fixed",()=>{
 const a=glb({...base,images:[{uri:"image.jpg"}],extensionsUsed:["KHR_texture_basisu","EXT_meshopt_compression"],extensionsRequired:["KHR_texture_basisu","EXT_meshopt_compression"]});
 const report=inspectGLB(a);
 assert.equal(report.externalResources[0],"image.jpg");
 assert.match(report.issues.join(" " ),/KTX2/);
 assert.match(report.issues.join(" " ),/Meshopt/);
});
test("scene audit catches invalid transforms without mutating them",()=>{
 const mesh={isMesh:true,name:"",position:{x:NaN,y:1,z:2},scale:{x:1,y:0,z:1},geometry:{attributes:{position:{count:9}}},material:{}};
 const root={traverse(fn){fn(mesh)}};
 const report=inspectScene(root,2);
 assert.equal(report.triangles,3);assert.ok(report.issues.length>=3);
 assert.ok(Number.isNaN(mesh.position.x));
});
test("content-addressed dedupe distinguishes same file and new version",()=>{
 const hash="a".repeat(64),other="b".repeat(64);
 const entry=makeIndexEntry({sha256:hash,name:"Kart",glb:{bytes:50},scene:{triangles:8,issues:[]}});
 assert.equal(entry.format,STACK_VERSION);
 assert.equal(recommendReuse(hash,"Kart",[entry]).status,"identical");
 assert.equal(recommendReuse(other,"Kart",[entry]).status,"new-version");
 assert.equal(recommendReuse(other,"Båt",[entry]).status,"new-asset");
 assert.equal(makePortableReport({entry,glb:{meshes:2},scene:{},capability:{}}).notice.includes("INTE"),true);
 assert.throws(()=>makeIndexEntry({sha256:"bad",name:"X"}));
});
