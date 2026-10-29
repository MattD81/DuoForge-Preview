import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdtempSync,rmSync} from "node:fs";
import {spawn,execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:880},acceptDownloads:true});
 page.on("pageerror",e=>errors.push("desktop: "+e.message));
 await page.goto("http://127.0.0.1:8080/game-builder/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.__duoforgeBuilder?.active,{timeout:35000});
 const first=await page.evaluate(()=>window.__duoforgeBuilder.config);
 assert.equal(first.world,"forest");assert.equal(first.revision,1);
 assert.ok(await page.locator("#viewport canvas").count()>0);
 await page.screenshot({path:"game-builder-desktop.png"});
 await page.locator("#prompt").fill("Skapa ett vikingaäventyr på ett stormigt hav med fyra banor, tre monster och fem kristaller.");
 await page.locator("#build").click();
 await page.waitForFunction(()=>window.__duoforgeBuilder.config.world==="ocean");
 const ocean=await page.evaluate(()=>window.__duoforgeBuilder.config);
 assert.equal(ocean.id,first.id);
 assert.equal(ocean.revision,2);
 assert.equal(ocean.weather,"storm");assert.equal(ocean.levels,4);
 assert.equal(ocean.enemies,3);assert.equal(ocean.collectibles,5);
 assert.ok(await page.locator("#viewport canvas").count()>0);
 await page.locator("#prompt").fill("Gör fem banor och fler fiender");
 await page.locator("#build").click();
 await page.waitForFunction(()=>window.__duoforgeBuilder.config.revision===3);
 const modified=await page.evaluate(()=>window.__duoforgeBuilder.config);
 assert.equal(modified.levels,5);assert.equal(modified.enemies,5);assert.equal(modified.world,"ocean");
 await page.locator("#undo").click();
 const reverted=await page.evaluate(()=>window.__duoforgeBuilder.config);
 assert.equal(reverted.levels,4);assert.equal(reverted.enemies,3);
 assert.equal(reverted.id,first.id);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.__duoforgeBuilder?.active,{timeout:35000});
 assert.equal((await page.evaluate(()=>window.__duoforgeBuilder.config)).world,"ocean");
 const downloadPromise=page.waitForEvent("download",{timeout:30000});
 await page.locator("#export").click();
 const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/\.zip$/);
 const path=await download.path();
 const listing=execFileSync("unzip",["-l",path],{encoding:"utf8"});
 for(const file of ["index.html","project.json","package.json","games/game-builder/runtime.mjs",
  "games/game-builder/planner.mjs","workshop/studio/gpu-deluxe.mjs",
  "workshop/studio/ocean-water.mjs","workshop/studio/ocean-spectrum.mjs",
  "workshop/studio/atmosphere-scattering.mjs"]){
  assert.ok(listing.includes(file),"Export ZIP missing "+file);
 }
 const project=JSON.parse(execFileSync("unzip",["-p",path,"project.json"],{encoding:"utf8"}));
 assert.equal(project.id,first.id);assert.equal(project.world,"ocean");
 const runtime=execFileSync("unzip",["-p",path,"games/game-builder/runtime.mjs"],{encoding:"utf8"});
 assert.match(runtime,/from "\.\.\/\.\.\/workshop\/studio\/ocean-water\.mjs"/);
 // Verify the exported archive is a *playable independent website*, not
 // a redirect or merely a project settings file.
 const standaloneDir=mkdtempSync(join(tmpdir(),"duoforge-game-export-"));
 execFileSync("unzip",["-q",path,"-d",standaloneDir]);
 const server=spawn("python3",["-m","http.server","8081","--bind","127.0.0.1","--directory",standaloneDir],
  {stdio:"ignore"});
 try{
  const standalone=await browser.newPage({viewport:{width:950,height:740}});
  standalone.on("pageerror",e=>errors.push("exported game: "+e.message));
  let loaded=false;
  for(let i=0;i<12;i++){
   try{await standalone.goto("http://127.0.0.1:8081/",{waitUntil:"domcontentloaded",timeout:4000});loaded=true;break;}
   catch{await new Promise(resolve=>setTimeout(resolve,300));}
  }
  assert.ok(loaded,"Standalone ZIP server did not start");
  await standalone.waitForFunction(()=>!!document.querySelector("#playArea canvas"),{timeout:25000});
  assert.equal(await standalone.locator("#error").textContent(),"");
  assert.equal(await standalone.locator("[data-action=attack]").isVisible(),true);
  assert.match(await standalone.locator("#status").textContent(),/BANA/);
  await standalone.locator("#restart").click();
  assert.equal(await standalone.locator("#playArea canvas").count(),1);
  await standalone.close();
 }finally{server.kill();rmSync(standaloneDir,{force:true,recursive:true});}
 console.log("PASS desktop: genuine playable WebGL, incremental changes, undo, persistence and independently runnable ZIP");
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 mobile.on("pageerror",e=>errors.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/game-builder/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>window.__duoforgeBuilder?.active,{timeout:35000});
 const total=await mobile.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(total<=392,"Mobile horizontal scrolling: "+total);
 assert.equal(await mobile.locator("#viewport canvas").count(),1);
 assert.equal(await mobile.locator('[data-action="attack"]').isVisible(),true);
 const button=await mobile.locator('[data-move="right"]').boundingBox();
 assert.ok(button&&button.x>=0&&button.x+button.width<=392,"Touch input clipped on 390px iPhone");
 await mobile.screenshot({path:"game-builder-mobile.png"});
 console.log("PASS mobile: 3D WebGL, portrait responsive, visible controls");
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
