'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {MASTER,SECONDARY,compare,readBoth,main}=require('./comparar-categorias-secundario-meta.cjs');
const sets=[{id:'1',name:'CONECTATECH | CELULARES',retailer_id:'conectatech-web:celulares',filter:{label:'a'}},{id:'2',name:'CONECTATECH | TABLETS',retailer_id:'conectatech-web:tablets',filter:{label:'b'}}],products=[{id:'9',retailer_id:'SKU1',price:'10.00 USD',availability:'in stock'}];
test('distingue igualdad de inventario, filtros, nombres y orden',()=>{
 const master={sets,products},secondary={sets:[{...sets[1],id:'12'},{...sets[0],id:'11',name:'OTRO'}],products:[{...products[0],id:'99'}]};
 const r=compare(master,secondary);assert.equal(r.sku_precio_disponibilidad_iguales,true);assert.equal(r.orden_igual,false);assert.equal(r.categorias[0].nombre_igual,false);assert.equal(r.categorias[0].filtro_igual,true);
 assert.equal(r.orden_visible_en_whatsapp_verificado,false);
 secondary.products[0].price='11.00 USD';assert.equal(compare(master,secondary).sku_precio_disponibilidad_iguales,false);
});
test('rechaza categorías duplicadas y conserva los objetos de origen',()=>{
 const input={sets,products},before=JSON.stringify(input);compare(input,input);assert.equal(JSON.stringify(input),before);
 assert.throws(()=>compare({...input,sets:[sets[0],sets[0]]},input),/DUPLICADAS/);
});
test('la comparación usa exclusivamente GET y el secreto secundario sin reserva',async()=>{
 let n=0;const none=await main({env:{META_ACCESS_TOKEN:'NO_USAR'},transport:async()=>{n++;},log:()=>{}});assert.equal(n,0);assert.equal(none.estado,'SIN_CREDENCIAL_SECUNDARIA');
 const result=await readBoth({token:'SECONDARY_FAKE',transport:async(url,opt)=>{
  n++;assert.equal(opt.method,'GET');assert.equal(opt.headers.Authorization,'Bearer SECONDARY_FAKE');assert.equal(url.searchParams.has('access_token'),false);assert.equal(opt.redirect,'error');
  const path=url.pathname.replace('/v26.0/','');assert.ok([MASTER,SECONDARY,MASTER+'/product_sets',SECONDARY+'/product_sets',MASTER+'/products',SECONDARY+'/products'].includes(path));
  const data=path.includes('/product_sets')?{data:sets}:path.includes('/products')?{data:products}:{id:path,name:path===MASTER?'CONECTATECH | Catálogo Maestro':'CONECTATECH | Catálogo WhatsApp 0964206977'};
  return new Response(JSON.stringify(data));
 }});assert.equal(n,6);assert.equal(result.comparison.orden_igual,true);
});
