'use strict';
const assert=require('node:assert/strict'),api=require('./rotacion.js');let checks=0;
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks++};
const pool=Array.from({length:240},(_,i)=>({sku:'SKU'+String(i).padStart(4,'0'),commercialCategory:'Categoría '+i%12,promo:[8,30,180][i%3],actualizadoEn:'2026-10-20T12:00:00Z'})),config={cantidadVitrina:5,cantidadDestacados:5,evitarRepetirDias:7},snapshot=JSON.stringify(pool),recent=[];
for(let day=0;day<380;day++){
 const date=new Date(Date.UTC(2026,0,1)+day*86400000).toISOString().slice(0,10),plan=api.resolver(pool,config,date),all=[...plan.vitrina,...plan.destacados];
 check(date+' dos selecciones completas y distintas',[plan.vitrina.length,plan.destacados.length,new Set(all).size],[5,5,10]);
 check(date+' siete días sin repetir',all.some(s=>recent.flat().includes(s)),false);
 for(const key of ['vitrina','destacados'])check(date+' variedad '+key,new Set(plan[key].map(s=>pool.find(p=>p.sku===s).commercialCategory)).size>=4,true);
 recent.push(all);if(recent.length>7)recent.shift();
}
const today=api.resolver(pool,config,'2026-10-26');check('Mismo día y orden de entrada diferente',api.resolver([...pool].reverse(),config,'2026-10-26'),today);
check('No escribe los productos ni fechas',JSON.stringify(pool),snapshot);
const changed=api.resolver(pool,config,'2026-10-26');changed.vitrina.length=0;check('El consumidor no puede modificar el plan guardado',api.resolver(pool,config,'2026-10-26'),today);
const pins={...config,fijadosVitrina:['NOEXISTE',pool[0].sku,pool[0].sku],fijadosDestacados:[pool[0].sku,pool[1].sku]},fixed=api.resolver(pool,pins,'2026-10-26');check('Fijación válida de vitrina',fixed.vitrina[0],pool[0].sku);check('Fijación complementaria sin duplicado',fixed.destacados[0],pool[1].sku);check('Sin duplicados con fijaciones',new Set([...fixed.vitrina,...fixed.destacados]).size,10);
const excessive=api.resolver(pool,{...config,fijadosVitrina:pool.slice(0,8).map(p=>p.sku),fijadosDestacados:[pool[6].sku]},'2026-10-26');check('Fijaciones que exceden cupo no bloquean otra sección',excessive.destacados[0],pool[6].sku);
for(const count of [0,1,6,12,35]){const limited=pool.slice(0,count),plan=api.resolver(limited,config,'2026-10-26'),all=[...plan.vitrina,...plan.destacados];check('Inventario escaso '+count,all.length,Math.min(10,count));check('Sin duplicados con inventario escaso '+count,new Set(all).size,all.length)}
const leadConfig={...config,categoriasApertura:['Categoría 0','Categoría 1','Categoría 2','Categoría 3']},leadGroups=new Set();
for(let day=0;day<14;day++){const date=new Date(Date.UTC(2026,9,20)+day*86400000).toISOString().slice(0,10),plan=api.resolver(pool,leadConfig,date);for(const key of ['vitrina','destacados']){const group=pool.find(p=>p.sku===plan[key][0]).commercialCategory;check(date+' apertura comercial '+key,leadConfig.categoriasApertura.includes(group),true);leadGroups.add(group)}}
check('Apertura cambia entre familias',leadGroups.size,4);
assert.throws(()=>api.resolver(pool,config,'2026-02-30'));checks++;
console.log(checks+' comprobaciones de rotación diaria, siete días, variedad, fijaciones y conservación correctas.');
