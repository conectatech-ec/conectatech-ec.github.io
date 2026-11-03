'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {MASTER,PHONE,NAME,FEED_NAME,SecondaryGraph,syncSecondary,main,validateConfig,CHECKPOINT,failureReceipt}=require('./sincronizar-secundario-meta.cjs');
const {synchronize,reconcile}=require('./sincronizar-conjuntos-meta.cjs');
const config={version:1,enabled:true,phone:PHONE,catalog_id:'123456789',catalog_name:NAME,feed_name:FEED_NAME};
const plan={catalog_id:MASTER,productos_meta:2,fuente_sha256:'a'.repeat(64),groups:[{
 name:'CONECTATECH | TABLETS',retailer_id:'conectatech-web:tablets',family:'Tablets',label:'ct-web:tablets',
 filter:{and:[{custom_label_0:{eq:'ct-web:tablets'}},{availability:{eq:'in stock'}}]},sku:['TABL001']
}]};
function fixture({badName=false,badMembers=false,badImport=false,scheduled=false,duplicate=false,badFeedId=false,extraProducts=false,pendingUpload=false}={}){
 const calls=[],sets=[],feeds=[],uploads=[];
 let seq=200;
 if(scheduled)feeds.push({id:'20',name:FEED_NAME,schedule:{url:'https://example.test/duplicado.csv'}});
 if(duplicate)feeds.push({id:'21',name:FEED_NAME},{id:'22',name:FEED_NAME});
 if(badFeedId)feeds.push({id:'974449225015463',name:FEED_NAME});
 const remote=[{id:'31',retailer_id:'TABL001',custom_label_0:'ct-web:tablets',availability:'in stock'},
  {id:'32',retailer_id:'TABL002',custom_label_0:'',availability:'out of stock'}];
 if(extraProducts)remote.push({id:'33',retailer_id:'AJENO',custom_label_0:'',availability:'out of stock'});
 const transport=async(url,options)=>{
  assert.equal(url.origin,'https://graph.facebook.com');assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer SECONDARY_FAKE');assert.equal(url.searchParams.has('access_token'),false);
  const path=url.pathname.replace('/v26.0/','');
  assert.equal(path.includes(MASTER),false,'ninguna operación dirigida al Maestro');
  const params=options.body instanceof FormData?Object.fromEntries(options.body):options.body?Object.fromEntries(options.body):{};
  calls.push({method:options.method,path,params});
  let data;
  if(path===config.catalog_id)data={id:config.catalog_id,name:badName?'OTRO':NAME};
  else if(path===config.catalog_id+'/product_feeds'){
   if(options.method==='POST'){const f={id:String(seq++),name:params.name};feeds.push(f);data={id:f.id};}
   else data={data:structuredClone(feeds)};
  }else if(path===config.catalog_id+'/product_sets'){
   if(options.method==='POST'){const s={id:String(seq++),...params,filter:JSON.parse(params.filter)};sets.push(s);data={id:s.id};}
   else data={data:structuredClone(sets)};
  }else if(path===config.catalog_id+'/products')data={data:remote};
  else if(feeds.some(f=>path===f.id+'/uploads')){
   if(options.method==='POST'){
    assert.equal(params.update_only,'true');assert.equal(await params.file.text(),'csv-publico');
    const u={id:String(seq++),filename:params.file.name,end_time:pendingUpload?null:'done',error_count:badImport?1:0,num_invalid_items:0,num_persisted_items:2};uploads.push(u);data={id:u.id};
   }else data={data:structuredClone(uploads)};
  }else if(uploads.some(u=>u.id===path))data=uploads.find(u=>u.id===path);
  else if(sets.some(s=>s.id===path))data=sets.find(s=>s.id===path);
  else if(sets.some(s=>path===s.id+'/products'))data={data:badMembers?[]:[remote[0]]};
  else throw Error('Ruta no prevista '+path);
  return new Response(JSON.stringify(data));
 };
 const api=new SecondaryGraph({config,token:'SECONDARY_FAKE',version:'v26.0',transport});
 return {api,calls,feeds,sets,uploads,transport};
}
test('conserva la fijación del sincronizador principal al Maestro',async()=>{
 let calls=0;const api={request:async()=>{calls++;}};
 await assert.rejects(synchronize({plan:{...plan,catalog_id:config.catalog_id},api}),/Plan Meta inválido/);
 assert.throws(()=>reconcile({...plan,catalog_id:config.catalog_id},[]),/distinto del Maestro/);
 assert.equal(calls,0);
});
test('configuración secundaria rechaza Maestro, feed principal, otro teléfono y activación sin ID',()=>{
 for(const c of [{...config,catalog_id:MASTER},{...config,catalog_id:'974449225015463'},{...config,phone:'593998576759'},{...config,catalog_id:null}])assert.throws(()=>validateConfig(c));
});
test('bloquea escrituras arbitrarias, teléfonos, mensajes y cualquier descendiente no acreditado',async()=>{
 const {api,calls}=fixture();
 for(const [method,path,params] of [['POST',MASTER,{}],['POST','974449225015463/uploads',{}],['DELETE',config.catalog_id,{}],['POST','105264852297951/messages',{}],['POST','999',{}],['POST',config.catalog_id,{}],['POST',config.catalog_id+'/product_feeds',{name:FEED_NAME,schedule:{}}]]){
  await assert.rejects(api.request(method,path,params));
 }
 assert.equal(calls.length,0);
});
test('sincroniza otra identidad con los mismos SKU, verifica pertenencia y conserva la fuente',async()=>{
 const f=fixture(),original=JSON.stringify(plan),checkpoints=[];
 const result=await syncSecondary({config,plan,csv:'csv-publico',api:f.api,wait:async()=>{},attempts:1,onCheckpoint:c=>checkpoints.push(c)});
 assert.equal(result.catalog_id,config.catalog_id);assert.equal(result.estado,'META_SINCRONIZADO');
 assert.equal(result.productos_verificados,2);assert.equal(result.disponibles,1);assert.equal(result.agotados,1);
 assert.equal(result.colecciones_whatsapp_verificadas,false);assert.equal(result.conjuntos[0].sku,1);
 assert.equal(JSON.stringify(plan),original);assert.equal(checkpoints[0].catalog_id,config.catalog_id);
 assert.equal(f.feeds.length,1);assert.deepEqual(Object.keys(f.feeds[0]).sort(),['id','name']);
 assert.ok(f.calls.every(c=>c.method!=='DELETE'));assert.equal(f.uploads.length,1);
 const before=f.calls.filter(c=>c.method==='POST').length;
 await syncSecondary({config,plan,csv:'csv-publico',api:f.api,wait:async()=>{},attempts:1});
 assert.equal(f.calls.filter(c=>c.method==='POST').length,before,'reintento adopta feed/carga/conjuntos existentes');
});
test('rechaza catálogo con otro nombre antes de cualquier escritura',async()=>{
 const f=fixture({badName:true});
 await assert.rejects(syncSecondary({config,plan,csv:'csv-publico',api:f.api}),/Identidad/);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('rechaza feeds duplicados, programados o con ID principal antes de escribir',async()=>{
 for(const option of [{duplicate:true},{scheduled:true},{badFeedId:true}]){
  const f=fixture(option);
  await assert.rejects(syncSecondary({config,plan,csv:'csv-publico',api:f.api}));
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }
});
test('una importación incompleta o pertenencia incorrecta nunca acredita sincronización',async()=>{
 for(const option of [{badImport:true},{badMembers:true}]){
  const f=fixture(option);
  await assert.rejects(syncSecondary({config,plan,csv:'csv-publico',api:f.api,wait:async()=>{},attempts:1}),/IMPORTACION_CON_ERRORES|PERTENENCIA_NO_VERIFICADA/);
 }
});
test('una importación que reporta éxito no acredita catálogo con productos adicionales',async()=>{
 const f=fixture({extraProducts:true});
 await assert.rejects(syncSecondary({config,plan,csv:'csv-publico',api:f.api,wait:async()=>{},attempts:1}),/TOTALES_SECUNDARIOS_NO_COINCIDEN/);
});
test('secreto principal nunca sirve de reserva y config inactiva no solicita nada',async()=>{
 let calls=0;const transport=async()=>{calls++;throw Error('no');};
 await assert.rejects(main({config,env:{META_ACCESS_TOKEN:'PRINCIPAL'},transport,write:()=>{},log:()=>{}}),/FALTA_CREDENCIAL_SECUNDARIA/);
 const r=await main({config:{...config,enabled:false,catalog_id:null},env:{META_ACCESS_TOKEN:'PRINCIPAL'},transport,write:()=>{},log:()=>{}});
 assert.equal(r.estado,'SECUNDARIO_PENDIENTE_CONFIGURACION');assert.equal(calls,0);
});
test('utiliza sólo el secreto secundario y rutas separadas para recibo y checkpoint',async()=>{
 const f=fixture(),writes=[];
 await main({config,plan,csv:'csv-publico',checkpoint:null,env:{META_ACCESS_TOKEN:'PRINCIPAL',META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:f.transport,write:(p,d)=>writes.push([p,d]),log:()=>{}});
 assert.equal(CHECKPOINT,'reportes/integracion-whatsapp/ultima-importacion-secundario.json');
 assert.deepEqual(writes.map(w=>w[0]),['work/auto-meta/importacion-secundario.json','work/auto-meta/resultado-secundario.json']);
 assert.equal(JSON.stringify(writes).includes('PRINCIPAL'),false);
});
test('el workflow usa el secreto secundario sólo en su paso, sin cron y con fallo independiente',()=>{
 const w=fs.readFileSync('.github/workflows/exportar-canales.yml','utf8');
 const p=w.split('  exportar:\n')[1];
 const primary=p.split('      - name: Sincronizar fuente existente y conjuntos de Meta\n')[1].split('      - name:')[0];
 assert.ok(primary.includes('secrets.META_ACCESS_TOKEN'));assert.equal(primary.includes('SECONDARY'),false);
 const secondary=p.split('      - name: Sincronizar catálogo independiente de WhatsApp secundario\n')[1].split('      - name:')[0];
 assert.ok(secondary.includes('continue-on-error: true'));assert.ok(secondary.includes('secrets.META_WHATSAPP_SECONDARY_TOKEN'));assert.equal(secondary.includes('secrets.META_ACCESS_TOKEN'),false);
 assert.equal(w.includes('cron:'),false);
 assert.ok(p.includes('reportes/integracion-whatsapp/ultima-importacion-secundario.json'));
});
test('inspección con ID configurado e inactivo verifica identidad y nunca escribe en Meta',async()=>{
 const f=fixture();
 const result=await main({config:{...config,enabled:false},inspect:true,env:{META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:f.transport,write:()=>{},log:()=>{}});
 assert.equal(result.estado,'CATALOGO_SECUNDARIO_ACCESIBLE_SOLO_LECTURA');
 assert.equal(result.productos_leidos,2);assert.equal(result.disponibles,1);assert.equal(result.agotados,1);
 assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>c.method==='GET'));
 const bad=fixture({badName:true});
 await assert.rejects(main({config,inspect:true,env:{META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:bad.transport,write:()=>{},log:()=>{}}),/IDENTIDAD_SECUNDARIA/);
 assert.equal(bad.calls.filter(c=>c.method==='POST').length,0);
});
test('distingue importación pendiente de error y no imprime detalles desconocidos',()=>{
 assert.equal(failureReceipt(Error('META_IMPORTACION_PENDIENTE')).estado,'SECUNDARIO_IMPORTACION_PENDIENTE');
 assert.equal(failureReceipt(Error('META_IMPORTACION_CON_ERRORES_O_INCOMPLETA')).codigo,'META_IMPORTACION_CON_ERRORES_O_INCOMPLETA');
 assert.equal(JSON.stringify(failureReceipt(Error('Bearer NEVER_PRINT'))).includes('NEVER_PRINT'),false);
});
test('inspección informa avance de la carga existente sin crear otra importación',async()=>{
 const f=fixture();f.feeds.push({id:'20',name:FEED_NAME});
 f.uploads.push({id:'900',start_time:'2026-11-03T00:00:00Z',error_count:0,num_invalid_items:0,num_persisted_items:1});
 const r=await main({config,inspect:true,env:{META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:f.transport,write:()=>{},log:()=>{}});
 assert.equal(r.importaciones[0].feed_id,'20');assert.equal(r.importaciones[0].cargas[0].persistidos,1);assert.equal(r.importaciones[0].cargas[0].fin,null);
 assert.ok(f.calls.every(c=>c.method==='GET'));assert.equal(f.uploads.length,1);
});
test('la espera de importación secundaria se acota sin repetir la carga ni cambiar reintentos de pertenencia',async()=>{
 const f=fixture({pendingUpload:true});let waits=0,checkpoint;
 const opts={config,plan,csv:'csv-publico',api:f.api,wait:async()=>{waits++;},uploadAttempts:1,onCheckpoint:c=>{checkpoint=c;}};
 await assert.rejects(syncSecondary(opts),/META_IMPORTACION_PENDIENTE/);
 assert.equal(waits,1);assert.equal(f.uploads.length,1);assert.equal(f.sets.length,0);
 await assert.rejects(syncSecondary({...opts,checkpoint}),/META_IMPORTACION_PENDIENTE/);
 assert.equal(f.uploads.length,1);assert.equal(waits,2);
 f.uploads[0].end_time='done';
 const result=await syncSecondary({...opts,checkpoint});assert.equal(result.productos_verificados,2);assert.equal(f.uploads.length,1);
});
