import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { RuvectorIndex, backend } from './index.mjs';
const dimensions=64,count=1000,k=10,queries=100;
let seed=481516;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const normalized=()=>{const v=Array.from({length:dimensions},()=>random()*2-1);const norm=Math.hypot(...v);return v.map(x=>x/norm);};
const vectors=Array.from({length:count},normalized), probes=Array.from({length:queries},normalized);
const db=new RuvectorIndex({dimensions,maxElements:count});const t0=performance.now();
for(let i=0;i<count;i++)await db.add({id:String(i),vector:vectors[i]});const insertMs=performance.now()-t0;
const timings=[];let hits=0,oracleMs=0;
for(const probe of probes){let t=performance.now();const result=await db.search(probe,k);timings.push(performance.now()-t);t=performance.now();const exact=vectors.map((v,i)=>({id:String(i),distance:1-v.reduce((s,x,j)=>s+x*probe[j],0)})).sort((a,b)=>a.distance-b.distance).slice(0,k);oracleMs+=performance.now()-t;const ids=new Set(exact.map(x=>x.id));hits+=result.filter(x=>ids.has(x.id)).length;}
timings.sort((a,b)=>a-b);const report={timestamp:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,backend,dimensions,count,queries,k,seed:481516,recallAtK:hits/(queries*k),insertMs,insertPerSecond:count/(insertMs/1000),searchMs:{p50:timings[49],p95:timings[94],total:timings.reduce((a,b)=>a+b,0)},exactOracleMs:oracleMs,scope:'Local synthetic normalized random vectors; native HNSW, no network, no semantic quality claim'};writeFileSync(new URL('./benchmark-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await db.close();
if(report.recallAtK<0.8)process.exitCode=1;
