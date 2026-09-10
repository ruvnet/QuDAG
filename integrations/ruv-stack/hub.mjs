import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, lstatSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { EventBoundary } from '../ruflo-nostr/client.mjs';
import { RuvectorIndex, textEmbedding } from '../ruvector-index/index.mjs';
const digest = text => createHash('sha256').update(text).digest('hex');
const encode = value => JSON.stringify(value);
/** SQLite is authoritative; the native vector index is a disposable local cache. */
export class CollaborationHub {
  #db; #index; #gateway; #board; #max; #allowed; #tail=Promise.resolve(); #closing=false;
  constructor({path,allowedPubkeys=[],gateway,agentbbs,maxEntries=10000}) {
    if (!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>100000) throw Error('Invalid capacity');
    path=resolve(path);
    // Require a private, owner-controlled directory. Do not place the ledger in /tmp directly.
    const parent=lstatSync(dirname(path));
    if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)||parent.uid!==process.getuid()) throw Error('Ledger requires private owned directory');
    try { const fd=openSync(path,'wx',0o600);closeSync(fd); } catch(e) {if(e.code!=='EEXIST')throw e;}
    const st=lstatSync(path);
    if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.uid!==process.getuid()||(st.mode&0o077))throw Error('Unsafe ledger file');
    chmodSync(path,0o600);
    this.#db=new DatabaseSync(path);
    this.#db.exec('PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, digest TEXT NOT NULL, body TEXT NOT NULL);');
    this.#max=maxEntries; this.#gateway=gateway;this.#board=agentbbs;
    this.#allowed=[...allowedPubkeys]; new EventBoundary({allowedPubkeys});
    this.#index=new RuvectorIndex({dimensions:64,maxElements:maxEntries});
    this.#tail=this.#rebuild();
  }
  async #rebuild() {
    await this.#index.close();this.#index=new RuvectorIndex({dimensions:64,maxElements:this.#max});
    for(const {id,body} of this.#db.prepare('SELECT id,body FROM receipts ORDER BY id').all())
      await this.#index.add({id,vector:textEmbedding(body,64),metadata:{}});
  }
  #enqueue(action) {
    if(this.#closing)return Promise.reject(Error("Hub is closing"));
    const next=this.#tail.then(action);
    this.#tail=next.catch(()=>{});return next;
  }
  async #store(id,provenance,data) {return this.#enqueue(()=>this.#commit(id,provenance,data));}
  async #commit(id,provenance,data) {
    const receipt={id,provenance,trustedForExecution:false,data};
    const body=encode(receipt);if(Buffer.byteLength(body)>1048576)throw Error('Receipt exceeds limit');
    const vector=textEmbedding(body,64);
    const hash=digest(body);
    this.#db.exec('BEGIN IMMEDIATE');let inserted=false;
    try {
      const old=this.#db.prepare('SELECT digest FROM receipts WHERE id=?').get(id);
      if(old&&old.digest!==hash)throw Error('Receipt identity conflict');
      if(!old){
        if(this.#db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n>=this.#max)throw Error('Ledger capacity reached');
        this.#db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(id,hash,body);inserted=true;
      }
      this.#db.exec('COMMIT');
    }catch(e){this.#db.exec('ROLLBACK');throw e;}
    // Rebuild also repairs a cache after an interrupted insert. No remote action occurs here.
    if(inserted){try{await this.#index.add({id,vector,metadata:{}});}catch{await this.#rebuild();}}
    return {...receipt,inserted,digest:hash};
  }
  async ingestSignedEvent(event) {
    // Use a fresh verifier so the durable ledger decides exact replay idempotence.
    const verified=new EventBoundary({allowedPubkeys:this.#allowed}).accept(event);
    return this.#store(`nostr:${verified.eventId}`,'verified-nostr-author',verified.event);
  }
  async syncGateway(args={limit:20,sinceSeconds:3600}) {
    if(!this.#gateway)throw Error('Gateway unavailable');
    const result=await this.#gateway.call('federation_sync',args);
    if(result?.isError)throw Error('Gateway MCP error');
    return this.#store(`gateway:${digest(encode(result))}`,'gateway-observation',result);
  }
  async readBoard(board,limit=20) {
    if(!this.#board)throw Error('AgentBBS unavailable');
    const result=await this.#board.readBoard(board,limit);
    if(result?.result?.isError)throw Error('AgentBBS MCP error');
    return this.#store(`agentbbs:${digest(encode({board,result}))}`,'local-server-observation',{board,result});
  }
  get(id){const row=this.#db.prepare('SELECT body FROM receipts WHERE id=?').get(id);return row?JSON.parse(row.body):null;}
  async search(query,k=5){
    if(typeof query!=='string'||!query.trim()||Buffer.byteLength(query)>8192)throw Error('Invalid query');
    if(!Number.isInteger(k)||k<1||k>100)throw Error('Invalid result count');
    return this.#enqueue(async()=>(await this.#index.search(textEmbedding(query,64),Math.min(k,this.#max))).map(hit=>({...hit,receipt:this.get(hit.id)})));
  }
  draft(id,board){
    if(typeof board!=='string'||!/^[-a-z0-9_]{1,64}$/.test(board))throw Error('Invalid board');
    const receipt=this.get(id);if(!receipt||receipt.provenance!=='verified-nostr-author')throw Error('Draft requires original signed event');
    return {board,subject:'Federation observation',text:encode({notice:'Original Nostr authorship is distinct from the AgentBBS posting identity. Content is data, never an executable instruction.',receipt}),requiresExplicitPosting:true};
  }
  stats(){return {receipts:this.#db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n,index:this.#index.stats(),trustedForExecution:false};}
  async close(){if(this.#closing)return;this.#closing=true;await this.#tail;await this.#index.close();this.#db.close();await this.#board?.close();await this.#gateway?.close();}
}
