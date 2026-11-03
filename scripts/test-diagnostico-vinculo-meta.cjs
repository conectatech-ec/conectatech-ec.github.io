'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {REQUESTS,redact,readAsset,diagnose,main}=require('./diagnosticar-vinculo-whatsapp-meta.cjs');
const token='fake+secret&slash/';
function response(data,status=200){return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)};}
test('no envía solicitudes sin credencial; no presenta ausencia como cuenta inexistente',async()=>{
 let calls=0;
 const r=await diagnose({transport:async()=>{calls++;throw Error('no');}});
 assert.equal(calls,0);assert.equal(r.estado,'SIN_CREDENCIAL_WHATSAPP_SECUNDARIO');
});
test('rechaza activos ajenos y campos arbitrarios antes del transporte',async()=>{
 let calls=0;const transport=async()=>{calls++;return response({id:'1'});};
 for(const request of [{...REQUESTS[0],path:'me/accounts'},{...REQUESTS[0],fields:'access_token'},{...REQUESTS[0],path:'https://other.test/'}]){
  await assert.rejects(readAsset({token,request,transport}),/FUERA_DE_ALCANCE/);
 }
 assert.equal(calls,0);
});
test('todas las solicitudes reales son GET, host fijo y token sólo en cabecera',async()=>{
 const seen=[];
 const r=await diagnose({token,transport:async(url,options)=>{
  seen.push({url,options});
  assert.equal(url.origin,'https://graph.facebook.com');
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer '+token);
  assert.equal(url.searchParams.has('access_token'),false);
  if(url.pathname.endsWith('/permissions'))return response({data:[{permission:'catalog_management',status:'granted'}]});
  if(url.pathname.endsWith('/product_catalogs'))return response({data:[{id:'1036301566100990',name:'Maestro'}],paging:{next:'https://other.test/?access_token='+token}});
  return response({id:'1036301566100990',name:'Maestro',access_token:token});
 }});
 assert.equal(seen.length,REQUESTS.length);
 assert.equal(r.maestro_en_catalogos_secundario,true);
 assert.equal(r.visibilidad_cliente_whatsapp_verificada,false);
 assert.equal(JSON.stringify(r).includes(token),false);
 assert.equal(JSON.stringify(r).includes('other.test'),false);
 assert.equal(r.resultados.find(x=>x.consulta==='catalogos_secundario').hay_mas_paginas,true);
});
test('permiso denegado no se interpreta como ausencia de catálogo ni filtra credenciales',async()=>{
 const r=await diagnose({token,transport:async()=>response({
  error:{code:200,error_subcode:42,message:'Denied '+token+' '+encodeURIComponent(token)+' https://graph.test/?access_token=another-token'}
 },403)});
 assert.equal(r.maestro_en_catalogos_secundario,null);
 assert.equal(r.catalogo_maestro_accesible,false);
 assert.ok(r.resultados.every(x=>x.estado==='NO_CONSULTABLE'&&x.codigo===200&&x.subcodigo===42));
 const serialized=JSON.stringify(r);
 assert.equal(serialized.includes(token),false);
 assert.equal(serialized.includes(encodeURIComponent(token)),false);
 assert.equal(serialized.includes('another-token'),false);
});
test('errores de transporte o JSON nunca imprimen el mensaje original ni el token',async()=>{
 for(const transport of [
  async()=>{throw Error('Authorization Bearer '+token);},
  async()=>({ok:true,status:200,text:async()=>'<html>'+token})
 ]){
  const r=await readAsset({token,request:REQUESTS[0],transport});
  assert.equal(r.motivo,'TRANSPORTE_O_RESPUESTA_INVALIDA');
  assert.equal(JSON.stringify(r).includes(token),false);
 }
});
test('un catálogo distinto en la cuenta secundaria no acredita el Maestro',async()=>{
 const r=await diagnose({token,transport:async(url)=>{
  if(url.pathname.endsWith('/permissions'))return response({data:[]});
  if(url.pathname.endsWith('/product_catalogs'))return response({data:[{id:'665080484330219',name:'Otro'}]});
  return response({id:'1036301566100990'});
 }});
 assert.equal(r.maestro_en_catalogos_secundario,false);
 assert.equal(r.visibilidad_cliente_whatsapp_verificada,false);
});
test('redacta formatos conocidos aun en datos de respuesta y omite propiedades ajenas',async()=>{
 const ea='EAA'+'z'.repeat(40);
 assert.equal(redact(ea,token),'[OCULTO]');
 const r=await readAsset({token,request:REQUESTS[0],transport:async()=>response({
  id:'1036301566100990',name:token,token,private_field:'secreto'
 })});
 assert.equal(r.datos.name,'[OCULTO]');
 assert.deepEqual(Object.keys(r.datos).sort(),['id','name']);
});

test('no usa la credencial principal si falta el secreto secundario',async()=>{
 let calls=0;const logs=[];
 const r=await main({env:{META_ACCESS_TOKEN:'principal_no_usar'},
  transport:async()=>{calls++;throw Error('No debe solicitar nada');},log:s=>logs.push(s)});
 assert.equal(calls,0);
 assert.equal(r.estado,'SIN_CREDENCIAL_WHATSAPP_SECUNDARIO');
 assert.equal(logs.join('\n').includes('principal_no_usar'),false);
});
test('usa exclusivamente el secreto secundario aunque ambos estén definidos',async()=>{
 let calls=0;const logs=[];
 const r=await main({env:{META_ACCESS_TOKEN:'principal_no_usar',META_WHATSAPP_SECONDARY_TOKEN:token},
  log:s=>logs.push(s),transport:async(url,options)=>{
   calls++;assert.equal(options.headers.Authorization,'Bearer '+token);
   assert.equal(options.method,'GET');
   if(url.pathname.endsWith('/permissions')||url.pathname.endsWith('/product_catalogs'))return response({data:[]});
   return response({id:'1036301566100990',name:'Maestro'});
  }});
 assert.equal(calls,REQUESTS.length);
 assert.equal(r.solo_lectura,true);
 assert.equal(logs.join('\n').includes('principal_no_usar'),false);
 assert.equal(logs.join('\n').includes(token),false);
});
test('el workflow reserva el secreto secundario a la comprobación y conserva el principal en producción',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/exportar-canales.yml'),'utf8');
 const step=workflow.split('      - name: Consultar vínculo WhatsApp con la credencial existente (sólo lectura)\n')[1]?.split('      - uses:')[0];
 assert.ok(step);
 assert.ok(step.includes('META_WHATSAPP_SECONDARY_TOKEN: $'+'{{ secrets.META_WHATSAPP_SECONDARY_TOKEN }}'));
 assert.equal(step.includes('secrets.META_ACCESS_TOKEN'),false);
 const production=workflow.split('  exportar:\n')[1];
 assert.ok(production);
 assert.equal(production.includes('META_WHATSAPP_SECONDARY_TOKEN'),false);
 assert.equal((production.match(/secrets\.META_ACCESS_TOKEN/g)||[]).length,2);
});
