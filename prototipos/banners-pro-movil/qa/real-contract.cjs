// Private inputs remain outside Git. Usage: node qa/real-contract.cjs manifest.json assets.json config.json
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const [manifestPath,assetsPath,configPath,mode]=process.argv.slice(2);const publicMode=mode==='public';
const manifest=JSON.parse(fs.readFileSync(manifestPath)),assets=JSON.parse(fs.readFileSync(assetsPath)),config=JSON.parse(fs.readFileSync(configPath));
const cut={fecha_corte:manifest.fecha_datos,origen_sha256:manifest.fuente_593_sha256};
const files=new Map(assets.map(a=>[a.id,a]));
const session='c'.repeat(64),sessionKey='bp:auth:v2:session:'+crypto.createHash('sha256').update(session).digest('hex');
const api=vm.runInNewContext((process.env.BANNERS_PRO_QA_CODE?fs.readFileSync(process.env.BANNERS_PRO_QA_CODE,'utf8'):fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../Auth.gs'),'utf8'))+';({getLibrary,getAsset,rows_})',{
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='BANNERS_PRO_CONFIG'?JSON.stringify(config):k==='BANNERS_PRO_PUBLIC_BANNERS'?(publicMode?'true':'false'):null})},
 CacheService:{getUserCache:()=>({get:()=>null,put:()=>{}}),getScriptCache:()=>({get:k=>k===sessionKey?JSON.stringify({email:config.users[0],sub:'fixture',expires:Date.now()+60000,epoch:'1'}):null})},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,b)=>Array.from(crypto.createHash('sha256').update(typeof b==='string'?b:Buffer.from(b)).digest()),base64Encode:b=>Buffer.from(b).toString('base64')},
 UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(cut)})},
 DriveApp:{getFileById:id=>{if(id===config.manifestId)return {getBlob:()=>({getDataAsString:()=>JSON.stringify(manifest)})};const a=files.get(id);if(!a)throw Error('Fixture not selected');const b=fs.readFileSync(a.path),meta=a.metadata||{};return {isTrashed:()=>false,getMimeType:()=>meta.mime_type||'application/pdf',getLastUpdated:()=>new Date(meta.modified_time||'2026-10-26T20:56:58Z'),getName:()=>path.basename(a.path),getParents:()=>{let used=false;return {hasNext:()=>!used,next:()=>{used=true;return {getId:()=>meta.parent_ids?.[0]||config.approvedFolders.find(id=>id===config.pdfFolderId)||config.approvedFolders[5]}}}},getBlob:()=>({getBytes:()=>Array.from(b)})}}}
});
const rows=api.rows_(manifest,cut);assert.equal(rows.products.length,5);assert.equal(rows.pdfs.length,4);
const library=api.getLibrary(publicMode?undefined:session);assert.equal(library.products.length,5);assert.equal(library.pdfs.length,publicMode?0:1);if(publicMode){assert.equal(library.sourceUrl,null);assert.throws(()=>api.getAsset(rows.pdfs[0].driveId,1),/no está aprobado/);assert.throws(()=>api.getAsset('arbitrary',1),/no está aprobado/);}
for(const row of [...library.products,...library.pdfs]){const a=api.getAsset(row.driveId,row.version,publicMode?undefined:session);assert.equal(crypto.createHash('sha256').update(Buffer.from(a.base64,'base64')).digest('hex'),row.sha256)}
console.log(publicMode?'PUBLICO: 5 banners sin sesión, SHA correctos; PDF e ID arbitrario bloqueados.':'PRIVADO: 5 banners y 1 PDF, SHA correctos; runtime Google simulado.');
