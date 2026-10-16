// Cloud CI integration test only: loopback HTTP + actual SQLite, NOT Cloudflare or Meta delivery.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import worker,{MessengerTestInbox} from './worker.mjs';
const stores=new Map();
const namespace={idFromName:name=>name,get(name){
 if(!stores.has(name)) {
  const db=new DatabaseSync(':memory:');let box,timer;
  const state={storage:{sql:{exec(sql,...args){const stmt=db.prepare(sql);let rows=[];if(/^SELECT/i.test(sql))rows=stmt.all(...args);else stmt.run(...args);return {toArray:()=>rows,one:()=>{if(rows.length!==1)throw Error('SQLite single row expected');return rows[0];}};}},setAlarm:async time=>{clearTimeout(timer);timer=setTimeout(()=>box.alarm().catch(()=>{}),Math.max(1,time-Date.now()));timer.unref();}}};
  box=new MessengerTestInbox(state,{});stores.set(name,box);
 }
 return {fetch:(url,options)=>stores.get(name).fetch(new Request(url,options))};
}};
const env={PILOT_TOKEN:'synthetic-runner-token-not-a-production-secret',META_MODE:'development-only',META_PAGE_ID:'100000000000001',META_APP_SECRET:'synthetic-app-secret-not-a-Meta-credential',META_VERIFY_TOKEN:'synthetic-runner-verification-token-0000001',META_TEST_SENDER_IDS:'100000000000002',MESSENGER_TEST_INBOX:namespace};
const server=createServer(async(req,res)=>{
 try {
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Runner fixture failed');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
try {
 const exitCode=await new Promise(resolve=>{
  const child=spawn(process.execPath,[...process.execArgv,'automatizacion/messenger-e2e.mjs'],{stdio:'inherit',env:{...process.env,PILOT_BASE_URL:'http://127.0.0.1:'+address.port,PILOT_TOKEN:env.PILOT_TOKEN,META_VERIFY_TOKEN:env.META_VERIFY_TOKEN,MESSENGER_E2E_SCOPE:'cloud_runner_loopback_http_sqlite_fixture'}});
  child.on('error',()=>resolve(1));child.on('close',resolve);
 });
 if(exitCode!==0)process.exitCode=exitCode||1;
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
