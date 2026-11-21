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
test('diagnostica sólo los SKU estrictos exclusivos del secundario sin alterar inventarios',()=>{
 const master={sets,products:[{...products[0],retailer_id:'AUDI091'}]},extras=['FLAS013','FLAS014','FLAS017','FLAS033','FOCO004'];
 const secondary={sets,products:[...master.products,...[...extras,'FLAS013'].map((sku,i)=>({id:String(100+i),retailer_id:sku,price:'PRIVADO',availability:'in stock'}))]},before=JSON.stringify({master,secondary});
 const r=compare(master,secondary);assert.deepEqual(r.sku_extra_secundario,extras);assert.equal(r.sku_precio_disponibilidad_iguales,false);assert.equal(r.solo_lectura,true);assert.equal(JSON.stringify({master,secondary}),before);assert(!JSON.stringify(r.sku_extra_secundario).includes('PRIVADO'));
});
test('los SKU de diagnóstico no exponen URLs, tokens, IDs ni texto libre',()=>{
 const invalid=['https://private.example/TELF012?token=NEVER_DISCLOSE','Bearer SECONDARY_FAKE','NEVER_DISCLOSE','TELF012_EXTRA','123456789123456789','AB123456','ABCDEFG12',null];
 const master={sets,products},secondary={sets,products:[...products,...invalid.map((retailer_id,i)=>({id:String(100+i),retailer_id,price:'PRIVADO',availability:'in stock'}))]};
 assert.deepEqual(compare(master,secondary).sku_extra_secundario,[]);
});
test('la comparación usa exclusivamente GET y el secreto secundario sin reserva',async()=>{
 let n=0;const none=await main({env:{META_ACCESS_TOKEN:'NO_USAR'},transport:async()=>{n++;},log:()=>{}});assert.equal(n,0);assert.equal(none.estado,'SIN_CREDENCIAL_SECUNDARIA');
 const result=await readBoth({token:'SECONDARY_FAKE',transport:async(url,opt)=>{
  n++;assert.equal(opt.method,'GET');assert.equal(opt.headers.Authorization,'Bearer SECONDARY_FAKE');assert.equal(url.searchParams.has('access_token'),false);assert.equal(opt.redirect,'error');
  const path=url.pathname.replace('/v26.0/','');assert.ok([MASTER,SECONDARY,MASTER+'/product_sets',SECONDARY+'/product_sets',MASTER+'/products',SECONDARY+'/products'].includes(path));
  const data=path.includes('/product_sets')?{data:sets}:path.includes('/products')?{data:path===SECONDARY+'/products'?[...products,{id:'88',retailer_id:'FLAS014',price:'PRIVADO',availability:'in stock'}]:products}:{id:path,name:path===MASTER?'CONECTATECH | Catálogo Maestro':'CONECTATECH | Catálogo WhatsApp 0964206977'};
  return new Response(JSON.stringify(data));
 }});assert.equal(n,6);assert.equal(result.comparison.orden_igual,true);assert.deepEqual(result.comparison.sku_extra_secundario,['FLAS014']);
});
