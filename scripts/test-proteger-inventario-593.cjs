'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {comprobar}=require('./proteger-inventario-593.cjs');
const commercial=require('./aplicar-corte-comercial-593.cjs'),stock=require('./aplicar-corte-stock.cjs');
let checks=0;
const products=n=>Array.from({length:n},(_,i)=>({sku:'TEST'+String(i).padStart(5,'0'),stock:1,promo:2.5,pvp:2.87,name:'Producto verificado'}));
const html=all=>'const products='+JSON.stringify(all)+';\n';
function cut(all,zeros=0){return {fecha_corte:'2026-11-03',sha256_original:'a'.repeat(64),cantidad_sku_web:all.length,cantidad_sku_original:all.length,productos:Object.fromEntries(all.map((p,i)=>[p.sku,{stock:i<zeros?0:1,promo_centavos:250,pvp_centavos:287}])),verificacion:{stock_cambiado:zeros,disponibilidad_cambiada:zeros,promo_cambiado:0,pvp_cambiado:0,precios_productos_cambiados:0}};}
function test(name,fn){fn();checks++;console.log('OK '+name);}
test('299, 300 y 499 no constituyen un reporte completo',()=>{for(const n of [299,300,499])assert.throws(()=>comprobar({before:[],after:products(n),sourceSkus:products(n).map(p=>p.sku),sourceCount:n}),/BELOW_MINIMUM/);});
test('500 y 501 cumplen el mínimo genérico',()=>{for(const n of [500,501])assert.equal(comprobar({before:products(n),after:products(n),sourceSkus:products(n).map(p=>p.sku),sourceCount:n}).productos_unicos,n);});
test('duplicados no inflan la cobertura',()=>assert.throws(()=>comprobar({before:[],after:products(499),sourceSkus:[...products(499).map(p=>p.sku),'TEST00000'],sourceCount:500}),/DUPLICATE/));
test('500 de 1573 se rechaza por cobertura relativa',()=>assert.throws(()=>comprobar({before:products(1573),after:products(500),sourceSkus:products(500).map(p=>p.sku),sourceCount:500}),/INCOMPLETE_FULL_REPORT/));
test('499 bajas pasan y 500 se bloquean en publicador comercial',()=>{const all=products(1000);assert.equal(commercial.prepare(html(all),cut(all,499),null).changed.length,499);assert.throws(()=>commercial.prepare(html(all),cut(all,500),null),/MASS_UNAVAILABILITY/);});
test('500 bajas se bloquean en publicador de cantidades',()=>{const all=products(1000),c=cut(all,500);assert.throws(()=>stock.planificar(html(all),{fecha_corte:c.fecha_corte,sha256:c.sha256_original,cantidad_sku:1000,stock_por_sku:Object.fromEntries(Object.entries(c.productos).map(([s,p])=>[s,p.stock]))},null),/MASS_UNAVAILABILITY/);});
test('ceros existentes conservados no se cuentan como nuevas bajas',()=>{const all=products(1000).map(p=>({...p,stock:0}));assert.equal(comprobar({before:all,after:all,sourceSkus:all.map(p=>p.sku),sourceCount:1000}).ausentes_o_nuevos_no_disponibles,0);});
test('conserva restricciones anteriores de al menos 1000 en publicadores',()=>{const all=products(500);assert.throws(()=>commercial.prepare(html(all),cut(all),null),/Cobertura/);assert.throws(()=>stock.planificar(html(all),{fecha_corte:'2026-11-03',sha256:'a'.repeat(64),cantidad_sku:500,stock_por_sku:Object.fromEntries(all.map(p=>[p.sku,1]))},null),/incompleto/);});
test('rechazo CLI con APLICAR conserva archivos y recuperación posterior correcta',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'593-reject-'));
 try{
  fs.mkdirSync(path.join(dir,'scripts'));fs.mkdirSync(path.join(dir,'datos-593'));
  for(const script of ['aplicar-corte-comercial-593.cjs','aplicar-corte-stock.cjs','sincronizar-593.cjs','proteger-inventario-593.cjs'])fs.copyFileSync(path.join(__dirname,script),path.join(dir,'scripts',script));
  const all=products(1000),prior={fecha_corte:'2026-11-02',origen_sha256:'b'.repeat(64)},initial=html(all);
  fs.writeFileSync(path.join(dir,'index.html'),initial);fs.writeFileSync(path.join(dir,'datos-593/estado-ultimo-corte.json'),JSON.stringify(prior));
  const snapshot=()=>['index.html','datos-593/estado-ultimo-corte.json'].map(p=>fs.readFileSync(path.join(dir,p),'utf8'));
  const preserved=snapshot();
  for(const script of ['aplicar-corte-comercial-593.cjs','aplicar-corte-stock.cjs','sincronizar-593.cjs']){
   for(const size of [300,1000]){
    const current=products(size),c=cut(current,size===1000?500:0);
    fs.writeFileSync(path.join(dir,'datos-593/corte-comercial-publico-validado.json'),JSON.stringify(c));
    fs.writeFileSync(path.join(dir,'datos-593/corte-stock-validado.json'),JSON.stringify({fecha_corte:c.fecha_corte,sha256:c.sha256_original,cantidad_sku:size,stock_por_sku:Object.fromEntries(Object.entries(c.productos).map(([s,p])=>[s,p.stock]))}));
    fs.writeFileSync(path.join(dir,'datos-593/inventario-publico.csv'),'sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion,promo_contado,pvp_final\n'+current.map((p,i)=>[p.sku,p.name,size===1000&&i<500?0:1,2.5,15,'PRODUCTO','Accesorios','Accesorios',2.5,2.87].join(',')).join('\n'));
    const result=spawnSync(process.execPath,['scripts/'+script],{cwd:dir,encoding:'utf8',env:{...process.env,APLICAR_COMERCIAL_593:'SI',APLICAR_STOCK_593:'SI',APLICAR_CAMBIOS:'SI',CONFIRMAR:'APLICAR'}});
    assert.notEqual(result.status,0,script+' debe rechazar '+size);assert.deepEqual(snapshot(),preserved);
   }
  }
  fs.writeFileSync(path.join(dir,'datos-593/corte-comercial-publico-validado.json'),JSON.stringify(cut(all)));
  const result=spawnSync(process.execPath,['scripts/aplicar-corte-comercial-593.cjs'],{cwd:dir,encoding:'utf8',env:{...process.env,APLICAR_COMERCIAL_593:'SI'}});
  assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),initial);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'datos-593/estado-ultimo-corte.json'))).origen_sha256,'a'.repeat(64));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('corte real vigente pasa sin modificar stock, precios ni fechas',()=>{
 const source=path.join(__dirname,'../datos-593/corte-comercial-publico-validado.json');
 if(!fs.existsSync(source))return;
 const currentHtml=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),prior=JSON.parse(fs.readFileSync(path.join(__dirname,'../datos-593/estado-ultimo-corte.json'))),c=JSON.parse(fs.readFileSync(source));
 const result=commercial.prepare(currentHtml,c,prior);assert.equal(result.html,currentHtml);assert.equal(result.changed.length,0);assert.equal(result.summary.origen_sha256,prior.origen_sha256);assert.equal(result.summary.fecha_corte,prior.fecha_corte);
});
console.log(checks+' pruebas de protección 593 aprobadas; ninguna escritura de producción.');
