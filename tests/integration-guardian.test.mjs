import test from "node:test";
import assert from "node:assert/strict";
import {INTEGRATIONS,auditIntegrations,summarizeAudit} from "../workshop/integration-guardian/core.mjs";

const wiredSource=INTEGRATIONS.map(item=>
  `import {x} from "${item.importPath}";\n${item.bootCall}x);\n`
).join("");
const ok=()=>({ok:true,status:200,text:async()=>wiredSource});

test("guardian confirms a module only when file, import and startup call exist",async()=>{
  const results=await auditIntegrations({baseUrl:"https://example.test/workshop/integration-guardian/guardian.mjs",fetcher:async()=>ok()});
  assert.equal(results.length,INTEGRATIONS.length);
  assert.ok(results.every(item=>item.state==="wired"));
  assert.deepEqual(summarizeAudit(results),{wired:INTEGRATIONS.length,total:INTEGRATIONS.length,issues:0});
});

test("guardian flags missing imports and startup calls separately",async()=>{
  const first=INTEGRATIONS[0];
  const source=`import {x} from "${first.importPath}";\n`;
  const results=await auditIntegrations({
    baseUrl:"https://example.test/workshop/integration-guardian/guardian.mjs",
    fetcher:async url=>String(url).endsWith("/studio.mjs")
      ? {ok:true,status:200,text:async()=>source}
      : ok()
  });
  assert.equal(results[0].state,"startup-missing");
  assert.ok(results.slice(1).every(item=>item.state==="import-missing"));
});

test("guardian reports unavailable module files",async()=>{
  const results=await auditIntegrations({
    baseUrl:"https://example.test/workshop/integration-guardian/guardian.mjs",
    fetcher:async url=>String(url).endsWith("/studio.mjs")
      ? ok()
      : {ok:false,status:404,text:async()=>""}
  });
  assert.ok(results.every(item=>item.state==="module-unavailable"));
});

test("guardian reports when the Studio source cannot be read",async()=>{
  const results=await auditIntegrations({
    baseUrl:"https://example.test/workshop/integration-guardian/guardian.mjs",
    fetcher:async()=>({ok:false,status:503,text:async()=>""})
  });
  assert.ok(results.every(item=>item.state==="app-unavailable"));
});
