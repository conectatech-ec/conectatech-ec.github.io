import catalog from './generated/catalogo.json' with {type:'json'};
export function answer(sku,message,now=Date.now(),source=catalog) {
  sku=sku==='MICR027'?'MICR27':sku;
  const p=source.productos.find(x=>x.sku===sku);
  if(!p) return {error:'SKU fuera del piloto',disponibles:source.productos.map(x=>x.sku)};
  if(!Number.isFinite(Date.parse(source.fuente_fecha))||Date.parse(source.fuente_fecha)>now+300000||now-Date.parse(source.fuente_fecha)>24*3600000) return {error:'Datos vencidos: consulta la ficha; no se cotiza ni reserva.',url:p.url,stale:true};
  if(p.stock<=0) return {sku:p.sku,text:`${p.nombre}\nSKU ${p.sku}: sin disponibilidad confirmada.\n${p.url}`,disponible:false,stock_referencial:0,url:p.url,fuente_fecha:source.fuente_fecha};
  let text=p.anuncio;
  if(/env[ií]o|entrega|retiro|quito/i.test(message)) text+='\nPuedes solicitar retiro en tienda, contraentrega en Quito o envío nacional. Cobertura, costo y fecha pendientes de confirmación; no se ha confirmado un pedido.';
  if(/mejor|gama|accesorio|compatible|promoci[oó]n/i.test(message)) text+='\nNo hay relaciones de compatibilidad, mejora de gama ni promociones adicionales validadas para este piloto. Indica tu equipo y necesidad.';
  return {sku:p.sku,text,precio:p.promo,pvp:p.pvp,stock_referencial:p.stock,foto:p.foto,banner:p.banner,url:p.url,caracteristicas:p.caracteristicas,fuente_fecha:source.fuente_fecha,disponible:true,opciones_compra:[{tipo:'retiro',estado:'por_confirmar'},{tipo:'contraentrega_quito',estado:'por_confirmar'},{tipo:'envio_nacional',estado:'por_confirmar'}],modo:'datos_verificados'};
}
