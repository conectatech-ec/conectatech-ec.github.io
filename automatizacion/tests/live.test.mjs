import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../generated/catalogo.json' with {type:'json'};
import {refreshCatalog,verifyAssets} from '../live.mjs';
import {verifyMetaSignature,verifyMetaWebhook,normalizeEvents,prepareOfficialReply} from '../channels.mjs';
const now=Date.parse(catalog.fuente_fecha)+1000;
const feed=()=>({fechaCatalogo:catalog.fuente_fecha,productos:catalog.productos.map(p=>({sku:p.sku,nombre:p.nombre,promo:p.promo+1,pvp:p.pvp,stock:2,url:p.url}))});
const fake=d=>async()=>Response.json(d);
test('Live prices replace baseline; missing products never use old stock',async()=>{
 const d=feed(); d.productos.pop();const c=await refreshCatalog(catalog,fake(d),now);assert.equal(c.productos[0].promo,catalog.productos[0].promo+1);assert.equal(c.productos[2].stock,0);
});
test('Reject stale, future, duplicate and invalid commercial data',async()=>{
 for(const change of [d=>d.fechaCatalogo='invalid',d=>d.fechaCatalogo=new Date(now+86400000).toISOString(),d=>d.productos.push(d.productos[0]),d=>d.productos[0].promo=-2,d=>d.productos[0].nombre='Otro modelo']) {
  const d=feed();change(d);await assert.rejects(()=>refreshCatalog(catalog,fake(d),now));
 }
 await assert.rejects(()=>refreshCatalog(catalog,fake(feed()),now+86400001));
});
test('Changed photo hash blocks commercial response',async()=>{await assert.rejects(()=>verifyAssets(catalog.productos[0],async()=>new Response('wrong photo')));});
test('Meta challenge requires the configured secret',async()=>{
 assert.equal(verifyMetaWebhook(new Request('https://p/webhooks/meta?hub.mode=subscribe&hub.verify_token=secret&hub.challenge=123'),{META_VERIFY_TOKEN:'secret'}).status,200);
 assert.equal(verifyMetaWebhook(new Request('https://p/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong'),{META_VERIFY_TOKEN:'secret'}).status,403);
});
test('Meta HMAC accepts exact body and rejects tampering',async()=>{
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('fixture-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('{}')))).map(x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifyMetaSignature('{}','sha256='+digest,'fixture-secret'),true);assert.equal(await verifyMetaSignature('{"x":1}','sha256='+digest,'fixture-secret'),false);
});
test('Only configured Page/WABA accepted; echo/status ignored',()=>{
 const payload={object:'page',entry:[{id:'123',messaging:[{sender:{id:'fixture-user'},timestamp:now,message:{mid:'fixture-mid',text:'MICR27'}},{message:{mid:'echo',is_echo:true,text:'echo'}}]}]};
 assert.equal(normalizeEvents(payload,{META_PAGE_ID:'123'}).length,1);assert.equal(normalizeEvents(payload,{META_PAGE_ID:'456'}).length,0);
 const reply=prepareOfficialReply(normalizeEvents(payload,{META_PAGE_ID:'123'})[0],{text:'Respuesta'},now);assert.equal(reply.send_enabled,false);assert.equal(reply.body.messaging_type,'RESPONSE');
 assert.throws(()=>prepareOfficialReply({canal:'messenger',timestamp:now-86400001},{text:'x'},now));
});
