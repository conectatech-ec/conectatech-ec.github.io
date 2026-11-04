'use strict';
const fs=require('node:fs'),path=require('node:path');
const {filtrarHtml}=require('./galerias-calidad.cjs');
const root=path.resolve(__dirname,'../..'),changed=[];
for(const dir of fs.readdirSync(path.join(root,'productos'),{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  const file=path.join(root,'productos',dir.name,'index.html');
  if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8'),sku=dir.name.split('-')[0].toUpperCase(),after=filtrarHtml(sku,before);
  if(before!==after){fs.writeFileSync(file,after);changed.push(sku);}
}
console.log(JSON.stringify({fichasAjustadas:changed.length,sku:changed}));
