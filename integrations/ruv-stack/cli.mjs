import { CollaborationHub } from './hub.mjs';
import { FederationClient } from '../ruflo-x/client.mjs';
import { AgentBbsClient } from '../agentbbs/client.mjs';
// Local configuration only. Federation content cannot select executables or paths.
const config=JSON.parse(process.env.QUDAG_STACK_CONFIG||'{}');
const hub=new CollaborationHub({path:config.ledger,allowedPubkeys:config.allowedPubkeys||[],gateway:new FederationClient(),agentbbs:config.agentbbs?new AgentBbsClient({...config.agentbbs,allowPosts:false}):undefined});

const actions={
  qudag_federation_sync:args=>hub.syncGateway(args),
  qudag_board_read:({board,limit})=>hub.readBoard(board,limit),
  qudag_memory_search:({query,k})=>hub.search(query,k),
  qudag_signed_event_ingest:({event})=>hub.ingestSignedEvent(event),
  qudag_bridge_draft:({id,board})=>hub.draft(id,board),
  qudag_status:()=>hub.stats(),
};
const schemas={
  qudag_federation_sync:{limit:{type:'integer',minimum:1,maximum:100},sinceSeconds:{type:'integer',minimum:0,maximum:86400}},
  qudag_board_read:{board:{type:'string'},limit:{type:'integer',minimum:1,maximum:100}},
  qudag_memory_search:{query:{type:'string',maxLength:8192},k:{type:'integer',minimum:1,maximum:100}},
  qudag_signed_event_ingest:{event:{type:'object'}},
  qudag_bridge_draft:{id:{type:'string'},board:{type:'string'}},qudag_status:{},
};
const required={qudag_board_read:['board'],qudag_memory_search:['query'],qudag_signed_event_ingest:['event'],qudag_bridge_draft:['id','board']};
let ready=false;
const respond=message=>new Promise((resolve,reject)=>process.stdout.write(JSON.stringify(message)+'\n',error=>error?reject(error):resolve()));
async function handle(line){
  let m;
  try{
    m=JSON.parse(line);if(m.jsonrpc!=='2.0'||typeof m.method!=='string')throw Error('Invalid envelope');
    if(m.method==='notifications/initialized')return;
    if(!Object.hasOwn(m,'id'))throw Error('Request id required');
    let result;
    if(m.method==='initialize'){
      if(!['2024-11-05','2025-03-26'].includes(m.params?.protocolVersion))throw Error('Unsupported protocol');
      ready=true;result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'qudag-ruv-stack',version:'2.0.0'}};
    }else{
      if(!ready)throw Error('Initialize first');
      if(m.method==='tools/list')result={tools:Object.keys(actions).map(name=>({name,description:'Local federation observation workflow. No execution or publication.',inputSchema:{type:'object',properties:schemas[name],required:required[name]||[],additionalProperties:false}}))};
      else if(m.method==='tools/call'){
        const name=m.params?.name,args=m.params?.arguments||{};
        if(!Object.hasOwn(actions,name)||!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).some(k=>!Object.hasOwn(schemas[name],k))||(required[name]||[]).some(k=>!Object.hasOwn(args,k)))throw Error('Invalid tool arguments');
        result={content:[{type:'text',text:JSON.stringify(await actions[name](args))}]};
      }else throw Error('Unknown method');
    }
    await respond({jsonrpc:'2.0',id:m.id,result});
  }catch{await respond({jsonrpc:'2.0',id:m?.id??null,error:{code:-32602,message:'Request rejected'}});}
}
// Process sequentially, with bounded frames and stream backpressure.
let pending=Buffer.alloc(0);
try{for await(const chunk of process.stdin){
  pending=Buffer.concat([pending,chunk]);
  for(;;){const pos=pending.indexOf(10);if(pos<0)break;if(pos>65536)throw Error('Frame limit');const line=pending.subarray(0,pos).toString('utf8');pending=pending.subarray(pos+1);await handle(line);}
  if(pending.length>65536)throw Error('Frame limit');
}}finally{await hub.close();}
