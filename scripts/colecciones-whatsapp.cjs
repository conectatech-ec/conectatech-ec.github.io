// Proyección por SKU del catálogo existente. No crea productos ni llama a Meta.
const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const grupos={
 'Celulares y tablets':['TELEFONOS','TABLETS'],
 'Audífonos y audio':['AUDIFONOS','PARLANTES','BARRAS DE SONIDO','RADIOS','REPRODUCTORES'],
 'Cargadores, cables y energía':['CARGADORES','CUBOS CARGADORES','BASES INALAMBRICAS','CABLES','ADAPTADORES','HUB USB','CORTAPICOS','ESTABILIZADORES','PROTECTORES DE VOLTAJE','UPS','INVERSORES'],
 'Smartwatches y correas':['RELOJES','CORREAS'],
 'Computación y almacenamiento':['LAPTOPS','MONITORES','MOUSE','TECLADOS','PADMOUSE','PRESENTADORES','PUNTEROS LASER','FLASH MEMORIES','DISCOS DUROS EXTERNOS','TARJETAS DE MEMORIA','LECTORES DE MEMORIA','LECTORES EXTERNOS','CASE','SWITCH','EXTENSORES WIFI'],
 'Estuches y protectores':['ESTUCHES','COBERTORES','MICAS','FUNDAS','PROTECTORES DE CAMARA'],
 'Cámaras y seguridad':['CAMARAS DE SEGURIDAD','SENSORES','TIMBRES'],
 'TV y entretenimiento':['TV BOX - STICK','CONTROLES','PROYECTORES','ANTENAS','PALANCAS','SIMULADORES'],
 'Pilas y powerbanks':['PILAS','POWERBANKS'],
 'Micrófonos y creación de contenido':['MICROFONOS','TRIPODES','CAPTURADORAS DE VIDEO','WEBCAMS','KITS DE GRABACION','PANELES DE LUZ'],
 'Hogar inteligente':['ALEXA','ENCHUFES'],
 'Soportes y accesorios':['SOPORTES','STYLUS','AIRTAGS','BRAZALETES','POPSOCKET'],
 'Juguetes':['JUGUETES']
};
const indice=new Map();
for(const [coleccion,categorias] of Object.entries(grupos))for(const categoria of categorias){
 if(indice.has(categoria))throw Error('Categoría duplicada: '+categoria);
 indice.set(categoria,coleccion);
}
function planificar({products,content,masterCategories,urls,inventoryState}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(inventoryState?.fecha_corte||'')||!/^[a-f0-9]{64}$/.test(inventoryState?.origen_sha256||''))throw Error('Falta corte validado 593');
 const vistos=new Set(),colecciones={},registros=[];
 for(const p of products){
  if(vistos.has(p.sku))throw Error('SKU duplicado: '+p.sku);vistos.add(p.sku);
  const o=content[p.sku]||{},categoria=masterCategories.get(p.sku)||'',coleccion=indice.get(normalizar(categoria))||null;
  const estados=[],motivos=[];
  if(!(p.stock>0))estados.push('AGOTADO');
  if(o.imagenPendiente===true||(!o.imagen&&!p.imageUrl)){estados.push('PENDIENTE_IMAGEN');motivos.push('Sin imagen publicada');}
  if(o.comercialVerificado!==true){motivos.push('Ficha comercial sin aprobación registrada');}
  if(!coleccion)motivos.push(categoria?'Categoría fuera de selección comercial':'Sin categoría maestra');
  if(!urls[p.sku])motivos.push('Sin URL publicada');
  if(!(Number.isFinite(p.promo)&&p.promo>0&&Number.isFinite(p.pvp)&&p.pvp>=p.promo))motivos.push('Precios públicos inválidos');
  // La preparación local nunca acredita importación, política ni visibilidad remota.
  estados.push('PENDIENTE_APROBACIÓN');
  const candidato=p.stock>0&&!motivos.length;
  if(candidato)(colecciones[coleccion]??=[]).push(p.sku);
  registros.push({sku:p.sku,categoria_maestra:categoria,coleccion_propuesta:coleccion,candidato,estados,motivos,
   importado_meta:null,visible_whatsapp:null,verificado_en:null});
 }
 return {version:1,fecha_corte:inventoryState.fecha_corte,fuente_sha256:inventoryState.origen_sha256,
  fuente:'Catálogo existente y categorías maestras 593; sólo referencias SKU',
  catalogo_id:null,waba_id:null,limite_efectivo:null,colecciones_automaticas_verificadas:false,
  publicacion_habilitada:false,importados_meta:null,visibles_whatsapp:null,
  estados_permitidos:['ACTUALIZADO','AGOTADO','PENDIENTE_IMAGEN','PENDIENTE_APROBACIÓN','ERROR','VERIFICADO'],
  ofertas_destacadas:{sku:[],motivo:'Requiere selección editorial aprobada; Promo Contado no implica oferta destacada'},
  colecciones,registros};
}
module.exports={planificar};
