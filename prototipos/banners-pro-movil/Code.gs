/* Prototipo independiente, solo lectura. No desplegar sin aprobación. */
function configuration_() {
  const raw=PropertiesService.getScriptProperties().getProperty('BANNERS_PRO_CONFIG');
  if(!raw) throw new Error('Configuración privada pendiente.');
  const c=JSON.parse(raw);
  if(!Array.isArray(c.users)||c.users.length<1||c.users.length>2||c.users.some(e=>typeof e!=='string'||!e.includes('@')))throw new Error('Configura una o dos identidades autorizadas.');
  for(const k of ['manifestId','rootId','hubUrl'])if(typeof c[k]!=='string'||!c[k])throw new Error('Configuración incompleta: '+k);
  if(!Array.isArray(c.approvedFolders)||!c.approvedFolders.length)throw new Error('Carpetas autorizadas pendientes.');
  if(c.hubUrl!=='https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json')throw new Error('Fuente de corte no autorizada.');
  c.users=c.users.map(e=>e.toLowerCase().trim());
  c.pilot=['TELF001','REL046','TARJ018','FLAS003','TELE001'];
  return Object.freeze(c);
}
const SETTINGS=configuration_();
function doGet(e) {
  const params=e&&e.parameter||{};
  if(params.code||params.state||params.error){
    let message='No se pudo autorizar la cuenta. Vuelve a la galería e inténtalo de nuevo.';
    try{googleCallback_(params);message='Inicio de sesión procesado. Vuelve a la pestaña de Banners Pro; puedes cerrar esta ventana.';}catch(error){}
    return HtmlService.createHtmlOutput('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Banners Pro — acceso</title><p>'+message+'</p></html>');
  }
  // Public shell only: no Drive read, library metadata or Google tokens.
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CONECTATECH BANNERS PRO').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');
}
function hash_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(v=>(v&255).toString(16).padStart(2,'0')).join('');}
function inside_(file){const it=file.getParents();while(it.hasNext())if(SETTINGS.approvedFolders.includes(it.next().getId()))return true;return false;}
function base_(session){
  authorize_(session);
  const source=JSON.parse(DriveApp.getFileById(SETTINGS.manifestId).getBlob().getDataAsString('UTF-8'));
  const response=UrlFetchApp.fetch(SETTINGS.hubUrl,{muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)throw new Error('No se pudo comprobar la vigencia del inventario. Intenta actualizar.');
  const cut=JSON.parse(response.getContentText());
  if(source.fecha_datos!==cut.fecha_corte||source.fuente_593_sha256!==cut.origen_sha256)throw new Error('La biblioteca está actualizándose al nuevo corte. No se compartirán materiales anteriores.');
  return {source,cut};
}
function approved_(p,cut){
  const d=p.publicacion_drive;
  return SETTINGS.pilot.includes(p.sku)&&p.estado==='APROBADO'&&p.material_vigente_verificado===true&&p.disponibilidad_comercial===true&&
    d&&d.estado_publicacion==='VERIFICADO'&&d.fecha_corte===cut.fecha_corte&&d.sha256_fuente===cut.origen_sha256&&d.checksum_archivo===p.banner_sha256;
}
function rows_(source,cut){
  const categories={TELEFONOS_TABLETS:'Teléfonos y tablets',SMARTWATCHES:'Smartwatch',ALMACENAMIENTO:'Almacenamiento',TELEVISORES_MONITORES:'Televisores y monitores',CABLES_ADAPTADORES:'Cables y adaptadores'};
  const products=source.productos.filter(p=>approved_(p,cut)).map(p=>({sku:p.sku,name:p.titulo,category:categories[p.coleccion]||p.coleccion,driveId:p.publicacion_drive.id_drive,sha256:p.banner_sha256,dataDate:cut.fecha_corte,mime:'image/png'}));
  const pdfs=[];
  for(const [key,c]of Object.entries(source.catalogos||{})){
    if(!c.archivos_privados||!['APROBADO_DRIVE_VERIFICADO','APROBADO_VERIFICADO_DRIVE'].includes(c.estado)||c.fecha_datos!==cut.fecha_corte)continue;
    for(const a of c.archivos_privados.filter(a=>a.version==='ligero')){
      const publication=c.publicacion_drive?.ligero;
      if(!publication||publication.estado_aprobacion!=='APROBADO'||publication.estado_publicacion!=='VERIFICADO'||publication.fecha_corte!==cut.fecha_corte||publication.sha256_fuente!==cut.origen_sha256||publication.checksum_archivo!==a.sha256)continue;
      const match=String(a.url).match(/\/d\/([A-Za-z0-9_-]+)/);if(!match||!a.sha256||match[1]!==publication.id_drive)continue;
      pdfs.push({name:categories[key]||key,driveId:match[1],sha256:a.sha256,mime:'application/pdf'});
    }
  }
  return {products,pdfs};
}
function checkedFile_(row){
  if(!row||!/^[A-Za-z0-9_-]+$/.test(row.driveId)||!/^[a-f0-9]{64}$/.test(row.sha256))throw new Error('Referencia de archivo inválida.');
  const file=DriveApp.getFileById(row.driveId),version=file.getLastUpdated().getTime();
  if(file.isTrashed()||file.getMimeType()!==row.mime||!inside_(file))throw new Error('Archivo fuera de la biblioteca autorizada.');
  const key='bp:verified:'+hash_([row.driveId,version,row.sha256].join(':'));
  const cache=typeof CacheService!=='undefined'?CacheService.getUserCache():null;
  if(!cache||cache.get(key)!=='OK'){
    if(hash_(file.getBlob().getBytes())!==row.sha256||file.getLastUpdated().getTime()!==version)throw new Error('VERIFICACION_PENDIENTE: el archivo cambió antes de su aprobación.');
    if(cache)cache.put(key,'OK',300);
  }
  return {file,row:{...row,version,updatedAt:new Date(version).toISOString(),filename:file.getName()}};
}
function getLibrary(session){
  const {source,cut}=base_(session),rows=rows_(source,cut),warnings=[];
  function checked(list){const result=[];for(const row of list){try{result.push(checkedFile_(row).row);}catch(e){warnings.push({sku:row.sku||null,nombre:row.name,motivo:'Archivo pendiente de verificación o sin acceso vigente'});}}return result;}
  const products=checked(rows.products),pdfs=publicBanners_()?[]:checked(rows.pdfs);
  products.sort((a,b)=>b.version-a.version||a.sku.localeCompare(b.sku));
  return {mode:'drive-live',date:cut.fecha_corte,products,pdfs,warnings,sourceUrl:publicBanners_()?null:'https://drive.google.com/drive/folders/'+SETTINGS.rootId,checkedAt:new Date().toISOString()};
}
function selected_(id,version,session){
  authorize_(session);if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Archivo inválido');
  const {source,cut}=base_(session),rows=rows_(source,cut),selected=[...rows.products,...(publicBanners_()?[]:rows.pdfs)].find(p=>p.driveId===id);
  if(!selected)throw new Error('Este archivo no está aprobado o ya no está vigente.');
  const result=checkedFile_(selected);
  if(String(result.row.version)!==String(version))throw new Error('VERSION_CAMBIO: actualiza la galería antes de compartir.');
  return {...result,cut};
}
function validateAsset(id,version,session){const result=selected_(id,version,session);return result.row;}
function getAsset(id,version,session){
  const {file:f,row,cut}=selected_(id,version,session),bytes=f.getBlob().getBytes();
  if(hash_(bytes)!==row.sha256||String(f.getLastUpdated().getTime())!==String(row.version))throw new Error('VERIFICACION_PENDIENTE: el archivo cambió. Espera la validación de la fábrica.');
  return {id,version:row.version,filename:f.getName(),mime:f.getMimeType(),sha256:row.sha256,base64:Utilities.base64Encode(bytes)};
}
