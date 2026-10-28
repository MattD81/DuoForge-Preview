import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]});
const errors=[];
const watch=page=>{
 page.on("pageerror",e=>errors.push("pageerror: "+e.message));
 page.on("requestfailed",req=>errors.push("requestfailed: "+req.url()+" "+req.failure()?.errorText));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
};
try{
 const page=await browser.newPage({viewport:{width:1152,height:720},deviceScaleFactor:1,acceptDownloads:true});
 watch(page);
 await page.goto("http://127.0.0.1:8080/games/last-light/",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 if(!(await page.locator("#boot").evaluate(el=>el.hidden))){
  const note=await page.locator("#bootMessage").textContent();
  console.log("BOOT STATE",note,"ERRORS",errors.slice(0,15));
 }
 await page.waitForFunction(()=>document.getElementById("boot")?.hidden===true,{timeout:13000});
 assert.equal(await page.locator("#intro").isVisible(),true);
 assert.equal(await page.locator("#scene").isVisible(),true);
 assert.match(await page.locator(".performance").textContent(),/WebGL/);
 assert.match(await page.locator("#raytrace").getAttribute("href"),/raytrace\.html$/,"Optional real WebGPU renderer is linked");
 const pbr=await page.evaluate(async()=>{
   const {createRescueShip}=await import("./ship.mjs");
   const {materialLab,materialManifest}=await import("./pbr-materials.mjs");
   const ship=createRescueShip();
   const surfaces=[];
   ship.group.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.userData?.source==="DuoForge Material Lab V3")
    surfaces.push({name:mesh.material.name,map:!!mesh.material.map,normal:!!mesh.material.normalMap,
     orm:!!mesh.material.roughnessMap,physical:mesh.material.isMeshPhysicalMaterial,
     pixel:mesh.material.roughnessMap?.image?.width})});
   return {surfaces:surfaces.slice(0,5),count:surfaces.length,
    manifest:materialManifest(),deck:materialLab("teak").userData.spec.roughness};
 });
 assert.ok(pbr.count>25,"Ship uses new real physically based materials throughout");
 assert.ok(pbr.surfaces.every(s=>s.map&&s.normal&&s.orm&&s.physical&&s.pixel>=64));
 assert.ok(Object.keys(pbr.manifest).length>=9);
 assert.ok(pbr.deck>.7&&pbr.deck<1);

 assert.equal(await page.locator("#game").getAttribute("data-islands"),"8","Eight real 3D terrain islands are generated");
 assert.ok(Number(await page.locator("#game").getAttribute("data-forest"))>=180,"Organic forests are instanced");
 assert.ok(Number(await page.locator("#game").getAttribute("data-granite"))>=100,"Granite rocks are instanced");
 assert.equal(await page.locator("#game").getAttribute("data-terrain-quality"),"low","Headless software GPU uses low-power terrain LOD");
 assert.match(await page.locator("#quality").textContent(),/MOBIL/);
 const geometry=await page.evaluate(async()=>{
  const {ISLAND_SITES}=await import("./coastal-terrain.mjs");
  const {buildIslandGeometry}=await import("./coastal-world.mjs");
  const geo=buildIslandGeometry(ISLAND_SITES[0],"high");
  const sample={
   vertices:geo.attributes.position.count,
   colorEntries:geo.attributes.color.count,
   triangles:geo.index.count/3,
   normals:geo.attributes.normal.count,
   bound:Number.isFinite(geo.boundingSphere.radius)
  };
  geo.dispose();
  return sample;
 });
 assert.ok(geometry.vertices>1000&&geometry.triangles>1800&&geometry.bound);
 assert.equal(geometry.colorEntries,geometry.vertices);
 assert.equal(geometry.normals,geometry.vertices);
 await page.screenshot({path:"last-light-intro-desktop.png"});
 await page.locator("#start").click();
 assert.equal(await page.locator("#intro").isVisible(),false);
 await page.keyboard.down("w");
 // Observe speed while W is held: releasing before checking lets the ship coast to 0.
 await page.waitForFunction(()=>Number(document.querySelector("#speed")?.textContent)>0,{timeout:20000});
 console.log("FRAME STATE",await page.evaluate(()=>({speed:document.querySelector("#speed")?.textContent,fps:document.querySelector("#fps")?.textContent})),errors.slice(0,10));
 await page.keyboard.up("w");
 await page.locator("#auto").click();
 assert.match(await page.locator("#auto").textContent(),/PÅ/);
 await page.locator("#weather").click();
 assert.match(await page.locator("#weather").textContent(),/STORM/);
 await page.locator("#view").click();
 assert.match(await page.locator("#view").textContent(),/DÄCK/);
 await page.locator("#view").click();
 assert.match(await page.locator("#view").textContent(),/FILM/);
 const [ship]=await Promise.all([
  page.waitForEvent("download",{timeout:20000}),page.locator("#exportShip").click()
 ]);
 assert.match(ship.suggestedFilename(),/\.glb$/);
 assert.ok(await ship.path());
 await page.screenshot({path:"last-light-storm-desktop.png"});
 // The WebGPU still-image path is optional. Headless WebGL-only runners must
 // receive an honest no-WebGPU explanation, not a fabricated raytraced image.
 const probe=await browser.newPage({viewport:{width:760,height:610},deviceScaleFactor:1});
 await probe.goto("http://127.0.0.1:8080/games/last-light/raytrace.html",{waitUntil:"domcontentloaded"});
 assert.equal(await probe.locator("#photo").isVisible(),true);
 assert.equal(await probe.locator("#render").isVisible(),true);
 const hasGPU=await probe.evaluate(()=>!!navigator.gpu);
 if(!hasGPU){
  await probe.waitForFunction(()=>document.querySelector("#fallback")?.classList.contains("visible"),{timeout:10000});
  assert.match(await probe.locator("#fallbackText").textContent(),/WebGPU/);
 }
 await probe.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 watch(mobile);
 await mobile.goto("http://127.0.0.1:8080/games/last-light/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.getElementById("boot")?.hidden===true,{timeout:45000});
 await mobile.locator("#start").click();
 assert.equal(await mobile.locator("#controls").isVisible(),true);
 assert.equal(await mobile.locator("#gas").isVisible(),true);
 await mobile.locator("#gas").dispatchEvent("pointerdown",{pointerId:3});
 await mobile.waitForTimeout(500);
 await mobile.locator("#gas").dispatchEvent("pointerup",{pointerId:3});
 await mobile.locator("#view").click();
 await mobile.screenshot({path:"last-light-mobile.png"});
 assert.equal(await mobile.locator("#scene").isVisible(),true);
 assert.equal(await mobile.locator("#game").getAttribute("data-islands"),"8");
 assert.equal(await mobile.locator("#game").getAttribute("data-terrain-quality"),"low");
 assert.ok(await mobile.locator("#quality").isVisible());
 assert.deepEqual(errors,[],"Desktop and mobile should not have runtime or WebGL shader errors");
 console.log("PASS: original 3D ocean/atmosphere scene, mobile controls, real GLB export and cinematic camera");
}finally{await browser.close()}
