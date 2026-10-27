// Private inputs remain outside Git. Usage: node qa/real-contract.cjs manifest.json assets.json config.json
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const [manifestPath,assetsPath,configPath]=process.argv.slice(2);
const manifest=JSON.parse(fs.readFileSync(manifestPath)),assets=JSON.parse(fs.readFileSync(assetsPath)),config=JSON.parse(fs.readFileSync(configPath));
const cut={fecha_corte:manifest.fecha_datos,origen_sha256:manifest.fuente_593_sha256};
const files=new Map(assets.map(a=>[a.id,a]));
const api=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8')+';({getLibrary,getAsset,rows_})',{
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(config)})},
 Session:{getActiveUser:()=>({getEmail:()=>config.users[0]})},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,b)=>Array.from(crypto.createHash('sha256').update(typeof b==='string'?b:Buffer.from(b)).digest()),base64Encode:b=>Buffer.from(b).toString('base64')},
 UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(cut)})},
 DriveApp:{getFileById:id=>{if(id===config.manifestId)return {getBlob:()=>({getDataAsString:()=>JSON.stringify(manifest)})};const a=files.get(id);if(!a)throw Error('Fixture not selected');const b=fs.readFileSync(a.path),meta=a.metadata||{};return {isTrashed:()=>false,getMimeType:()=>meta.mime_type||'application/pdf',getLastUpdated:()=>new Date(meta.modified_time||'2026-10-26T20:56:58Z'),getName:()=>path.basename(a.path),getParents:()=>{let used=false;return {hasNext:()=>!used,next:()=>{used=true;return {getId:()=>meta.parent_ids?.[0]||config.approvedFolders.find(id=>id===config.pdfFolderId)||config.approvedFolders[5]}}}},getBlob:()=>({getBytes:()=>Array.from(b)})}}}
});
const rows=api.rows_(manifest,cut);assert.equal(rows.products.length,5);assert.equal(rows.pdfs.length,4);
const library=api.getLibrary();assert.equal(library.products.length,5);assert.equal(library.pdfs.length,1);
for(const row of [...library.products,...library.pdfs]){const a=api.getAsset(row.driveId,row.version);assert.equal(crypto.createHash('sha256').update(Buffer.from(a.base64,'base64')).digest('hex'),row.sha256)}
console.log('Contrato real: 5 banners y 1 PDF, SHA correctos; runtime Google simulado.');
