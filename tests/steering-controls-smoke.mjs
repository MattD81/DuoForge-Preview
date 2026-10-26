import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
try{
 const page=await browser.newPage({viewport:{width:1450,height:950}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});

 // Create a private-free simulation of the uploaded Vortex geometry directly in
 // browser memory. This fixture is NOT the user's original GLB and is never public.
 const bytes=await page.evaluate(async()=>{
  const THREE=await import("three");
  const {GLTFExporter}=await import("three/addons/exporters/GLTFExporter.js");
  const model=new THREE.Group();model.name="Synthetic Vortex GTR";
  const material=new THREE.MeshStandardMaterial({color:0x25b7a6});
  function baked(name,x,y,z,shape){
   const geometry=new THREE.BoxGeometry(...shape);
   geometry.translate(x,y,z);
   const part=new THREE.Mesh(geometry,material);
   part.name=name;model.add(part);
  }
  baked("Vortex GTR body",0,.9,0,[1.7,.6,4]);
  for(const side of ["Left","Right"])for(const axle of ["Front","Rear"]){
   const x=side==="Left"?-.945:.945,z=axle==="Front"?-1.47:1.4;
   baked(side+" "+axle+" sport tire 305 profile",x,.49,z,[.27,.784,.784]);
   baked(side+" "+axle+" centre locking alloy hub",x,.49,z,[.045,.3,.3]);
   baked(side+" "+axle+" bright yellow performance brake caliper",x,.55,z+.15,[.06,.15,.13]);
  }
  const binary=await new GLTFExporter().parseAsync(model,{binary:true});
  return Array.from(new Uint8Array(binary));
 });
 await page.locator("#importFile").setInputFiles({
  name:"Vortex-GTR-steering-fixture.glb",mimeType:"model/gltf-binary",buffer:Buffer.from(bytes)
 });
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 await page.locator("#makeVehicle").click();
 await page.waitForTimeout(300);
 console.log("DEBUG steering fixture",JSON.stringify(await page.evaluate(()=>({
  detection:document.querySelector("#wheelDetection")?.textContent,
  behavior:document.querySelector("#behaviorType")?.textContent,
  status:document.querySelector("#viewportMessage")?.textContent,
  hierarchy:document.querySelector("#hierarchy")?.textContent?.slice(0,700)
 }))));
 await page.waitForFunction(()=>document.querySelector("#wheelDetection")?.textContent.includes("4 hjulgrupper"),{timeout:3000});
 assert.match(await page.locator("#wheelDetection").textContent(),/Framåt −Z/);
 const measuredWheelbase=Number(await page.locator("#vehiclewheelBase").inputValue());
 assert.ok(Math.abs(measuredWheelbase-2.87)<.01,"Inferred Vortex wheelbase from real-shaped geometry");
 const measuredRadius=Number(await page.locator("#vehiclewheelRadius").inputValue());
 assert.ok(Math.abs(measuredRadius-.392)<.02,"Inferred tyre radius from geometry");
 console.log("PASS: imported -Z Vortex-type GLB gets correct forward direction and measured wheel dimensions");

 // Vortex occupies the same initial space as the starter kart. It must still
 // drive away: the default kart should not trap a newly imported vehicle.
 await page.locator("#playFromPanel").click();
 await page.waitForFunction(()=>document.body.classList.contains("living-play"));
 await page.keyboard.down("w");
 await page.waitForFunction(()=>Number(document.querySelector("#distanceM")?.textContent)>0,{timeout:12000});
 console.log("PASS: imported Vortex can accelerate even when overlapping the starter kart");

 await page.keyboard.down("d");
 await page.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)>1,{timeout:10000});
 console.log("PASS: D/right produces positive driver-relative front-wheel steering");

 await page.keyboard.up("d");
 await page.keyboard.down("a");
 await page.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)<-1,{timeout:10000});
 await page.keyboard.up("a");
 await page.keyboard.up("w");
 console.log("PASS: A/left produces negative driver-relative front-wheel steering");

 // Gamepad API axes should use exactly the same sign convention.
 await page.evaluate(()=>{
  window.__syntheticPad={connected:true,axes:[.92,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};
  Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[window.__syntheticPad]});
 });
 await page.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)>1,{timeout:10000});
 await page.evaluate(()=>{window.__syntheticPad.axes[0]=-.92});
 await page.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)<-1,{timeout:10000});
 await page.evaluate(()=>{window.__syntheticPad.axes[0]=0});
 console.log("PASS: browser gamepad right/left axes agree with keyboard");

 await page.locator("#exitPlay").click();
 await page.waitForFunction(()=>!document.body.classList.contains("living-play"));
 assert.match(await page.locator("#wheelDetection").textContent(),/4 hjulgrupper/);
 console.log("PASS: leave Play mode without losing imported Vortex scene");

 // Touch input on the default starter kart has identical right/left response.
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 await mobile.locator("#togglePlay").click();
 await mobile.waitForFunction(()=>document.body.classList.contains("living-play"));
 await mobile.locator('[data-drive="right"]').dispatchEvent("pointerdown",{pointerId:12,pointerType:"touch",button:0});
 await mobile.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)>1,{timeout:10000});
 await mobile.locator('[data-drive="right"]').dispatchEvent("pointerup",{pointerId:12,pointerType:"touch",button:0});
 await mobile.locator('[data-drive="left"]').dispatchEvent("pointerdown",{pointerId:13,pointerType:"touch",button:0});
 await mobile.waitForFunction(()=>parseFloat(document.querySelector("#steeringDegreesHud")?.textContent)<-1,{timeout:10000});
 await mobile.locator('[data-drive="left"]').dispatchEvent("pointerup",{pointerId:13,pointerType:"touch",button:0});
 console.log("PASS: mobile left/right buttons match steering physics without drive motion");
 assert.deepEqual(errors,[],"No browser JavaScript errors");
}finally{await browser.close()}
