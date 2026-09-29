#!/usr/bin/env node
// Read-only collection. Duration-derived rounded minutes are estimates, not billing.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const seconds = (a, b) => {
  const n = (Date.parse(b) - Date.parse(a)) / 1000;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const percentile = (values, p) => {
  if (!values.length) return null;
  const s = [...values].sort((a,b) => a-b);
  return s[Math.max(0, Math.ceil(p*s.length)-1)];
};
export function summarize(data) {
  const workflow = new Map(), jobs = new Map(), branches = new Map();
  let duration = 0, rounded = 0, known = 0, unknown = 0, unfinished = 0;
  for (const r of data.runs) {
    const key = `${r.name} / ${r.event}`;
    const w = workflow.get(key) ?? {workflow_event:key, runs:0, job_seconds:0, estimated_rounded_minutes:0, failed_seconds:0, cancelled_seconds:0, successful_feedback_seconds:[]};
    w.runs++;
    const feedback = r.status === 'completed' ? seconds(r.created_at,r.updated_at) : null;
    if (r.conclusion === 'success' && feedback !== null) w.successful_feedback_seconds.push(feedback);
    if (r.event === 'pull_request') branches.set(r.head_branch, (branches.get(r.head_branch) ?? 0)+1);
    for (const j of r.jobs) {
      if (j.conclusion === 'skipped') continue;
      const secs = j.status === 'completed' ? seconds(j.started_at,j.completed_at) : null;
      if (secs === null) { unfinished++; continue; }
      const labels = j.labels ?? [];
      const standard = !labels.includes('self-hosted') && labels.some(l => /^(ubuntu|windows|macos)-(latest|\d+(\.\d+)*)(-(arm|arm64|intel))?$/.test(l));
      const mins = Math.ceil(secs/60);
      duration += secs;
      if (standard) {rounded += mins; known += secs;} else unknown += secs;
      w.job_seconds += secs;
      if (standard) w.estimated_rounded_minutes += mins;
      if (j.conclusion === 'failure' || j.conclusion === 'timed_out') w.failed_seconds += secs;
      if (j.conclusion === 'cancelled') w.cancelled_seconds += secs;
      const jk = `${r.name} / ${j.name}`;
      const group = jobs.get(jk) ?? {job:jk, executions:0, run_ids:new Set(), seconds:0, estimated_rounded_minutes:0};
      group.executions++; group.run_ids.add(r.id); group.seconds += secs;
      if (standard) group.estimated_rounded_minutes += mins;
      jobs.set(jk,group);
    }
    workflow.set(key,w);
  }
  const workflows = [...workflow.values()].map(({successful_feedback_seconds:s,...w}) => ({...w,median_feedback_seconds:percentile(s,.5),p90_feedback_seconds:percentile(s,.9)}));
  const byJob = [...jobs.values()].map(({run_ids:ids,...j}) => ({...j,runs:ids.size,share_of_workflow_runs:ids.size/workflows.filter(w=>w.workflow_event.startsWith(j.job.split(' / ')[0]+' / ')).reduce((n,w)=>n+w.runs,0)}));
  return {repository:data.repository,window:data.window,coverage:data.coverage,run_count:data.runs.length,observed_job_seconds:duration,estimated_standard_runner_rounded_minutes:rounded,estimated_rounding_overhead_minutes:rounded-known/60,unclassified_job_seconds:unknown,unfinished_or_missing_timing_jobs:unfinished,actual_billed_cost:null,monthly_runner_minute_projection:data.days ? rounded*30/data.days : null,projection_note:'Linear duration-based estimate; excludes pricing, allowance, storage and unclassified runners. Feedback uses created_at to updated_at, not an exact required-gate completion time.',workflows:workflows.sort((a,b)=>b.job_seconds-a.job_seconds),jobs:byJob.sort((a,b)=>b.seconds-a.seconds),pr_branch_runs:[...branches].map(([branch,runs])=>({branch,runs}))};
}

function api(endpoint) {
  return JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:60000}));
}
function pages(endpoint, field) {
  const result=[];
  for(let page=1;;page++) {
    const v=api(`${endpoint}${endpoint.includes('?')?'&':'?'}per_page=100&page=${page}`);
    if(field==='workflow_runs' && v.total_count>1000) throw new Error('Run query exceeds GitHub 1,000-result limit. Use a shorter --days window; coverage cannot be claimed complete.');
    if(!Array.isArray(v[field])) throw new Error(`Missing ${field} in API response`);
    result.push(...v[field]);
    if(v[field].length<100) return result;
  }
}
export function main(args=process.argv.slice(2)) {
  const opts={}, positional=[];
  for(let i=0;i<args.length;i++) {
    if(args[i].startsWith('--')) {
      if(!['--days','--out','--input'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--')) throw new Error('Usage: measure.mjs OWNER/REPO --days 14 --out jobs.json | --input jobs.json');
      opts[args[i].slice(2)]=args[++i];
    } else positional.push(args[i]);
  }
  let data;
  if(opts.input) data=JSON.parse(readFileSync(opts.input,'utf8'));
  else {
    const repository=positional[0], days=Number(opts.days??14);
    if(positional.length!==1 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !Number.isInteger(days) || days<1 || days>365) throw new Error('Specify OWNER/REPO and integer --days between 1 and 365');
    const until=new Date(), since=new Date(until.getTime()-days*86400000);
    const runs=pages(`/repos/${repository}/actions/runs?created=${encodeURIComponent(since.toISOString()+'..'+until.toISOString())}`,'workflow_runs');
    const collected=[];
    for(const [i,r] of runs.entries()) {
      const jobs=[];
      for(let attempt=1;attempt<=(r.run_attempt??1);attempt++) {
        for(const j of pages(`/repos/${repository}/actions/runs/${r.id}/attempts/${attempt}/jobs`,'jobs')) jobs.push({...j,collected_attempt:attempt});
      }
      // Attempt endpoints can contain earlier jobs: deduplicate by immutable job id.
      collected.push({...r,jobs:[...new Map(jobs.map(j=>[j.id,j])).values()]});
      if((i+1)%20===0) process.stderr.write(`Collected ${i+1}/${runs.length} runs\n`);
    }
    data={schema_version:1,repository,days,window:{since:since.toISOString(),until:until.toISOString()},coverage:'Complete API pagination and attempts for runs created in this window; usage before/after boundaries may be included, and jobs may still be running.',runs:collected};
    if(opts.out) writeFileSync(opts.out,JSON.stringify(data,null,2)+'\n');
  }
  process.stdout.write(JSON.stringify(summarize(data),null,2)+'\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { main(); } catch(e) { process.stderr.write(`${e.message}\n`); process.exitCode=1; }
}
