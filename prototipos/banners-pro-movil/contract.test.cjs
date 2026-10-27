const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'Index.html'),'utf8');
new vm.Script(source);new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const config={users:['seller@example.test'],manifestId:'test',rootId:'test',interfaceId:'test',interfaceSha256:'a'.repeat(64),hubUrl:'https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json',approvedFolders:['test']};
function runtime(email){return vm.runInNewContext(source+';({approved_,rows_})',{PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(config)})},Session:{getActiveUser:()=>({getEmail:()=>email})}})}
const api=runtime('seller@example.test');
const cut={fecha_corte:'2026-10-26',origen_sha256:'source'};
const p={sku:'TELF001',estado:'APROBADO',material_vigente_verificado:true,disponibilidad_comercial:true,banner_sha256:'sha',publicacion_drive:{estado_publicacion:'VERIFICADO',fecha_corte:cut.fecha_corte,sha256_fuente:'source',checksum_archivo:'sha'}};
assert.ok(api.approved_(p,cut));
for(const patch of [{estado:'PENDIENTE'},{disponibilidad_comercial:false},{material_vigente_verificado:false},{sku:'ARBITRARY'},{publicacion_drive:{...p.publicacion_drive,fecha_corte:'2026-10-25'}},{publicacion_drive:{...p.publicacion_drive,checksum_archivo:'different'}}])assert.ok(!api.approved_({...p,...patch},cut));
assert.equal(api.rows_({productos:[],catalogos:{X:{estado:'NO_APROBADO',archivos_privados:[{version:'ligero',url:'https://drive.google.com/file/d/test/view',sha256:'x'}]}}},cut).pdfs.length,0);

const approvedPdf={estado:'APROBADO_DRIVE_VERIFICADO',fecha_datos:cut.fecha_corte,archivos_privados:[{version:'ligero',url:'https://drive.google.com/file/d/test/view',sha256:'hash'}],publicacion_drive:{ligero:{id_drive:'test',estado_aprobacion:'APROBADO',estado_publicacion:'VERIFICADO',fecha_corte:cut.fecha_corte,sha256_fuente:cut.origen_sha256,checksum_archivo:'hash'}}};
function pdfRows(c){return api.rows_({productos:[],catalogos:{TEST:c}},cut).pdfs}
for(const estado of ['APROBADO_DRIVE_VERIFICADO','APROBADO_VERIFICADO_DRIVE'])assert.equal(pdfRows({...approvedPdf,estado}).length,1);
for(const patch of [{fecha_datos:'2026-10-25'},{estado:'NO_APROBADO'},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,estado_publicacion:'PREPARADO'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,sha256_fuente:'old'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,checksum_archivo:'changed'}}},{publicacion_drive:{ligero:{...approvedPdf.publicacion_drive.ligero,id_drive:'arbitrary'}}}])assert.equal(pdfRows({...approvedPdf,...patch}).length,0);
console.log('16 comprobaciones comerciales correctas; sintaxis backend e interfaz correctas.');
