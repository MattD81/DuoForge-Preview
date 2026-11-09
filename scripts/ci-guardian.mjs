import {writeFile, appendFile} from 'node:fs/promises';
import {diagnoseFailure, isLatestFailedRun, renderSummary} from './ci-guardian-core.mjs';
const repo=process.env.GITHUB_REPOSITORY;
const id=Number(process.env.DUOFORGE_FAILED_RUN_ID);
const token=process.env.GITHUB_TOKEN;
if(!/^[\w.-]+\/[\w.-]+$/.test(repo||'') || !Number.isSafeInteger(id) || id<1 || !token)
  throw Error('Missing repository, workflow run ID or GitHub token.');
const endpoint='https://api.github.com/repos/'+repo;
const headers={Authorization:'Bearer '+token, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
async function api(path,plain=false){
  const res=await fetch(endpoint+path,{headers,signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('GitHub API '+res.status+' for '+path.split('?')[0]);
  return plain?res.text():res.json();
}
const run=await api('/actions/runs/'+id);
if(run.repository?.full_name!==repo)throw Error('Repository mismatch');
let sha=null;
try{
  const branch=await api('/branches/'+encodeURIComponent(run.head_branch));
  sha=branch.commit?.sha||null;
}catch(e){console.log('Branch unavailable; skipping obsolete failure: '+e.message);}
const current=isLatestFailedRun(run,sha);
const diagnostics=[];
if(current){
  const data=await api('/actions/runs/'+id+'/jobs?per_page=100');
  for(const job of (data.jobs||[]).filter(x=>x.conclusion==='failure').slice(0,10)){
    const step=(job.steps||[]).find(x=>x.conclusion==='failure')?.name||'unknown';
    let log='';
    try{log=await api('/actions/jobs/'+job.id+'/logs',true);}
    catch(e){console.log('Job '+job.id+' logs unavailable: '+e.message);}
    diagnostics.push({job:job.name,step,diagnosis:diagnoseFailure(log,step)});
  }
}
const summary=renderSummary(run,diagnostics,current);
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
await writeFile('ci-guardian-report.json',JSON.stringify({
  schema:'duoforge-ci-guardian@1',run_id:run.id,run_url:run.html_url,
  branch:run.head_branch,sha:run.head_sha,
  state:current?'current':'superseded',diagnostics
},null,2)+'\n');