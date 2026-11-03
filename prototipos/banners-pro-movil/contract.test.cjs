const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const guard=fs.readFileSync(path.join(__dirname,'Guardas.gs'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'Index.html'),'utf8');
new vm.Script(guard);new vm.Script(source);new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const config={users:['seller@example.test'],manifestId:'test',rootId:'test',interfaceId:'test',interfaceSha256:'a'.repeat(64),hubUrl:'https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json',approvedFolders:['test']};
function runtime(email){return vm.runInNewContext(guard+'\n'+source+';({approved_,rows_})',{PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(config)})},Session:{getActiveUser:()=>({getEmail:()=>email})}})}
const api=runtime('seller@example.test');
// Same commercial assertions, now using a structurally valid per-asset receipt.
const sourceSha='a'.repeat(64),assetSha='b'.repeat(64);
const cut={fecha_corte:'2026-10-26',origen_sha256:sourceSha};
const prices={fecha_corte:cut.fecha_corte,sha256_original:sourceSha,cantidad_sku_web:1,productos:{TELF001:{stock:1,promo_centavos:1000,pvp_centavos:1250}}};
const p={sku:'TELF001',estado:'APROBADO',material_vigente_verificado:true,disponibilidad_comercial:true,banner_sha256:assetSha,
 precio_contado:'10.00',pvp:'12.50',fecha_datos:cut.fecha_corte,fecha_datos_banner:cut.fecha_corte,fuente_593_sha256:sourceSha,
 publicacion_drive:{estado_publicacion:'VERIFICADO',estado_aprobacion:'APROBADO',fecha_corte:cut.fecha_corte,sha256_fuente:sourceSha,checksum_archivo:assetSha,checksum_descargado:assetSha}};
assert.ok(api.approved_(p,cut,prices));
for(const patch of [{estado:'PENDIENTE'},{disponibilidad_comercial:false},{material_vigente_verificado:false},{sku:'ARBITRARY'},{publicacion_drive:{...p.publicacion_drive,fecha_corte:'2026-10-25'}},{publicacion_drive:{...p.publicacion_drive,checksum_archivo:'different'}}])assert.ok(!api.approved_({...p,...patch},cut,prices));
assert.equal(api.rows_({productos:[],catalogos:{X:{estado:'NO_APROBADO',archivos_privados:[{version:'ligero',url:'https://drive.google.com/file/d/test/view',sha256:'x'}]}}},cut,prices).pdfs.length,0);

const approvedPdf={estado:'APROBADO_DRIVE_VERIFICADO',fecha_datos:cut.fecha_corte,fuente_593_sha256:sourceSha,sku:['TELF001'],archivos_privados:[{version:'ligero',url:'https://drive.google.com/file/d/test/view',sha256:assetSha}],publicacion_drive:{ligero:{SKU:['TELF001'],id_drive:'test',estado_aprobacion:'APROBADO',estado_publicacion:'VERIFICADO',fecha_corte:cut.fecha_corte,sha256_fuente:cut.origen_sha256,checksum_archivo:assetSha,checksum_descargado:assetSha}}};
function pdfRows(c){return api.rows_({productos:[p],catalogos:{TEST:c}},cut,prices).pdfs}
for(const estado of ['APROBADO_DRIVE_VERIFICADO','APROBADO_VERIFICADO_DRIVE'])assert.equal(pdfRows({...approvedPdf,estado}).length,1);
for(const patch of [{fecha_datos:'2026-10-25'},{estado:'NO_APROBADO'},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,estado_publicacion:'PREPARADO'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,sha256_fuente:'old'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,checksum_archivo:'changed'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,id_drive:'arbitrary'}}}])assert.equal(pdfRows({...approvedPdf,...patch}).length,0);
console.log('16 comprobaciones comerciales conservadas con recibos válidos; sintaxis backend e interfaz correctas.');
