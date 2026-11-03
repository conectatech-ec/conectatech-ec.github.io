// Real private HTTPS operator conversation; never posts a customer event or enters Graph transport.
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
if(config.verificar_calidad_conversacional!==true){console.log(JSON.stringify({alex_quality_check:'not_requested',AI_calls:0,messages_sent:0}));}
else{
 const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const report={schema:'conectatech.alex.conversation-quality.https.v1',at:new Date().toISOString(),scope:'private_operator_HTTPS_not_Messenger_delivery',passed:false,Graph_messages_sent:0,external_customers_enabled:false,model_changed:false,quota_increased:false,turns:[],AI_probes:[]};
 async function get(path){const r=await fetch(base+path,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return r.json();}
 async function ask(session,message,catalogOnly=true){
  const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message,catalog_only:catalogOnly}),redirect:'error',signal:AbortSignal.timeout(60000)});
  assert.equal(r.status,200);const a=await r.json();assert.equal(a.outbound_enabled,false);assert.ok(a.text&&a.text.length<=440);assert.ok((a.text.match(/\?/g)||[]).length<=1);assert.ok(!/\bTELF\d+\b|stock referencial|\d+ unidades/i.test(a.text));
  if(!a.source_fresh)assert.ok(!a.text.includes('$'));return a;
 }
 try{
  report.before=await get('/health');assert.equal(report.before.meta_ingress_enabled,false);assert.equal(report.before.release,process.env.EXPECTED_RELEASE);
  const session=crypto.randomUUID(),script=['Hola buenas 😊','Busco un Redmi 15C de 128 GB','Mi presupuesto es de 180 dólares','Lo necesito para trabajar, tomar fotos y WhatsApp','¿Qué batería tiene ese?','¿Y cuánto cuesta de contado?','¿Y con tarjeta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','¿A seis meses?','Mejor pago al contado','Quiero entrega en Quito','Estoy en La Carolina, Quito','¿Y si fuera envío nacional?','Muéstrame la fotografía','¿Me haces una rebajita? 😂','No compraré todavía','Quiero continuar después','Sigamos con ese celular','¿Y el de 256 GB?','Prefiero el Redmi 15C de 256 GB con 4 GB de RAM','¿Y con tarjeta el de 256 GB?','Quiero comprar ese, prefiero retiro en tienda','Necesito hablar con una persona'];
  let sourceSHA;for(const [i,message]of script.entries()){
   const a=await ask(session,message);sourceSHA||=a.source_sha256;assert.equal(a.source_sha256,sourceSHA);assert.equal(a.generative,false);
   if(i>1&&i<19)assert.deepEqual(a.focus,['TELF017']);if(i>=2)assert.equal(a.memory.budget,180);
   if(i===7)assert.ok(!/Pac[ií]fico|sin intereses/.test(a.text));if(i===8)assert.equal(a.memory.bank,'pichincha');
   if(i===9){assert.equal(a.intent,'payment');assert.ok(/confirmaci[oó]n|confirmar/i.test(a.text));}
   if(i===14){assert.equal(a.intent,'photo');assert.ok(a.image);report.explicit_photo_http=(await fetch(a.image,{redirect:'error',signal:AbortSignal.timeout(15000)})).status;assert.equal(report.explicit_photo_http,200);}
   if(i===15)assert.ok(a.facts.includes('discount'));
   if(i===16||i===17)assert.equal(a.memory.purchase_deferred,true);
   if(i===19)assert.ok(a.focus.length&&a.focus.every(s=>['TELF018','TELF019'].includes(s)));
   if(i>=20)assert.deepEqual(a.focus,['TELF018']);if(i===22&&a.source_fresh)assert.equal(a.action,'interest');
   if(i===23)assert.equal(a.action,'handoff');else assert.notEqual(a.action,'handoff');
   report.turns.push({message,text:a.text,intent:a.intent,action:a.action,focus:a.focus,image:a.image,buttons:a.quick_replies?.map(q=>q.title),source_sha256:a.source_sha256,source_fresh:a.source_fresh});
  }
  report.quota_before=await get('/alex/quota');
  if(report.quota_before.remaining_calls>=2){
   const natural=crypto.randomUUID();
   for(const message of ['Busco un Redmi 15C de 128 GB para trabajar y usar WhatsApp, tengo presupuesto de 180 dólares. ¿Qué me aconsejas?','¿Me haces una rebajita? 😂']){
    const a=await ask(natural,message,false);assert.equal(a.source_sha256,sourceSHA);assert.notEqual(a.action,'handoff');if(message.startsWith('Busco')){assert.ok(!/\?.*(?:entrega|retiro)|(?:entrega|retiro).*\?/i.test(a.text),'NO_PREMATURE_DELIVERY_CLOSING');assert.ok(a.facts?.some(k=>/\.(?:benefit|memory|battery|screen|camera|network)$/.test(k)),'RECOMMENDATION_REQUIRES_VERIFIED_REASON');}report.AI_probes.push({message,text:a.text,generative:a.generative,model:a.model,error_code:a.error_code,response_mode:a.response_mode,focus:a.focus,facts:a.facts});
   }
  }
  report.real_generative_response_verified=report.AI_probes.some(a=>a.generative===true);
  report.quota_after=await get('/alex/quota');report.after=await get('/health');assert.equal(report.after.meta_ingress_enabled,false);assert.equal(report.after.release,report.before.release);assert.equal(report.after.messenger_outbound,report.before.messenger_outbound);
  assert.equal(report.real_generative_response_verified,true,'GENERATIVE_RESPONSE_NOT_VERIFIED');report.passed=true;
 }catch(error){report.failure={type:error.name,code:error.code||'QUALITY_HTTPS_CHECK_FAILED'};}
 const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('alex-calidad-cloud.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}
