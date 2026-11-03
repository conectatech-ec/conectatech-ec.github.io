'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CATALOG,BASE,FIELDS,CatalogReader,diagnose,main}=require('./diagnosticar-visibilidad-secundario-meta.cjs');
const TOKEN='fake+secret/value',NAME='CONECTATECH | Catálogo WhatsApp 0964206977';
const reply=(data,status=200)=>({ok:status===200,status,text:async()=>JSON.stringify(data)});
test('falta del secreto secundario no usa el principal ni hace solicitudes',async()=>{
 let n=0;const r=await main({env:{META_ACCESS_TOKEN:'PRINCIPAL'},transport:async()=>{n++;},log:()=>{}});
 assert.equal(r.estado,'SIN_CREDENCIAL_SECUNDARIA');assert.equal(n,0);
});
test('rechaza el Maestro, objetos no acreditados y campos arbitrarios antes de acceder',async()=>{
 let n=0;const api=new CatalogReader({token:TOKEN,transport:async()=>{n++;}});
 for(const [path,fields] of [['1036301566100990/products',BASE],['999/channels_to_integrity_status','channels,rejection_information'],[CATALOG,'access_token']])await assert.rejects(api.get(path,fields),/FUERA_DE_ALCANCE/);
 assert.equal(n,0);
});
test('lee publicación y elegibilidad sólo con GET, y oculta token, URLs y propiedades ajenas',async()=>{
 const calls=[];const r=await diagnose({token:TOKEN,transport:async(url,opts)=>{
  calls.push(String(url));assert.equal(url.origin,'https://graph.facebook.com');assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer '+TOKEN);assert.equal(url.searchParams.has('access_token'),false);
  if(url.pathname.endsWith('/'+CATALOG))return reply({id:CATALOG,name:NAME});
  if(url.pathname.endsWith('/products'))return reply({data:[{id:'31',retailer_id:'TELF001',availability:'in stock',review_status:'pending',visibility:'published',image_fetch_status:'FETCHED',origin_country:'CN'},{id:'32',retailer_id:'TABL002',availability:'out of stock',review_status:'rejected',visibility:'staging',review_rejection_reasons:['WHATSAPP_DISABLED_BY_USER']}]});
  return reply({data:[{channels:['WHATSAPP'],rejection_information:{reason:'WHATSAPP_DISABLED_BY_USER',access_token:TOKEN,detail:TOKEN+' https://other.test/?access_token=abc'}}]});
 }});
 assert.equal(r.productos,2);assert.equal(r.revision.pending,1);assert.equal(r.visibilidad.staging,1);assert.equal(r.origen_declarado,1);assert.equal(calls.length,6);
 assert.equal(r.visibilidad_cliente_verificada,false);assert.equal(JSON.stringify(r).includes(TOKEN),false);assert.equal(JSON.stringify(r).includes('other.test'),false);assert.equal(JSON.stringify(r).includes('access_token'),false);
});
test('un campo no disponible permite leer la existencia sin asumir aprobación',async()=>{
 const r=await diagnose({token:TOKEN,transport:async(url)=>{
  if(url.pathname.endsWith('/'+CATALOG))return reply({id:CATALOG,name:NAME});
  if(url.searchParams.get('fields')===FIELDS)return reply({error:{code:100}},400);
  if(url.pathname.endsWith('/products'))return reply({data:[{id:'31',retailer_id:'TELF001',availability:'in stock'}]});
  return reply({error:{code:200}},403);
 }});
 assert.equal(r.productos,1);assert.equal(r.lectura_revision.estado,'NO_CONSULTABLE');assert.equal(r.revision.NO_DEVUELTO,1);assert.equal(r.muestras_canales[0].estado,'NO_CONSULTABLE');
});
test('la paginación usa cursores en el host fijo y nunca sigue la URL recibida',async()=>{
 const calls=[];const api=new CatalogReader({token:TOKEN,transport:async(url)=>{
  calls.push(url);if(!url.searchParams.has('after'))return reply({data:[{id:'31'}],paging:{next:'https://evil.test/?access_token='+TOKEN,cursors:{after:'cursor'}}});
  assert.equal(url.searchParams.get('after'),'cursor');return reply({data:[{id:'32'}]});
 }});
 const rows=await api.list(CATALOG+'/products',BASE);assert.equal(rows.length,2);assert.ok(calls.every(u=>u.origin==='https://graph.facebook.com'));
 await assert.rejects(api.get('999/channels_to_integrity_status','channels,rejection_information'),/FUERA_DE_ALCANCE/);
});
test('la identidad debe coincidir antes de leer productos',async()=>{
 let n=0;await assert.rejects(diagnose({token:TOKEN,transport:async()=>{n++;return reply({id:CATALOG,name:'OTRO'});}}),/IDENTIDAD/);assert.equal(n,1);
});
test('las fallas no imprimen mensajes arbitrarios del servidor ni transporte',async()=>{
 const logs=[];await main({env:{META_WHATSAPP_SECONDARY_TOKEN:TOKEN},transport:async()=>{throw Error(TOKEN);},log:s=>logs.push(s)});
 assert.equal(logs.join('').includes(TOKEN),false);
});
