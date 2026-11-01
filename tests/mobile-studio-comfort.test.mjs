import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Studio loads Mobile Comfort after all original styles",()=>{
 const html=read("workshop/studio/index.html");
 const old=html.indexOf("mobile-studio.css");
 const materials=html.indexOf("one-click-texturing.css");
 const v2=html.indexOf("mobile-studio-v2.css");
 assert.ok(old>=0&&materials>old&&v2>materials);
 const code=read("workshop/studio/studio.mjs");
 assert.match(code,/initMobileStudioComfort\(\)/);
 assert.match(code,/initStudioMobileUX\(\)/);
});
test("Scene opens unobstructed, all original editor panels remain",()=>{
 const mobile=read("workshop/studio/mobile-studio-ux.mjs");
 assert.match(mobile,/let active="create",open=false;/);
 const css=read("workshop/studio/mobile-studio-v2.css");
 assert.match(css,/render-world-active \.topbar\{display:none!important/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/mobile-header-open/);
 assert.match(css,/body\.mobile-editor-extras-open/);
});
test("Vehicle-test HUD stays compact until user requests details",()=>{
 const js=read("workshop/studio/mobile-studio-comfort.mjs");
 const css=read("workshop/studio/mobile-studio-v2.css");
 assert.match(js,/mobileHudDetailsToggle/);
 assert.match(js,/mobileRenderOptionsToggle/);
 assert.match(js,/mobile-hud-expanded/);
 assert.match(css,/\.render-world-hud\{position:absolute!important/);
 assert.match(css,/body\.mobile-hud-expanded \.render-world-hud/);
 assert.match(css,/#renderMissionDescription,#renderMissionStatus,#renderResetMission,#renderCameraTip\{display:none!important/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/render-world-top>\.render-exit/);
});
test("Mobile buttons reuse real save, play and export actions",()=>{
 const js=read("workshop/studio/mobile-studio-comfort.mjs");
 assert.match(js,/byId\("saveProject"\)\?\.click\(\)/);
 assert.doesNotMatch(js,/indexedDB\.|localStorage\.(setItem|removeItem)/);
 const mobile=read("workshop/studio/mobile-studio-ux.mjs");
 assert.match(mobile,/setDrawerOpen\(false\)/);
});
