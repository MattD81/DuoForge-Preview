import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"
]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1450,height:930},acceptDownloads:true});
 page.on("pageerror",error=>errors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")errors.push(message.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 await page.locator("#s90Detail").selectOption("performance");
 await page.locator("#s90Paint").selectOption("#244e75");
 await page.locator("#s90Interior").selectOption("black");
 await page.locator("#s90Build").click();
 await page.waitForFunction(()=>document.querySelector("#s90BuildStatus")?.textContent.includes("Skapad:"),{timeout:20000});
 assert.equal(await page.locator("#objectCount").textContent(),"1");
 assert.match(await page.locator("#s90GarageSelected").textContent(),/Volvo S90 Recharge/);
 assert.match(await page.locator("#s90BuildStatus").textContent(),/trianglar/);
 console.log("PASS: complete named Volvo S90 model built in existing 3D Studio");

 const info=await page.evaluate(async()=>{
  const THREE=await import("three");
  const {S90_REFERENCE,createVolvoS90}=await import("./volvo-s90-model.mjs");
  const {inspectWheels,createWheelRig}=await import("./wheel-rig.mjs");
  const car=createVolvoS90({quality:"performance",interior:"black",paint:"#244e75"});
  const box=new THREE.Box3().setFromObject(car),size=box.getSize(new THREE.Vector3());
  const named=[],materials=new Set(),groups=[];
  car.traverse(node=>{
   named.push(node.name);
   if(node.isMesh){materials.add(node.material?.name||"unnamed")}
  });
  const analysis=inspectWheels(car);
  const rig=createWheelRig(car,{forwardSign:-1});
  rig.step({distance:.4,steerAngleDegrees:11,wheelRadius:.365});
  const wheels=rig.wheels.map(w=>({key:w.key,axis:w.axis,steering:w.steer.rotation.y,roll:w.spin.rotation.x}));
  rig.dispose();
  const restored=car.children.every(node=>!node.name.startsWith("Temporary"));
  const more=createVolvoS90({quality:"detailed"});
  let detailed=0,performance=0;
  car.traverse(obj=>{if(obj.isMesh)performance++});
  more.traverse(obj=>{if(obj.isMesh)detailed++});
  return {length:S90_REFERENCE.length,wheelbase:S90_REFERENCE.wheelbase,size:size.toArray(),
   body:car.userData.duoforgeS90,vehicle:car.userData.duoforgeLiving,
   named,materials:[...materials],wheels,restored,performance,detailed,partCount:analysis.partCount};
 });
 assert.equal(info.length,4.969);
 assert.equal(info.wheelbase,2.941);
 assert.equal(info.vehicle.forwardSign,-1);
 assert.ok(info.size[0]>=1.6&&info.size[0]<=2.3,"S90 physical width is realistic");
 assert.ok(info.size[2]>4.6&&info.size[2]<5.6,"S90 length approximates 4.969 metres");
 assert.deepEqual(info.wheels.map(x=>x.key).sort(),["left-front","left-rear","right-front","right-rear"]);
 assert.ok(info.wheels.every(w=>w.axis==="x"));
 assert.ok(info.wheels.filter(w=>w.key.endsWith("front")).every(w=>w.steering<0),"front wheel driver-right steering");
 assert.ok(info.wheels.filter(w=>w.key.endsWith("rear")).every(w=>w.steering===0),"rear wheels do not steer");
 assert.ok(info.wheels.every(w=>w.roll<0),"wheels spin about X with -Z-forward orientation");
 assert.ok(info.named.some(n=>n.includes("Volvo Thor hammer LED")));
 assert.ok(info.named.some(n=>n.includes("Front windscreen")));
 assert.ok(info.named.some(n=>n.includes("seat")));
 assert.ok(info.named.some(n=>n.includes("Charging port")));
 assert.equal(info.restored,true);
 assert.ok(info.detailed>info.performance,"showroom version has extra details");
 console.log("PASS: dimensioned S90 has 4 correct X-axle wheels, cabin, lamps, charging port and detailed LOD");

 const before=await page.locator("#s90BuildStatus").textContent();
 await page.locator("#s90Doors").click();
 assert.match(await page.locator("#s90Doors").textContent(),/Stäng/);
 await page.locator("#s90Doors").click();
 assert.match(await page.locator("#s90Doors").textContent(),/Öppna/);
 await page.locator("#s90Lights").click();
 assert.match(await page.locator("#s90Lights").textContent(),/Tänd/);
 await page.locator("#s90Lights").click();
 assert.match(await page.locator("#s90Lights").textContent(),/Släck/);
 await page.locator("#s90Paint").selectOption("#171c22");
 await page.locator("#s90UpdatePaint").click();
 await page.locator("#s90Interior").selectOption("brown");
 await page.locator("#s90UpdateCabin").click();
 console.log("PASS: S90 doors, LED lights, paint and leather upholstery are editable");

 const [download]=await Promise.all([page.waitForEvent("download",{timeout:30000}),page.locator("#s90Export").click()]);
 assert.match(download.suggestedFilename(),/\.glb$/);
 const bytes=Array.from(readFileSync(await download.path()));
 const reimport=await page.evaluate(async bytes=>{
  const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
  const gltf=await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer,"");
  const found=[],textures=[];
  gltf.scene.traverse(node=>{
   found.push(node.name);
   if(node.isMesh&&node.material?.map)textures.push(node.material.map.image?.width||0);
  });
  return {found:found.length,hasVolvo:found.some(n=>n.includes("Volvo")),
    hasWheel:found.some(n=>n.includes("wheel")),hasCabin:found.some(n=>n.includes("seat")),
    textures:textures.length,byWidth:textures.some(w=>w>=128)};
 },bytes);
 assert.ok(reimport.found>100);
 assert.equal(reimport.hasVolvo,true);
 assert.equal(reimport.hasWheel,true);
 assert.equal(reimport.hasCabin,true);
 assert.ok(reimport.textures>20&&reimport.byWidth,"PBR textures survive real exported GLB");
 console.log("PASS: Volvo GLB includes named parts, interior, wheel meshes and embedded textures");

 await page.locator("#s90World").selectOption("showroom");
 await page.locator("#s90Preview").click();
 await page.waitForFunction(()=>document.body.classList.contains("render-world-active"),{timeout:20000});
 assert.match(await page.locator("#previewAssetName").textContent(),/Volvo S90 Recharge/);
 assert.match(await page.locator("#renderMissionKind").textContent(),/Fordonstest/);
 await page.screenshot({path:"volvo-s90-showroom.png"});
 await page.locator("#renderWorldSelect").selectOption("racetrack");
 await page.locator("#renderCameraSelect").selectOption("follow");
 await page.keyboard.down("w");
 await page.waitForFunction(()=>parseInt(document.querySelector("#renderSpeed")?.textContent||"0",10)>0,{timeout:16000});
 await page.keyboard.up("w");
 await page.screenshot({path:"volvo-s90-track.png"});
 await page.locator("#renderExit").click();
 await page.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 assert.match(await page.locator("#s90GarageSelected").textContent(),/S90/);
 console.log("PASS: S90 opens Showroom and drives in Render World; editor restores afterwards");

 await page.locator("#s90Original").click();
 assert.equal(await page.locator("#s90OriginalDialog").isVisible(),true);
 assert.match(await page.locator("#s90OriginalDialog").textContent(),/Adam Wiese/);
 assert.match(await page.locator("#s90OriginalDialog").textContent(),/CC BY/);
 await page.locator("#s90OriginalDialog button[value=cancel]").last().click();
 console.log("PASS: original high-poly creator and CC BY attribution are clearly surfaced");
 
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#s90Build")?.textContent.includes("Skapa"),{timeout:30000});
 await mobile.locator("#s90Detail").selectOption("performance");
 await mobile.locator("#s90Build").click();
 await mobile.waitForFunction(()=>document.querySelector("#s90BuildStatus")?.textContent.includes("Skapad:"),{timeout:20000});
 await mobile.screenshot({path:"volvo-s90-mobile.png",fullPage:true});
 console.log("PASS: S90 procedural 3D model is built on mobile as well");
 assert.deepEqual(errors,[],"No browser runtime errors");
}finally{await browser.close()}
