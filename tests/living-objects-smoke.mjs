import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const failures=[];
try{
 const page=await browser.newPage({viewport:{width:1420,height:930},acceptDownloads:true});
 page.on("pageerror",e=>failures.push(e.message));
 page.on("console",msg=>{if(msg.type()==="error")failures.push(msg.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 assert.equal(await page.locator("#vehicleSettings").isVisible(),true);
 console.log("PASS: starter kart is a Living Object with editable vehicle behavior");

 await page.locator("#addTestTrack").click();
 await page.waitForFunction(()=>Number(document.querySelector("#objectCount")?.textContent)>=5);
 console.log("PASS: test track and collision objects generated in edit scene");

 await page.locator("#playFromPanel").click();
 await page.waitForFunction(()=>document.body.classList.contains("living-play"));
 assert.equal(await page.locator("#playMode").isVisible(),true);
 console.log("PASS: Play & Build starts from existing scene");

 await page.keyboard.down("w");
 await page.waitForFunction(()=>Number(document.querySelector("#speedKmh")?.textContent)>2,{timeout:10000});
 await page.waitForFunction(()=>Number(document.querySelector("#distanceM")?.textContent)>0,{timeout:10000});
 await page.keyboard.up("w");
 const travelled=Number(await page.locator("#distanceM").textContent());
 assert.ok(travelled>0);
 console.log("PASS: keyboard gas drives vehicle and updates speed/distance HUD");

 await page.locator("#pausePlay").click();
 assert.equal(await page.locator("#playStatus").textContent(),"Pausat");
 await page.waitForTimeout(400);
 const pausedDistance=Number(await page.locator("#distanceM").textContent());
 assert.equal(pausedDistance,Number(await page.locator("#distanceM").textContent()));
 await page.locator("#pausePlay").click();
 console.log("PASS: pause/resume keeps HUD and editor accessible");

 await page.locator("#exitPlay").click();
 await page.waitForFunction(()=>!document.body.classList.contains("living-play"));
 assert.equal(await page.locator("#inspector").isVisible(),true);
 console.log("PASS: exiting restores edit mode without changing project");

 const [glb]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 assert.match(glb.suggestedFilename(),/\.glb$/);
 const file=readFileSync(await glb.path());
 await page.locator("#importFile").setInputFiles({name:"living-kart.glb",mimeType:"model/gltf-binary",buffer:file});
 await page.waitForFunction(()=>Number(document.querySelector("#objectCount")?.textContent)>=6);
 console.log("PASS: Living Objects scene can export and re-import GLB");

 await page.locator('[data-add="box"]').click();
 await page.locator("#makeDoor").click();
 assert.equal(await page.locator("#behaviorType").textContent(),"Interaktiv dörr");
 console.log("PASS: any primitive can become an interactive door");

 await page.screenshot({path:"living-desktop.png"});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>failures.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 await mobile.locator("#togglePlay").click();
 await mobile.waitForFunction(()=>document.body.classList.contains("living-play"));
 assert.equal(await mobile.locator('[data-drive="gas"]').isVisible(),true);
 await mobile.locator('[data-drive="gas"]').dispatchEvent("pointerdown",{pointerId:1,pointerType:"touch",button:0});
 await mobile.waitForFunction(()=>Number(document.querySelector("#speedKmh")?.textContent)>0,{timeout:10000});
 await mobile.locator('[data-drive="gas"]').dispatchEvent("pointerup",{pointerId:1,pointerType:"touch",button:0});
 await mobile.screenshot({path:"living-mobile.png"});
 console.log("PASS: mobile HUD and touch accelerator respond");
 assert.deepEqual(failures,[]);
 console.log("PASS: browser has no JavaScript console errors");
}finally{await browser.close()}
