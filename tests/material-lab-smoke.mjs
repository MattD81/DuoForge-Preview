import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const failures=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
 page.on("pageerror",e=>failures.push(e.message));
 page.on("console",m=>{if(m.type()==="error")failures.push(m.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 assert.equal(await page.locator("#materialSwatches [data-surface]").count(),17);
 assert.equal(await page.locator("#applySurface").isEnabled(),true);
 console.log("PASS: 17 live PBR surface swatches and Material Lab selection integration");

 // The default kart has a full nested mesh scene. Coating it must be undoable.
 await page.locator('[data-surface="carbon"]').click();
 assert.equal(await page.locator("#surfaceTint").inputValue(),"#3b4b57");
 await page.locator("#surfaceTile").fill("4");
 await page.locator("#applySurface").click();
 assert.match(await page.locator("#surfaceStatus").textContent(),/meshar fick Kolfiber/);
 console.log("PASS: user applies tiled carbon-fiber material to all meshes of a model");

 const [file]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 assert.match(file.suggestedFilename(),/\.glb$/);
 const bytes=Array.from(readFileSync(await file.path()));
 const inspected=await page.evaluate(async raw=>{
  const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
  const gltf=await new GLTFLoader().parseAsync(new Uint8Array(raw).buffer,"");
  const details=[];
  gltf.scene.traverse(obj=>{
   if(obj.isMesh)for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])
    details.push({name:mat.name,map:!!mat.map,roughness:mat.roughness,metalness:mat.metalness,
     pixelWidth:mat.map?.image?.width||0,canExport:mat.isMeshStandardMaterial||mat.isMeshPhysicalMaterial});
  });
  return details;
 },bytes);
 assert.ok(inspected.length>=3);
 assert.ok(inspected.every(x=>x.map),"Every kart mesh material retains its procedural color texture after GLB export");
 assert.ok(inspected.some(x=>x.pixelWidth>=128),"Bitmap texture is embedded and loaded by GLTFLoader");
 assert.ok(inspected.every(x=>x.canExport),"Maps survive as standard glTF PBR materials");
 console.log("PASS: procedural PBR bitmap texture survives real GLB export and re-import");

 await page.locator("#undo").click();
 const [undoFile]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 const plain=await page.evaluate(async raw=>{
  const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
  const gltf=await new GLTFLoader().parseAsync(new Uint8Array(raw).buffer,"");
  let total=0,textured=0;gltf.scene.traverse(obj=>{if(obj.isMesh){total++;if(obj.material?.map)textured++}});
  return {total,textured};
 },Array.from(readFileSync(await undoFile.path())));
 assert.equal(plain.textured,0,"Undo restores original flat kart materials");
 console.log("PASS: Undo restores the original untextured model without destructive changes");

 await page.locator("#hierarchy .tree-row").first().click();
 await page.waitForFunction(()=>!document.querySelector("#autoSurface")?.disabled);
 await page.locator("#autoSurface").click();
 await page.waitForFunction(()=>document.querySelector("#surfaceStatus")?.textContent.includes("auto-texturerade"));
 assert.match(await page.locator("#surfaceStatus").textContent(),/Billack|Gummi/);
 console.log("PASS: smart finish safely assigns appropriate tyres and painted vehicle parts");

 // Inspect the actual ephemeral procedural worlds without uploading a private GLB.
 const worlds=await page.evaluate(async()=>{
  const {createEnvironment}=await import("./render-environments.mjs");
  const result=[];
  for(const kind of ["showroom","racetrack","forest","city","night"]){
   const env=createEnvironment({world:kind,quality:"low"});
   let total=0,withMap=0;
   env.group.traverse(obj=>{if(obj.isMesh){total++;if(obj.material?.map)withMap++}});
   result.push({kind,total,withMap});
   env.dispose();
  }
  return result;
 });
 for(const entry of worlds)assert.ok(entry.withMap>=5,entry.kind+" must use procedural textured materials");
 console.log("PASS: all five Render World environments contain actual textured PBR geometry");

 await page.locator("#renderWorld").selectOption("racetrack");
 await page.locator("#openRenderWorld").click();
 await page.waitForFunction(()=>document.body.classList.contains("render-world-active"),{timeout:15000});
 await page.screenshot({path:"material-world-desktop.png"});
 await page.locator("#renderExit").click();
 await page.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 console.log("PASS: materials remain visible in rendered-world preview and editor state returns");

 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>failures.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#materialSwatches [data-surface]")?.getAttribute("aria-pressed")==="true",{timeout:30000});
 await mobile.locator('[data-mobile-tab="material"]').click();
 assert.equal(await mobile.locator("#materialLabPanel").isVisible(),true);
 assert.equal(await mobile.locator("#materialSwatches [data-surface]").count(),17);
 await mobile.screenshot({path:"material-lab-mobile.png",fullPage:true});
 console.log("PASS: Material Lab renders on mobile");

 assert.deepEqual(failures,[],"No unexpected browser errors");
}finally{await browser.close()}
