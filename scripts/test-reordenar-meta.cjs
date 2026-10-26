'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {recreate}=require('./reordenar-seis-colecciones-meta.cjs');
const {Graph}=require('./sincronizar-conjuntos-meta.cjs');
const C='1036301566100990',families=['Celulares y Smartphones','Tablets','Televisores','Monitores','Smartwatches y Wearables','Almacenamiento'];
function fixture(){
 const sets=families.map((family,i)=>({id:String(100+i),name:family,retailer_id:'ct-test:'+i,filter:{custom_label_0:{eq:'label'+i}},ordering_info:[String(900+i)]}));
 const backup={catalogo:{id:C},colecciones:sets.map((s,i)=>({familia:families[i],conjunto_original:structuredClone(s)}))};
 backup.respaldo_sha256=crypto.createHash('sha256').update(JSON.stringify(backup)).digest('hex');
 const request={id:'test-autorizado',autorizado:true,catalog_id:C,respaldo_sha256:backup.respaldo_sha256,targets:sets.map((s,i)=>({prioridad:i+1,familia:families[i],old_id:s.id,retailer_id:s.retailer_id}))};
 const plan={catalog_id:C,fecha_corte:'2026-10-25',groups:sets.map((s,i)=>({retailer_id:s.retailer_id,filter:s.filter,sku:['SKU'+i]}))};
 const products=sets.map((s,i)=>({id:String(900+i),retailer_id:'SKU'+i,price:'10',availability:'in stock'}));
 sets.push({id:'800',name:'Otra colección',retailer_id:'otra',filter:{},ordering_info:[]},{id:'999',name:'All Products',filter:{}});
 const calls=[];let seq=200,loseReply=false,deleteFail=null,mutate=false;
 const api={sets,products,calls,set loseReply(v){loseReply=v;},set deleteFail(v){deleteFail=v;},set mutate(v){mutate=v;},
  async list(path){
   calls.push({method:'GET',path});
   if(path===C+'/product_sets')return structuredClone(sets);
   if(path===C+'/products')return structuredClone(products);
   const set=sets.find(s=>s.id===path.split('/')[0]);if(!set)throw Error('SET_AUSENTE');
   const i=Number(set.retailer_id.split(':')[1]);return [{id:String(900+i),retailer_id:'SKU'+i}];
  },async request(method,path,params={}){
   calls.push({method,path});
   if(path===C&&method==='GET')return {id:C,name:'CONECTATECH | Catálogo Maestro'};
   if(method==='DELETE'){
    if(path===deleteFail)throw Error('BORRADO_DENEGADO');
    const i=sets.findIndex(s=>s.id===path);assert(i>=0);sets.splice(i,1);return {success:true};
   }
   if(method==='POST'){
    assert.equal(path,C+'/product_sets');const id=String(seq++),order=JSON.parse(params.ordering_info||'[]').map(String);
    sets.unshift({id,...structuredClone(params),ordering_info:order});if(mutate)products[0].price='20';
    if(loseReply){loseReply=false;throw Error('RESPUESTA_PERDIDA');}return {id};
   }
   const s=sets.find(s=>s.id===path);if(!s)throw Error('SET_AUSENTE');return {...structuredClone(s),product_catalog:{id:C}};
  }};
 return {request,backup,plan,api};
}
(async()=>{
 const x=fixture();let saved;
 const result=await recreate({...x,wait:async()=>{},onState:s=>saved=s});
 assert.equal(result.estado,'RECREACION_META_VERIFICADA');assert.equal(result.productos_sin_cambios,6);assert(result.orden_lista_meta_coincide);
 assert.deepEqual(x.api.calls.filter(c=>c.method==='DELETE').map(c=>c.path),['105','104','103','102','101','100']);
 assert.equal(x.api.calls.filter(c=>c.method==='POST').length,6);assert.equal(x.api.sets.length,8);
 assert(x.api.sets.some(s=>s.id==='999'));assert(x.api.sets.some(s=>s.id==='800'));assert.equal(result.orden_whatsapp_verificado,false);
 const count=x.api.calls.length;await recreate({...x,state:saved});assert.equal(x.api.calls.length,count,'Una operación completada no se repite');
 const denied=fixture();denied.request.autorizado=false;await assert.rejects(()=>recreate(denied),/AUTORIZACION/);assert.equal(denied.api.calls.length,0);
 const changed=fixture();changed.api.sets[0].filter={otro:true};await assert.rejects(()=>recreate(changed),/FILTRO_DISTINTO/);assert(!changed.api.calls.some(c=>c.method==='DELETE'));
 const partial=fixture();partial.api.deleteFail='103';let checkpoint;
 await assert.rejects(()=>recreate({...partial,onState:s=>checkpoint=s,wait:async()=>{}}),/BORRADO_DENEGADO/);
 assert.equal(partial.api.calls.filter(c=>c.method==='POST').length,2);
 partial.api.deleteFail=null;const resumed=await recreate({...partial,state:checkpoint,wait:async()=>{}});assert.equal(resumed.estado,'RECREACION_META_VERIFICADA');
 assert.equal(partial.api.calls.filter(c=>c.method==='POST').length,6,'Reanudar conserva los dos reemplazos ya creados');
 const lost=fixture();lost.api.loseReply=true;await recreate({...lost,wait:async()=>{}});assert.equal(lost.api.calls.filter(c=>c.method==='POST').length,6,'Una respuesta perdida no crea un duplicado');
 const mutated=fixture();mutated.api.mutate=true;await assert.rejects(()=>recreate({...mutated,wait:async()=>{}}),/PRODUCTOS_CAMBIARON/);
 const transport=async()=>({ok:true,json:async()=>({success:true})});
 const graph=new Graph({token:'secret-test',version:'v26.0',transport,deletableProductSetIds:['105']});
 await graph.request('DELETE','105');await assert.rejects(()=>graph.request('DELETE',C),/fuera de alcance/);await assert.rejects(()=>graph.request('DELETE','105/products'),/fuera de alcance/);
 console.log('Recreación Meta: seis conjuntos autorizados, prevalidación completa, conservación de productos y otros conjuntos, reanudación, idempotencia y respuesta perdida verificadas.');
})().catch(e=>{console.error(e);process.exitCode=1});
