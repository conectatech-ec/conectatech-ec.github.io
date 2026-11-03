'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {MASTER,PHONE,NAME,FEED_NAME,SecondaryGraph,syncSecondary,main,validateConfig,CHECKPOINT,failureReceipt}=require('./sincronizar-secundario-meta.cjs');
const {synchronize,reconcile}=require('./sincronizar-conjuntos-meta.cjs');
const config={version:1,enabled:true,phone:PHONE,catalog_id:'123456789',catalog_name:NAME,feed_name:FEED_NAME};
const plan={catalog_id:MASTER,productos_meta:2,fuente_sha256:'a'.repeat(64),groups:[{
 name:'CONECTATECH | TABLETS',retailer_id:'conectatech-web:tablets',family:'Tablets',label:'ct-web:tablets',
 filter:{and:[{custom_label_0:{eq:'ct-web:tablets'}},{availability:{eq:'in stock'}}]},sku:['TABL001']
}]};
function fixture({badName=false,badMembers=false,badImport=false,scheduled=false,duplicate=false,badFeedId=false,extraProducts=false,pendingUpload=false,apiFailure=null}={}){
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
  if(apiFailure)return new Response(JSON.stringify({error:{code:apiFailure.code,error_subcode:apiFailure.subcode,message:'Bearer SECONDARY_FAKE https://private.example/photo?signature=NEVER_DISCLOSE'}}),{status:apiFailure.status});
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
 return {api,calls,feeds,sets,uploads,remote,transport};
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
test('clasifica HTTP/Graph sin revelar mensajes, URLs, headers ni credencial',async()=>{
 for(const [status,code,category]of [[429,4,'rate_limit'],[403,200,'permission_denied'],[400,100,'unsupported_or_invalid_request'],[503,2,'transport'],[400,42,'graph_api']]){
  const f=fixture({apiFailure:{status,code,subcode:999}});let error;
  try{await main({config,plan,csv:'csv-publico',checkpoint:null,env:{META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:f.transport,write:()=>{},log:()=>{}});}catch(e){error=e;}
  assert(error);const result=failureReceipt(error),text=JSON.stringify(result);
  assert.equal(result.estado,'ERROR_SECUNDARIO');assert.equal(result.diagnostico.category,category);assert.equal(result.diagnostico.stage,'verify_catalog_identity');assert.equal(result.diagnostico.http_status,status);assert.equal(result.diagnostico.graph_code,code);assert.equal(result.diagnostico.graph_subcode,999);assert.equal(result.diagnostico.feed_submission_attempts,0);
  for(const secret of ['SECONDARY_FAKE','NEVER_DISCLOSE','https://','Bearer','headers','reason'])assert(!text.includes(secret));
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }
});
test('error de pertenencia o identidad devuelve etapa y código seguros, nunca el ID del conjunto',()=>{
 for(const [raw,code,stage]of [['PERTENENCIA_NO_VERIFICADA_123456789123456789','PERTENENCIA_NO_VERIFICADA','verify_set_membership'],['CONJUNTO_NO_COINCIDE_123456789123456789','CONJUNTO_NO_COINCIDE','verify_set_identity']]){
  const error=Error(raw);error.meta={reason:'https://private.example/?access_token=NEVER_DISCLOSE',headers:{Authorization:'Bearer NEVER_DISCLOSE'}};const result=failureReceipt(error),text=JSON.stringify(result);
  assert.equal(result.codigo,code);assert.equal(result.diagnostico.category,'validation');assert.equal(result.diagnostico.stage,stage);assert.equal(result.diagnostico.graph_code,null);
  for(const secret of ['123456789123456789','NEVER_DISCLOSE','https://','Authorization','reason'])assert(!text.includes(secret));
 }
});
test('clasificador rechaza datos libres y números inválidos en metadatos desconocidos',()=>{
 const error=Error('PRIVATE MESSAGE https://private.example/?secret=NEVER_DISCLOSE');error.meta={code:'NEVER_DISCLOSE',subcode:Infinity,reason:'NEVER_DISCLOSE'};error.stage='https://private.example';
 const result=failureReceipt(error);assert.equal(result.codigo,'VALIDACION_SECUNDARIA_NO_CONFIRMADA');assert.equal(result.diagnostico.stage,'unknown');assert.equal(result.diagnostico.graph_code,null);assert.equal(result.diagnostico.graph_subcode,null);assert(!JSON.stringify(result).includes('NEVER_DISCLOSE'));assert(!JSON.stringify(result).includes('https://'));
});
test('código HTTP malformado no puede transportar un ID numérico privado en el recibo',()=>{
 const result=failureReceipt(Error('META_HTTP_400_CODIGO_123456789123456789'));assert.equal(result.codigo,'META_HTTP_400_CODIGO_NO_DISPONIBLE');assert.equal(result.diagnostico.http_status,400);assert.equal(result.diagnostico.graph_code,null);assert(!JSON.stringify(result).includes('123456789123456789'));
 const invalid=failureReceipt(Error('META_HTTP_999_CODIGO_123456789123456789'));assert.equal(invalid.codigo,'VALIDACION_SECUNDARIA_NO_CONFIRMADA');assert.equal(invalid.diagnostico.http_status,null);assert(!JSON.stringify(invalid).includes('123456789123456789'));
});
test('reverificación fallida cuenta conjuntos y conserva último éxito/checkpoint sin nueva carga',async()=>{
 const f=fixture(),checkpoints=[];const previous=await syncSecondary({config,plan,csv:'csv-publico',api:f.api,wait:async()=>{},attempts:1,onCheckpoint:c=>checkpoints.push(c)}),snapshot=JSON.stringify(previous),checkpoint=checkpoints[0],checkpointBytes=JSON.stringify(checkpoint),posts=f.calls.filter(c=>c.method==='POST').length;
 f.remote.push({id:'44',retailer_id:'EXTRA',custom_label_0:'',availability:'out of stock'});const writes=[];let error;
 try{await main({config,plan,csv:'csv-publico',checkpoint,env:{META_WHATSAPP_SECONDARY_TOKEN:'SECONDARY_FAKE'},transport:f.transport,write:(p,d)=>writes.push([p,d]),log:()=>{}});}catch(e){error=e;}
 assert(error);const result=failureReceipt(error);assert.equal(result.codigo,'TOTALES_SECUNDARIOS_NO_COINCIDEN');assert.equal(result.diagnostico.stage,'verify_catalog_totals');assert.equal(result.diagnostico.sets_verified,1);assert.equal(result.diagnostico.feed_submission_attempts,0);assert.equal(result.diagnostico.pending_upload_polls,0);assert.equal(result.estado,'ERROR_SECUNDARIO');assert.equal(result.colecciones_whatsapp_verificadas,false);
 assert.equal(f.uploads.length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,posts);assert.equal(JSON.stringify(previous),snapshot);assert.equal(JSON.stringify(checkpoint),checkpointBytes);
 const resumed=writes.find(([p])=>p==='work/auto-meta/importacion-secundario.json');assert(resumed);assert.equal(JSON.stringify(resumed[1]),checkpointBytes,'checkpoint idéntico: ningún delta funcional que pueda crear un commit');assert(!writes.some(([p])=>p==='work/auto-meta/resultado-secundario.json'),'no emitir falso éxito después del error');
});
