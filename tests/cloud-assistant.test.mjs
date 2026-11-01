import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {AI_MODELS,AI_ENDPOINT,validateProposalInput,getCloudStatus,requestCloudProposal} from "../game-builder/cloud-assistant.mjs";

test("models are explicit, safe and free-local by default",()=>{
  assert.equal(AI_MODELS[0].id,"local");
  assert.deepEqual(AI_MODELS.slice(1).map(m=>m.id),["llama-fast","glm-flash"]);
  assert.equal(AI_ENDPOINT.proposal,"/api/duoforge/ai/proposal");
  assert.throws(()=>validateProposalInput({prompt:"x",model:"llama-fast",projectId:"p",revision:1}));
  assert.throws(()=>validateProposalInput({prompt:"Bygg ett spel",model:"paid",projectId:"p",revision:1}));
  assert.deepEqual(validateProposalInput({prompt:" Bygg en skog ",model:"glm-flash",projectId:"duoforge-1",revision:3}),
    {prompt:"Bygg en skog",model:"glm-flash",projectId:"duoforge-1",revision:3});
});
test("offline GitHub Pages stays local, never posts AI requests",async()=>{
  let calls=0;
  const status=await getCloudStatus({fetchImpl:async(url,opts)=>{calls++;assert.equal(url,AI_ENDPOINT.status);
    assert.equal(opts.credentials,"same-origin");return new Response("<html>404</html>",{status:404});}});
  assert.equal(calls,1);
  assert.equal(status.connected,false);
  assert.equal(status.models.length,0);
});
test("only acknowledged connected models may be selected",async()=>{
  const data=await getCloudStatus({fetchImpl:async()=>Response.json({
    connected:true,models:[{id:"glm-flash"},{id:"paid-model"},{id:"llama-fast"}],
    quota:{total:0,globalLimit:16}
  })});
  assert.equal(data.connected,true);
  assert.deepEqual(data.models,["glm-flash","llama-fast"]);
});
test("proposal requests go to same-origin backend, never Cloudflare direct or with secrets",async()=>{
  let calls=0;
  const proposal=await requestCloudProposal({
    prompt:"Bygg en spelvärld med hav",model:"glm-flash",projectId:"duoforge-abc",revision:7
  },{fetchImpl:async(url,opts)=>{
    calls++;assert.equal(url,AI_ENDPOINT.proposal);
    assert.equal(opts.credentials,"same-origin");
    assert.equal(opts.method,"POST");
    assert.equal(opts.headers.authorization,undefined);
    assert.deepEqual(JSON.parse(opts.body),{
      prompt:"Bygg en spelvärld med hav",model:"glm-flash",projectId:"duoforge-abc",revision:7
    });
    return Response.json({ok:true,requiresApproval:true,proposal:"Ändra befintlig spelkod i en PR.",proposalId:"a-new-id",source:"workers-ai"});
  }});
  assert.equal(calls,1);
  assert.equal(proposal.proposalId,"a-new-id");
  assert.match(proposal.proposal,/PR/);
});
test("unapproved proposals and unstructured HTML errors are rejected",async()=>{
  await assert.rejects(requestCloudProposal({prompt:"Bygg en värld",model:"glm-flash",projectId:"p",revision:1},
    {fetchImpl:async()=>Response.json({ok:true,proposal:"unsafe",proposalId:"1",requiresApproval:false})}),/granskningsbart/);
  await assert.rejects(requestCloudProposal({prompt:"Bygg en värld",model:"glm-flash",projectId:"p",revision:1},
    {fetchImpl:async()=>new Response("<html>not JSON</html>",{status:200,headers:{"content-type":"text/html"}})}),/JSON/);
});
test("existing Game Builder flow remains preserved with an additive UI",async()=>{
  const html=await readFile(new URL("../game-builder/index.html",import.meta.url),"utf8");
  const builder=await readFile(new URL("../game-builder/builder.mjs",import.meta.url),"utf8");
  const css=await readFile(new URL("../game-builder/cloud-assistant.css",import.meta.url),"utf8");
  assert.match(html,/id="build"/);assert.match(html,/id="export"/);
  assert.match(html,/cloud-assistant\.css/);
  assert.match(builder,/mountCloudAssistant/);
  assert.match(builder,/function updateFromPrompt/);
  assert.match(css,/@media\(max-width:600px\)/);
});
