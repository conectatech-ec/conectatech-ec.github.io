'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CATALOG,FAMILIES,prepare,execute,recreate,ReorderGraph,main,recoveryNeeded}=require('./reordenar-categorias-secundario-meta.cjs');
const {parseGraphData}=require('./sincronizar-conjuntos-meta.cjs');
const productId=i=>(29513533084919997n+BigInt(i)).toString();
const {priority}=require('./prioridad-comercial-meta.cjs');
const desired=[...FAMILIES,'TV y Entretenimiento','Soportes y Accesorios','Seguridad y Cámaras','Redes e Internet','Protección para Dispositivos','Juguetes y Coleccionables','Iluminación','Hogar y Accesorios','Gaming y Videojuegos','Fotografía y Creación de Contenido','Deportes','Computación y Periféricos','Cargadores y Energía','Cables y Conectividad','Audio y Audífonos'];
function fixture(){
 const groups=priority.map((family,i)=>({family,retailer_id:'conectatech-web:'+i,name:family,filter:{custom_label_0:{eq:'label'+i}},sku:['SKU'+i]}));
 const make=(family,offset)=>{const i=priority.indexOf(family),g=groups[i];return {id:String(offset+i),name:family===FAMILIES[0]?'CONECTATECH | CELULARES':'CONECTATECH | '+family.toUpperCase(),retailer_id:g.retailer_id,filter:g.filter,ordering_info:[productId(i)]};};
 const masterSets=desired.map(f=>make(f,1000)),sets=[...priority].reverse().map(f=>make(f,2000));sets.find(s=>s.retailer_id===groups[0].retailer_id).name='CONECTATECH | CELULARES Y SMARTPHONES';
 const general={id:'8000',name:'All Products',filter:{}};sets.push(general);
 const products=groups.map((g,i)=>({id:productId(i),retailer_id:'SKU'+i,price:'10.00 USD',availability:'in stock'}));
 const master={catalog:{id:'1036301566100990'},sets:masterSets,products:products.map((p,i)=>({...p,id:String(1900+i)}))};
 const calls=[];let seq=3000,deleteFail=null,loseReply=false,createFail=false;
 const api={sets,products,calls,forRequest(){return this;},set deleteFail(v){deleteFail=v;},set loseReply(v){loseReply=v;},set createFail(v){createFail=v;},
  async list(path){calls.push({method:'GET',path});if(path===CATALOG+'/product_sets')return structuredClone([general,...sets.filter(s=>s!==general)]);if(path===CATALOG+'/products')return structuredClone(products);const s=sets.find(s=>s.id===path.split('/')[0]);if(!s)throw Error('SET_AUSENTE');const i=Number(s.retailer_id.split(':')[1]);return [structuredClone(products[i])];},
  async request(method,path,params={}){calls.push({method,path,params});
   if(path===CATALOG&&method==='GET')return {id:CATALOG,name:'CONECTATECH | Catálogo WhatsApp 0964206977'};
   if(method==='DELETE'){if(path===deleteFail)throw Error('BORRADO_DENEGADO');const i=sets.findIndex(s=>s.id===path);assert.ok(i>=0);sets.splice(i,1);return {success:true};}
   if(method==='POST'&&path===CATALOG+'/product_sets'){if(createFail)throw Error('CREACION_DENEGADA');const s={id:String(seq++),...structuredClone(params),ordering_info:parseGraphData('{"ordering_info":'+(params.ordering_info||'[]')+'}').ordering_info.map(String)};sets.unshift(s);if(loseReply){loseReply=false;throw Error('RESPUESTA_PERDIDA');}return {id:s.id};}
   const s=sets.find(s=>s.id===path);if(!s)throw Error('SET_AUSENTE');if(method==='POST'){assert.deepEqual(Object.keys(params),['name']);s.name=params.name;return {success:true};}return {...structuredClone(s),product_catalog:{id:CATALOG}};
  }};
 const snapshot=()=>({master:structuredClone(master),secondary:{catalog:{id:CATALOG},sets:structuredClone(sets),products:structuredClone(products)}});
 return {api,snapshot,plan:{catalog_id:'1036301566100990',fecha_corte:'2026-11-04',groups},master};
}
test('prepara el prefijo mínimo: 19 reemplazos y dos categorías conservadas',()=>{
 const f=fixture(),p=prepare(f.snapshot(),f.plan);assert.equal(p.targets.length,19);assert.deepEqual(p.targets.slice(0,6).map(g=>g.family),FAMILIES);assert.deepEqual(p.names.map(n=>n.name),f.master.sets.map(s=>s.name));
});
test('iguala las 21 categorías conservando todos los productos y sin escribir en el Maestro',async()=>{
 const f=fixture(),before=JSON.stringify(f.api.products),original=f.snapshot(),otherIds=original.secondary.sets.filter(s=>['Cables y Conectividad','Audio y Audífonos'].some(name=>s.name==='CONECTATECH | '+name.toUpperCase())).map(s=>s.id);let saved;
 const r=await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{},onState:s=>saved=s});
 assert.equal(r.estado,'ORDEN_SECUNDARIO_META_VERIFICADO');assert.equal(r.resultado.registros.length,19);assert.equal(r.productos,21);assert.equal(r.orden_whatsapp_verificado,false);assert.deepEqual(r.orden,f.master.sets.map(s=>s.name));
 assert.equal(JSON.stringify(f.api.products),before);assert.equal(f.api.calls.filter(c=>c.method==='DELETE').length,19);assert.equal(f.api.calls.filter(c=>c.method==='POST'&&c.path===CATALOG+'/product_sets').length,19);
 assert.ok(otherIds.every(id=>f.api.sets.some(s=>s.id===id)));assert.ok(f.api.sets.some(s=>s.id==='8000'));assert.ok(f.api.calls.every(c=>c.method==='GET'||c.path===CATALOG+'/product_sets'||original.secondary.sets.some(s=>s.id===c.path)));
 const count=f.api.calls.filter(c=>c.method!=='GET').length;await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,state:saved,wait:async()=>{}});assert.equal(f.api.calls.filter(c=>c.method!=='GET').length,count);
});
test('un reintento continúa la operación parcial sin repetir las categorías ya creadas',async()=>{
 const f=fixture(),p=prepare(f.snapshot(),f.plan),target=f.api.sets.find(s=>s.retailer_id===p.targets[16].retailer_id);f.api.deleteFail=target.id;let saved;
 await assert.rejects(execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{},onState:s=>saved=s}),/BORRADO_DENEGADO/);
 assert.equal(f.api.calls.filter(c=>c.method==='POST'&&c.path===CATALOG+'/product_sets').length,2);
 f.api.deleteFail=null;const r=await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,state:saved,wait:async()=>{}});assert.equal(r.estado,'ORDEN_SECUNDARIO_META_VERIFICADO');assert.equal(f.api.calls.filter(c=>c.method==='POST'&&c.path===CATALOG+'/product_sets').length,19);
});
test('recupera una creación cuya respuesta se perdió sin duplicarla',async()=>{
 const f=fixture();f.api.loseReply=true;await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{}});assert.equal(f.api.calls.filter(c=>c.method==='POST'&&c.path===CATALOG+'/product_sets').length,19);
});
test('recupera una categoría ausente después de fallar creación y restauración, sin repetir eliminaciones',async()=>{
 const f=fixture(),products=JSON.stringify(f.api.products);let saved;f.api.createFail=true;
 await assert.rejects(execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{},onState:s=>saved=s}),/CREACION_DENEGADA/);
 assert.equal(saved.resultado.estado,'REQUIERE_RECUPERACION');assert.equal(saved.resultado.registros[0].estado,'RESTAURACION_PENDIENTE');assert.equal(f.api.sets.length,21);assert.equal(recoveryNeeded(saved),true);
 f.api.createFail=false;
 const result=await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,state:saved,wait:async()=>{}});
 assert.equal(result.estado,'ORDEN_SECUNDARIO_META_VERIFICADO');assert.equal(f.api.sets.length,22);assert.equal(f.api.calls.filter(c=>c.method==='DELETE').length,19);assert.equal(JSON.stringify(f.api.products),products);assert.equal(recoveryNeeded(result),false);
});
test('prevalida todas las creaciones antes de la primera eliminación',async()=>{
 const f=fixture();let checked=0;f.api.validateCreation=()=>{if(++checked===19)throw Error('REORDEN_CREACION_FUERA_DE_ALCANCE');};
 await assert.rejects(execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{}}),/REORDEN_CREACION_FUERA_DE_ALCANCE/);
 assert.equal(checked,19);assert.equal(f.api.calls.filter(c=>c.method==='DELETE').length,0);
});
test('rechaza diferencias de inventario o filtro antes de modificar categorías',async()=>{
 for(const kind of ['price','filter']){const f=fixture(),s=f.snapshot();if(kind==='price')s.secondary.products[0].price='otro';else s.secondary.sets.find(s=>s.retailer_id).filter={otro:true};await assert.rejects(execute({snapshot:s,plan:f.plan,api:f.api}),/REORDEN_/);assert.equal(f.api.calls.filter(c=>c.method!=='GET').length,0);}
});
test('sin autorización explícita, el punto de entrada no usa credenciales ni accede a Meta',async()=>{
 const r=await main({env:{META_ACCESS_TOKEN:'PRINCIPAL_NO_USAR'},scope:{autorizado:false}});assert.equal(r.estado,'PENDIENTE_AUTORIZACION');
 await assert.rejects(main({env:{META_ORDER_SECONDARY_ENABLED:'true',META_ACCESS_TOKEN:'PRINCIPAL_NO_USAR'},scope:{autorizado:true,catalog_id:CATALOG,reference_catalog_id:'1036301566100990'},apply:true}),/FALTA_SECRETO_SECUNDARIO/);
});
test('el adaptador restringe las escrituras al secundario e impide DELETE sin IDs autorizados',async()=>{
 const calls=[];const api=new ReorderGraph({token:'SECONDARY_FAKE',names:[],transport:async(url,opt)=>{calls.push({url,opt});return new Response(JSON.stringify({id:CATALOG,name:'CONECTATECH | Catálogo WhatsApp 0964206977'}));}});
 for(const [method,path,params]of [['POST','1036301566100990/product_sets',{}],['DELETE','29304551402566106',{allow_live_product_set_deletion:false}],['POST',CATALOG+'/products',{}],['POST','105264852297951/messages',{}],['DELETE',CATALOG,{}]])await assert.rejects(api.request(method,path,params),/REORDEN_/);
 assert.equal(calls.length,0);await api.request('GET',CATALOG,{fields:'id,name'});await assert.rejects(api.request('DELETE','999',{allow_live_product_set_deletion:false}),/REORDEN_/);
});
test('el adaptador sólo permite reemplazos exactos y exige verificar el catálogo padre antes de eliminar',async()=>{
 const f=fixture();let state;await execute({snapshot:f.snapshot(),plan:f.plan,api:f.api,wait:async()=>{},onState:s=>{state=s;}});
 const {request,backup}=state,old=backup.colecciones[0].conjunto_original;let wrongParent=true;const calls=[];
 const api=new ReorderGraph({token:'SECONDARY_FAKE',request,backup,names:state.names,transport:async(url,opt)=>{
  calls.push({path:url.pathname,opt});assert.equal(opt.headers.Authorization,'Bearer SECONDARY_FAKE');assert.equal(url.searchParams.has('access_token'),false);
  const path=url.pathname.replace('/v26.0/','');let data;
  if(path===CATALOG)data={id:CATALOG,name:'CONECTATECH | Catálogo WhatsApp 0964206977'};
  else if(path===CATALOG+'/product_sets'&&opt.method==='GET')data={data:[old]};
  else if(path===old.id&&opt.method==='GET')data={...old,product_catalog:{id:wrongParent?'1036301566100990':CATALOG}};
  else if(opt.method==='DELETE')data={success:true};else data={id:'7777'};
  return new Response(JSON.stringify(data));
 }});
 await api.request('GET',CATALOG,{fields:'id,name'});await api.list(CATALOG+'/product_sets','id,name,retailer_id,filter,ordering_info');
 await assert.rejects(api.request('DELETE',old.id,{allow_live_product_set_deletion:false}),/FUERA_DE_ALCANCE/);
 await assert.rejects(api.request('GET',old.id,{fields:'id,product_catalog'}),/PADRE_DISTINTO/);wrongParent=false;
 await api.request('GET',old.id,{fields:'id,product_catalog'});
 await assert.rejects(api.request('DELETE',old.id,{allow_live_product_set_deletion:true}),/FUERA_DE_ALCANCE/);
 await api.request('DELETE',old.id,{allow_live_product_set_deletion:false});
 const params={name:old.name,retailer_id:old.retailer_id,filter:old.filter,ordering_info:'['+old.ordering_info.join(',')+']'};
 await assert.rejects(api.request('POST',CATALOG+'/product_sets',{...params,ordering_info:JSON.stringify(JSON.parse(params.ordering_info))}),/FUERA_DE_ALCANCE/);
 await assert.rejects(api.request('POST',CATALOG+'/product_sets',{...params,name:'OTRO'}),/FUERA_DE_ALCANCE/);
 const created=await api.request('POST',CATALOG+'/product_sets',params);assert.equal(created.id,'7777');
 assert.equal(calls.filter(c=>c.opt.method==='DELETE').length,1);assert.equal(calls.filter(c=>c.opt.method==='POST').length,1);
});
test('un nombre u orden cambiado desde el respaldo bloquea todas las eliminaciones',async()=>{
 for(const change of ['name','ordering_info']){
  const f=fixture(),p=prepare(f.snapshot(),f.plan);
  const backup={catalogo:{id:CATALOG},colecciones:p.targets.map(g=>({familia:g.family,conjunto_original:structuredClone(f.api.sets.find(s=>s.retailer_id===g.retailer_id))}))};
  backup.respaldo_sha256=require('node:crypto').createHash('sha256').update(JSON.stringify(backup)).digest('hex');
  const request={id:'test',autorizado:true,catalog_id:CATALOG,respaldo_sha256:backup.respaldo_sha256,targets:backup.colecciones.map((c,i)=>({familia:c.familia,prioridad:i+1,old_id:c.conjunto_original.id,retailer_id:c.conjunto_original.retailer_id}))};
  const target=f.api.sets.find(s=>s.id===request.targets[18].old_id);target[change]=change==='name'?'CAMBIO_AJENO':['9000'];
  await assert.rejects(recreate({request,backup,plan:{...f.plan,catalog_id:CATALOG},api:f.api,wait:async()=>{}}),/RESPALDO_DESACTUALIZADO/);
  assert.equal(f.api.calls.filter(c=>c.method==='DELETE').length,0);
 }
});
