'use strict';
/* Aplica solamente stock, Promo Contado, PVP y fecha del ultimo Excel 593 validado.
 * NO publicar Excel/costos, NO regenerar nombres, imagenes, SKU o URLs.
 */
const fs=require('fs');
const INPUT='datos-593/corte-comercial-publico-validado.json';
const STATE='datos-593/estado-ultimo-corte.json';
const WEB='index.html';
const RX=/const products=(\[[\s\S]*?\]);\s*\n/;
function prepare(html,cut,prior){
 if(!cut||!/^20\d{2}-\d{2}-\d{2}$/.test(cut.fecha_corte)||!/^[a-f0-9]{64}$/.test(cut.sha256_original))throw Error('Fuente o fecha invalida');
 if(prior?.fecha_corte>cut.fecha_corte)throw Error('Retroceso de fecha de inventario');
 if(prior?.fecha_corte===cut.fecha_corte&&prior?.origen_sha256!==cut.sha256_original)throw Error('Corte con igual fecha y distinta fuente: revision necesaria');
 const m=html.match(RX);if(!m)throw Error('No se encontro array de productos');
 const all=JSON.parse(m[1]);
 const by=Object.keys(cut.productos||{});
 if(all.length!==cut.cantidad_sku_web||all.length!==by.length||all.length<1000)throw Error('Cobertura de SKU insuficiente');
 if(cut.cantidad_sku_original<cut.cantidad_sku_web||cut.cantidad_sku_original<1000)throw Error('Excel no completo');
 const seen=new Set(),before=new Map(),updated=[];
 for(const p of all){
  if(seen.has(p.sku))throw Error('Duplicado '+p.sku);
  seen.add(p.sku);
  const src=cut.productos[p.sku];
  if(!src)throw Error('Falta SKU: '+p.sku);
  const {stock,promo_centavos,pvp_centavos}=src;
  if(!Number.isInteger(stock)||stock< -10000||stock>1000000||
     !Number.isInteger(promo_centavos)||promo_centavos<0||
     !Number.isInteger(pvp_centavos)||pvp_centavos<0)throw Error('Valores invalidos '+p.sku);
  before.set(p.sku,p);
  updated.push({...p,stock,promo:promo_centavos/100,pvp:pvp_centavos/100});
 }
 const diff=updated.filter(p=>p.stock!==before.get(p.sku).stock||
    Math.round(p.promo*100)!==Math.round(before.get(p.sku).promo*100)||
    Math.round(p.pvp*100)!==Math.round(before.get(p.sku).pvp*100));
 const changedStock=updated.filter(p=>p.stock!==before.get(p.sku).stock).length;
 const changedAvailability=updated.filter(p=>(p.stock>0)!==(before.get(p.sku).stock>0)).length;
 const changedPromo=updated.filter(p=>Math.round(p.promo*100)!==Math.round(before.get(p.sku).promo*100)).length;
 const changedPvp=updated.filter(p=>Math.round(p.pvp*100)!==Math.round(before.get(p.sku).pvp*100)).length;
 const changedPrice=updated.filter(p=>Math.round(p.promo*100)!==Math.round(before.get(p.sku).promo*100)||Math.round(p.pvp*100)!==Math.round(before.get(p.sku).pvp*100)).length;
 const already=prior?.origen_sha256===cut.sha256_original&&prior?.fecha_corte===cut.fecha_corte;
 if(already&&diff.length)throw Error('Corte ya aplicado pero hay diferencias en web; no revertir');
 if(!already){
  const v=cut.verificacion||{};
  for(const [k,n] of Object.entries({stock_cambiado:changedStock,disponibilidad_cambiada:changedAvailability,promo_cambiado:changedPromo,pvp_cambiado:changedPvp,precios_productos_cambiados:changedPrice}))
   if(v[k]!==n)throw Error('Control incorrecto '+k+': '+n+' != '+v[k]);
 }
 for(let i=0;i<all.length;i++){
  const a={...all[i]},b={...updated[i]};
  for(const k of ['stock','promo','pvp']){delete a[k];delete b[k];}
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Campo no comercial alterado '+all[i].sku);
 }
 const summary={
  fecha_corte:cut.fecha_corte,origen_sha256:cut.sha256_original,sku_fuente:cut.cantidad_sku_original,
  sku_web:updated.length,cambios_stock:already?prior.cambios_stock:changedStock,
  cambios_disponibilidad:already?prior.cambios_disponibilidad:changedAvailability,
  cambios_promo:already?prior.cambios_promo:changedPromo,
  cambios_pvp:already?prior.cambios_pvp:changedPvp,
  cambios_productos_precio:already?prior.cambios_productos_precio:changedPrice,
  con_stock:updated.filter(p=>p.stock>0).length,stock_cero:updated.filter(p=>p.stock===0).length,
  stock_negativo:updated.filter(p=>p.stock<0).length,fecha_precios:cut.fecha_corte,
  demas_atributos_intactos:true,referencia:'datos-593/corte-comercial-publico-validado.json'
 };
 return {summary,html:html.replace(m[0],'const products='+JSON.stringify(updated)+';\n'),changed:diff};
}
function run(){
 const cut=JSON.parse(fs.readFileSync(INPUT,'utf8'));
 const prior=fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,'utf8')):null;
 const previous=fs.readFileSync(WEB,'utf8');
 const result=prepare(previous,cut,prior);
 if(process.env.APLICAR_COMERCIAL_593==='SI'){
  if(previous!==result.html)fs.writeFileSync(WEB,result.html);
  fs.writeFileSync(STATE,JSON.stringify(result.summary,null,2)+'\n');
 }
 console.log(JSON.stringify({modo:process.env.APLICAR_COMERCIAL_593==='SI'?'APLICADO':'SIMULADO',...result.summary},null,2));
 return result;
}
module.exports={prepare,run};
if(require.main===module)run();
