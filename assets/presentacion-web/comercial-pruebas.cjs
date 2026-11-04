'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),commercial=require('./comercial.js'),rotation=require('./rotacion.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/config.js','utf8'),ctx);const cfg=JSON.parse(JSON.stringify(ctx.window.CONECTATECH_PRESENTACION));let checks=0;
const check=(label,a,b)=>{assert.deepEqual(a,b,label);checks++};
const categories=['Telefonos','Tablets','Monitores','Discos','Relojes','Audifonos','Powerbanks','Teclados','Flash','Juguetes','Chips','Cables'];
const pool=categories.flatMap((category,g)=>Array.from({length:24},(_,i)=>({sku:'SKU'+g+'_'+i,category,stock:1,promo:20+i,pvp:30+i,imageUrl:'/imagenes/sku.webp',priority:i===0?'ALTA':'MEDIA',role:'CAPTADOR'})));
const eligible=p=>p.stock>0&&Boolean(p.imageUrl),snapshot=JSON.stringify(pool),ranked=commercial.ordenar(pool,eligible);
check('No pierde productos',ranked.length,pool.length);check('Cada SKU aparece una vez',new Set(ranked.map(p=>p.sku)).size,pool.length);check('No modifica objetos ni orden de datos',JSON.stringify(pool),snapshot);
for(let page=0;page<3;page++){
 const items=ranked.slice(page*24,(page+1)*24),groups=new Set(items.map(commercial.familia));
 check('Página '+(page+1)+' sin complementos marginales',items.some(p=>['Juguetes','Chips','Cables'].includes(p.category)),false);
 for(const family of ['celulares','tablets','pantallas','almacenamiento','smartwatch','audio','energia','computacion'])check('Página '+(page+1)+' incluye '+family,groups.has(family),true);
}
const unavailable={...pool[0],sku:'AGOTADO',stock:0},missing={...pool[1],sku:'SINFOTO',imageUrl:''};
check('Agotados y sin foto no se promocionan',commercial.ordenar([unavailable,missing,...pool],eligible).slice(0,72).some(p=>['AGOTADO','SINFOTO'].includes(p.sku)),false);
check('Cola conserva orden recibido',ranked.slice(72).map(p=>p.sku),pool.filter(p=>!new Set(ranked.slice(0,72).map(p=>p.sku)).has(p.sku)).map(p=>p.sku));
check('Nunca mezcla categorías filtradas',commercial.ordenar(pool.filter(p=>p.category==='Audifonos'),eligible).every(p=>p.category==='Audifonos'),true);
const options={...cfg.rotacionDiaria,...cfg.prioridadComercial.rotacion},candidates=pool.filter(commercial.protagonista).map(p=>({...p,familiaPrioritaria:commercial.familia(p)}));let prior;
for(let d=0;d<30;d++){
 const date=new Date(Date.UTC(2026,10,1+d)).toISOString().slice(0,10),plan=rotation.resolver(candidates,options,date),all=[...plan.vitrina,...plan.destacados];
 check(date+' 10 distintos',new Set(all).size,10);
 for(const section of ['vitrina','destacados']){check(date+' teléfono abre '+section,commercial.familia(candidates.find(p=>p.sku===plan[section][0])),'celulares');check(date+' sin artículos periféricos '+section,plan[section].every(s=>commercial.protagonista(candidates.find(p=>p.sku===s))),true)}
 check(date+' determinista al invertir entrada',rotation.resolver([...candidates].reverse(),options,date),plan);
 if(prior)check(date+' renovación diaria',all.join(',')!==prior.join(','),true);prior=all;
}
const scarce=candidates.filter(p=>p.category!=='Telefonos'||p.sku.endsWith('_0'));
for(let d=0;d<8;d++){const date='2026-11-'+String(d+1).padStart(2,'0'),plan=rotation.resolver(scarce,options,date);check('Familia escasa no bloquea '+date,new Set([...plan.vitrina,...plan.destacados]).size,10)}
check('Clasifica televisor real',commercial.familia({sku:'TELE001',category:'Tv'}),'pantallas');check('No confunde TV stick con televisor',commercial.familia({sku:'TVBO007',category:'Tv'}),'entretenimiento');
check('Entradas vacías',commercial.ordenar([],eligible),[]);check('Input sin cambios tras rotación',JSON.stringify(pool),snapshot);
const limited=pool.filter(p=>!['Juguetes','Chips','Cables'].includes(p.category)&&(!['Telefonos','Tablets','Monitores','Discos'].includes(p.category)||Number(p.sku.split('_')[1])<({Telefonos:18,Tablets:4,Monitores:2,Discos:4}[p.category])))
 .concat(Array.from({length:12},(_,i)=>({sku:'MICRTEST'+i,category:'Microfonos',stock:1,promo:30,priority:'MEDIA',role:'CAPTADOR',imageUrl:'/imagenes/x.webp'})),Array.from({length:12},(_,i)=>({sku:'TVBO_TEST'+i,category:'Tv',stock:1,promo:45,priority:'MEDIA',role:'CAPTADOR',imageUrl:'/imagenes/x.webp'})));
const balanced=commercial.ordenar(limited,eligible);
for(let page=0;page<3;page++){const items=balanced.slice(page*24,(page+1)*24),counts={};items.forEach(p=>{const g=commercial.familia(p);counts[g]=(counts[g]||0)+1});check('Stock escaso conserva seis teléfonos en página '+page,counts.celulares,6);check('Stock escaso evita acumulación en página '+page,Math.max(...Object.values(counts))<=6,true)}
check('Respeta clasificación comercial verificada',commercial.familia({category:'Audifonos',categoriaComercial:'Fotografía y Creación de Contenido'}),'creacion');
const editorial={};editorial.window=editorial;vm.runInNewContext(fs.readFileSync(__dirname+'/rotacion.js','utf8'),editorial);const original=editorial.CONECTATECH_ROTACION.resolver;
vm.runInNewContext(fs.readFileSync(__dirname+'/../editorial-prioridad.js','utf8'),editorial);
check('La capa de novedades sigue disponible',editorial.CONECTATECH_ROTACION.resolver===original,false);
check('La selección comercial conserva su función independiente',editorial.CONECTATECH_ROTACION.resolverPrioritario===original,true);
const wrapped=editorial.CONECTATECH_ROTACION.resolverPrioritario(candidates,options,'2026-11-03');check('Teléfono de apertura incluso con capa editorial',commercial.familia(candidates.find(p=>p.sku===wrapped.vitrina[0])),'celulares');
console.log(checks+' comprobaciones de prioridad comercial, tres páginas y rotación estratégica correctas.');
