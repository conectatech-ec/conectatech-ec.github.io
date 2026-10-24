const assert=require('node:assert/strict');
const {planificar}=require('./colecciones-whatsapp.cjs');
const products=[
 {sku:'A',stock:2,promo:1,pvp:2,imageUrl:'/a.webp'},
 {sku:'B',stock:0,promo:1,pvp:2,imageUrl:'/b.webp'},
 {sku:'C',stock:1,promo:1,pvp:2},
 {sku:'D',stock:1,promo:1,pvp:2,imageUrl:'/d.webp'},
 {sku:'E',stock:1,promo:1,pvp:2,imageUrl:'/e.webp'}
];
for(const p of products)p.name='Producto '+p.sku;
const args={products,content:Object.fromEntries(products.map(p=>[p.sku,{comercialVerificado:p.sku!=='E'}])),
 masterCategories:new Map([['A','MICROFONOS'],['B','PILAS'],['C','TELEFONOS'],['D',''],['E','AUDIFONOS'],['NUEVO','TABLETS']]),
 urls:Object.fromEntries(products.map(p=>[p.sku,p.sku])),inventoryState:{fecha_corte:'2026-10-22',origen_sha256:'a'.repeat(64)}};
const result=planificar(args);
assert.deepEqual(result.colecciones,{'Micrófonos y creación de contenido':['A']});
assert(result.registros.find(p=>p.sku==='B').estados.includes('AGOTADO'));
assert(result.registros.find(p=>p.sku==='C').estados.includes('PENDIENTE_IMAGEN'));
assert.equal(result.registros.find(p=>p.sku==='D').coleccion_propuesta,null);
assert.equal(result.registros.length,products.length+1);
assert.equal(result.cobertura.sku_sin_ficha,1);
assert.equal(result.registros.find(p=>p.sku==='NUEVO').candidato,false);
assert.equal(result.limite_efectivo,null);assert.equal(result.visibles_whatsapp,null);
assert.equal(result.publicacion_habilitada,false);assert.equal(result.colecciones_automaticas_verificadas,false);
assert(result.registros.every(p=>!p.estados.includes('VERIFICADO')));
assert.deepEqual(result.ofertas_destacadas.sku,[]);
assert.throws(()=>planificar({...args,products:[products[0],products[0]]}),/duplicado/);
assert.throws(()=>planificar({...args,inventoryState:null}),/corte validado/);
console.log('Colecciones: categorías maestras, agotados, imagen, aprobación, duplicados y bloqueo de publicación verificados.');

const pending=planificar({...args,content:{...args.content,A:{comercialVerificado:true,imagenPendiente:true}}});
assert.equal(pending.registros.find(p=>p.sku==='A').candidato,false);
const badImage=planificar({...args,content:{...args.content,A:{comercialVerificado:true,imagen:'javascript:alert(1)'}}});
assert.equal(badImage.registros.find(p=>p.sku==='A').candidato,false);
