'use strict';
// Presentación comercial del mismo catálogo. No contiene precios, existencias ni copias de productos.
const priority=['Celulares y Smartphones','Tablets','Televisores','Monitores','Smartwatches y Wearables','Almacenamiento','Audio y Audífonos','Cargadores y Energía','Computación y Periféricos','TV y Entretenimiento','Seguridad y Cámaras','Redes e Internet','Fotografía y Creación de Contenido','Cables y Conectividad','Soportes y Accesorios','Protección para Dispositivos','Hogar y Accesorios','Iluminación','Gaming y Videojuegos','Juguetes y Coleccionables','Deportes'];
// TELE002/003 están publicados en Otros/Hogar. Sus fichas aprobadas identifican televisores;
// reunirlos aquí no modifica categoriaComercial, product_type ni la web.
const televisions=new Set(['TELE001','TELE002','TELE003']);
const preferred={
 'Celulares y Smartphones':['TELF018','TELF011','TELF036'],
 'Tablets':['TABL001','TABL004','TABL002'],
 'Televisores':['TELE003','TELE002','TELE001'],
 'Monitores':['MONI005'],
 'Smartwatches y Wearables':['REL046','REL069','REL041'],
 'Almacenamiento':['FLAS014','DISC004','TARJ002'],
 'Audio y Audífonos':['AUDI055','AUDI016','AUDI112'],
 'Cargadores y Energía':['CARG029','CARG018','POWE014'],
 'Computación y Periféricos':['TECL005','MOUS037','PRES001'],
 'TV y Entretenimiento':['TVBO010','PROY007','TVBO008'],
 'Seguridad y Cámaras':['CAMA007','CAMA008','CAMA003'],
 'Redes e Internet':['ROUT001','EXTE002','SWIT002'],
 'Fotografía y Creación de Contenido':['TRIP019','AROD001','WEBC001'],
 'Cables y Conectividad':['CABL139','CABL140','CABL113'],
 'Soportes y Accesorios':['STYL005','SOPO023','SOPO059'],
 'Protección para Dispositivos':['PROT001','COBE004','PROT003'],
 'Hogar y Accesorios':['ALEX001','VENT008','GADG001'],
 'Iluminación':['FOCO003','LAMP001','LED003'],
 'Juguetes y Coleccionables':['JUGU034','JUGU166','JUGU120']
};
function presentationFamily(p,family){
 if(televisions.has(p.sku)||p.category==='Televisores')return 'Televisores';
 if(p.category==='Monitores')return 'Monitores';
 return family;
}
function decorate(groups,bySKU){
 for(const g of groups){
  g.prioridad=priority.indexOf(g.family)+1||100;
  const preferences=(preferred[g.family]||[]).filter(s=>g.sku.includes(s));
  // Sin datos de ventas no se atribuye popularidad. Reservas suficientes y precio vigente
  // dan un desempate estable; el SKU conserva identidad y no modifica el título comercial.
  const rest=g.sku.filter(s=>!preferences.includes(s)).sort((a,b)=>{
   const pa=bySKU.get(a)||{},pb=bySKU.get(b)||{};
   return Math.min(pb.stock||0,6)-Math.min(pa.stock||0,6)||(pa.price||0)-(pb.price||0)||a.localeCompare(b);
  });
  g.ordered_sku=[...preferences,...rest];g.featured_sku=g.ordered_sku.slice(0,3);
 }
 return groups.sort((a,b)=>a.prioridad-b.prioridad||a.retailer_id.localeCompare(b.retailer_id));
}
const normalizeOrder=value=>(value||[]).map(String);
async function orderProducts({api,id,group,members}){
 if(!group.ordered_sku)return {estado:'SIN_PRIORIDAD_CONFIGURADA'};
 const by=new Map(members.map(p=>[p.retailer_id,p.id]));
 const ids=group.ordered_sku.map(s=>by.get(s));
 if(ids.some(x=>!/^\d+$/.test(x||''))||new Set(ids).size!==group.sku.length)throw Error('ORDEN_META_SIN_IDENTIDAD_COMPLETA');
 // Límite efectivo confirmado por Graph (#105): hasta 100 posiciones explícitas.
 // Se limita sólo la preferencia de orden, nunca el filtro ni los miembros del conjunto.
 const prioritized=ids.slice(0,100);
 const previous=await api.request('GET',id,{fields:'id,ordering_info'});
 if(JSON.stringify(normalizeOrder(previous.ordering_info))!==JSON.stringify(prioritized)){
  // Mantener FBID como texto: superan Number.MAX_SAFE_INTEGER. La API exige enteros.
  await api.request('POST',id,{ordering_info:'['+prioritized.join(',')+']'});
 }
 const result=await api.request('GET',id,{fields:'id,ordering_info'});
 if(JSON.stringify(normalizeOrder(result.ordering_info))!==JSON.stringify(prioritized))return {estado:'ORDEN_NO_CONFIRMADO_META',destacados:group.featured_sku};
 return {estado:'ORDEN_PRODUCTOS_VERIFICADO_META',destacados:group.featured_sku,articulos:ids.length,posiciones_explicitas:prioritized.length,visible_whatsapp_verificado:false};
}
module.exports={priority,preferred,presentationFamily,decorate,orderProducts};
