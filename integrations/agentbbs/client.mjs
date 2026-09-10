import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
const PROTOCOL = '2024-11-05';
function object(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(k => !keys.includes(k))) throw new TypeError('Unexpected arguments');
}
function integer(n, low, high) { if (!Number.isInteger(n) || n < low || n > high) throw new TypeError('Invalid integer'); return n; }
function string(s, max) { if (typeof s !== 'string' || !s.length || Buffer.byteLength(s) > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) throw new TypeError('Invalid text'); return s; }
function board(s) { if (typeof s !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(s)) throw new TypeError('Invalid board'); return s; }
/** Trusted local executable only. Remote message text is never executable. */
export class AgentBbsClient {
  #config; #child; #pending = new Map(); #id = 0; #buffer = Buffer.alloc(0); #closed = false; #ready; #calls = 0; #queuedBytes = 0;
  constructor(options) {
    object(options, ['command','args','cwd','timeoutMs','maxBytes','allowPosts']);
    const {command,args = [],cwd,timeoutMs = 10000,maxBytes = 1048576,allowPosts = false} = options;
    string(command,4096);
    if (!isAbsolute(command) || /[\r\n]/.test(command)) throw new TypeError('Command must be an absolute trusted executable path');
    if (!Array.isArray(args) || args.length > 32 || args.some(a => typeof a !== 'string' || /[\x00\r\n]/.test(a) || Buffer.byteLength(a)>8192)) throw new TypeError('Invalid process arguments');
    if (cwd !== undefined && (typeof cwd !== 'string' || !isAbsolute(cwd) || /[\x00\r\n]/.test(cwd))) throw new TypeError('Invalid cwd');
    if (typeof allowPosts !== 'boolean') throw new TypeError('Invalid allowPosts');
    integer(timeoutMs,10,120000); integer(maxBytes,1024,16777216);
    this.#config = {command,args:[...args],cwd,timeoutMs,maxBytes,allowPosts};
  }
  #stop(reason = new Error('AgentBBS client closed')) {
    this.#closed = true;
    for (const {reject,timer} of this.#pending.values()) { clearTimeout(timer); reject(reason); }
    this.#pending.clear(); this.#buffer = Buffer.alloc(0);
    if (this.#child) { this.#child.stdin.destroy(); this.#child.kill('SIGKILL'); }
  }
  #start() {
    if (this.#closed) throw new Error('AgentBBS client closed');
    if (this.#child) return;
    const {command,args,cwd} = this.#config;
    // Minimal environment prevents unrelated gateway tokens reaching the child.
    this.#child = spawn(command,args,{cwd,shell:false,env:{PATH:process.env.PATH ?? '/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
    this.#child.on('error',()=>this.#stop(new Error('AgentBBS process failed')));
    this.#child.on('exit',()=>this.#stop(new Error('AgentBBS process exited')));
    this.#child.stdin.on('error',()=>this.#stop(new Error('AgentBBS input failed')));
    let stderrBytes = 0;
    this.#child.stderr.on('data',chunk=> { stderrBytes += chunk.length; if (stderrBytes > this.#config.maxBytes) this.#stop(new Error('AgentBBS stderr limit')); });
    this.#child.stdout.on('data',chunk=> {
      if (this.#buffer.length + chunk.length > this.#config.maxBytes) return this.#stop(new Error('AgentBBS output limit'));
      this.#buffer = Buffer.concat([this.#buffer,chunk]);
      let end;
      while ((end = this.#buffer.indexOf(10)) >= 0) {
        const line = this.#buffer.subarray(0,end); this.#buffer = this.#buffer.subarray(end+1);
        let response;
        try { response = JSON.parse(line.toString('utf8')); } catch { return this.#stop(new Error('Invalid AgentBBS JSON')); }
        if (!response || response.jsonrpc !== '2.0' || !Number.isSafeInteger(response.id) || !this.#pending.has(response.id) || (Object.hasOwn(response,'result') === Object.hasOwn(response,'error'))) return this.#stop(new Error('Invalid AgentBBS response'));
        const pending = this.#pending.get(response.id); this.#pending.delete(response.id); clearTimeout(pending.timer);
        if (response.error || response.result?.isError) pending.reject(new Error('AgentBBS request rejected'));
        else pending.resolve(response.result);
      }
    });
  }
  #request(method,params) {
    this.#start();
    const id = ++this.#id;
    const bytes = JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n';
    if (Buffer.byteLength(bytes) > this.#config.maxBytes || this.#pending.size >= 16) return Promise.reject(new Error('AgentBBS request limit'));
    return new Promise((resolve,reject)=>{
      const timer = setTimeout(()=>this.#stop(new Error('AgentBBS request timeout')),this.#config.timeoutMs);
      this.#pending.set(id,{resolve,reject,timer});
      this.#child.stdin.write(bytes);
    });
  }
  initialize() {
    if (!this.#ready) this.#ready = this.#request('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'qudag-agentbbs',version:'2.0.0'}}).then(result=>{
      if (result?.protocolVersion !== PROTOCOL || result?.serverInfo?.name !== 'agentbbs-mcp') { this.#stop(); throw new Error('Incompatible AgentBBS server'); }
      this.#child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
      return result;
    });
    return this.#ready;
  }
  async #call(method,params) {
    const size = Buffer.byteLength(JSON.stringify(params));
    if (this.#calls >= 16 || this.#queuedBytes + size > this.#config.maxBytes) throw new Error('AgentBBS queue limit');
    this.#calls++; this.#queuedBytes += size;
    try { await this.initialize(); return {provenance:'local-server-observation',result:await this.#request(method,params)}; }
    finally { this.#calls--; this.#queuedBytes -= size; }
  }
  listBoards() { if (arguments.length) throw new TypeError('Unexpected arguments'); return this.#call('tools/call',{name:'list_boards',arguments:{}}); }
  readBoard(slug,limit=20) { if(arguments.length>2) throw new TypeError('Unexpected arguments'); return this.#call('tools/call',{name:'read_board',arguments:{board:board(slug),limit:integer(limit,1,100)}}); }
  searchMemory(query,topK=5) {
    if (arguments.length>2 || !Array.isArray(query) || query.length !== 384 || query.some(v=>typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v)>3.4028234663852886e38)) throw new TypeError('Expected finite 384 dimensional float32 vector');
    return this.#call('tools/call',{name:'search_memory',arguments:{query:[...query],top_k:integer(topK,1,100)}});
  }
  readResource(uri) { if(arguments.length!==1 || typeof uri !== 'string' || !uri.startsWith('agentbbs://board/')) throw new TypeError('Invalid resource'); board(uri.slice(17)); return this.#call('resources/read',{uri}); }
  postMessage(args) {
    if (!this.#config.allowPosts) throw new Error('AgentBBS posts disabled');
    if(arguments.length!==1) throw new TypeError('Unexpected arguments');
    object(args,['board','subject','text']);
    return this.#call('tools/call',{name:'post_message',arguments:{board:board(args.board),subject:string(args.subject,256),text:string(args.text,16384)}});
  }
  close() { this.#stop(); }
}
