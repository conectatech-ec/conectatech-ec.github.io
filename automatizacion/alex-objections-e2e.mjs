// Real deployed model, synthetic private conversations. Never fabricates a Messenger event.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {objectionConversation,assertCommercialTurn} from './alex-objections-scenarios.mjs';
import {refreshAlexCatalog,quoteCurrent} from './alex-catalog.mjs';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'};
const report={at:new Date().toISOString(),kind:'private_HTTPS_synthetic_conversations',passed:false,real_Messenger_conversation_verified:false,messages_sent_to_Messenger:0,paid_services_activated:false,conversations:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
try{
 for(let i=0;i<15;i++){const health=await get('/health');if(health.release===process.env.EXPECTED_RELEASE){report.health=health;break;}await new Promise(r=>setTimeout(r,2000));}
 assert.ok(report.health);assert.equal(report.health.meta_ingress_enabled,false);assert.equal(report.health.catalog_first,true);
 for(const path of ['/alex/chat','/alex/quota','/messenger/seller/results'])assert.equal((await fetch(base+path)).status,401);
 report.quota_before=await get('/alex/quota');assert.ok(report.quota_before.remaining_calls>=35,'Preserve free AI guard; no paid retry');
 const source=await refreshAlexCatalog(),p=source.productos.find(p=>p.sku==='TELF011');report.source={cut_date:source.inventory_cut_date,published_at:source.feed_published_at,verified_at:source.fuente_fecha,quote_current:quoteCurrent(source,p)};
 for(const mode of ['model_available_path','forced_without_AI']){
  const session=crypto.randomUUID(),conversation={mode,synthetic_customer:true,real_AI_calls:0,turns:[]};report.conversations.push(conversation);let memory={};
  async function ask(input,quick_reply_payload){
   const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message:input,catalog_only:mode==='forced_without_AI',...(quick_reply_payload?{quick_reply_payload}:{})}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();
   conversation.turns.push({input,quick_reply:!!quick_reply_payload,text:a.text,generative:a.generative,response_mode:a.response_mode,error_code:a.error_code,facts:a.facts,focus:a.focus,image:a.image,buttons:a.quick_replies?.map(q=>q.title),memory:a.memory});
   assert.equal(a.outbound_enabled,false);if(a.generative)conversation.real_AI_calls++;if(mode==='forced_without_AI')assert.equal(a.generative,false);if(!a.quote_current)assert.ok(!a.text.includes('$'),'No unverified financial amount');return a;
  }
  const quota=await get('/alex/quota');
  for(const [i,input]of objectionConversation.entries()){
   const a=await ask(input);assertCommercialTurn(i,a,memory,{quotesCurrent:report.source.quote_current,cash:'$'+p.promo.toFixed(2),card:'$'+p.pvp.toFixed(2)});memory=a.memory;
   if(i===5){const button=a.quick_replies.find(q=>q.title==='Otra tarjeta');assert.ok(button);const next=await ask('Otra tarjeta',button.payload);assert.match(next.text,/qu[eé] banco/i);assert.ok(!/Pacífico|sin intereses/i.test(next.text));assert.deepEqual(next.focus,['TELF011']);memory=next.memory;}
  }
  const after=await get('/alex/quota');conversation.reservations_used=after.calls-quota.calls;if(mode==='forced_without_AI')assert.equal(conversation.reservations_used,0);else assert.ok(conversation.real_AI_calls>=2,'Must demonstrate real generative language, not only the fallback');conversation.passed=true;
 }
 report.quota_after=await get('/alex/quota');assert.ok(report.quota_after.remaining_calls>=20);report.passed=true;
}catch(error){report.failure=String(error.message).slice(0,500);}
const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('alex-objeciones-https.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
