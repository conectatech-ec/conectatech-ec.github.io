'use strict';
// Proyección opcional exclusivamente pública. Nunca decide identidad ni valores comerciales.
const crypto=require('node:crypto');
const ORIGIN='https://conectatech-ec.github.io',SCHEMA='conectatech.alex.presentation.v1',HEX=/^[a-f0-9]{64}$/;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function buildPresentation({source_sha256,cut_date,published_at,multichannel,meta,products}){
 const body={schema:SCHEMA,source_sha256,cut_date,published_at,inputs:{multichannel_sha256:sha(multichannel),meta_sha256:sha(meta)},products};
 return {...body,version:'alex-presentation-v1-'+sha(stable(body))};
}
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function keys(value,allowed){return !!value&&Object.prototype.toString.call(value)==='[object Object]'&&Object.keys(value).length===allowed.length&&allowed.every(k=>own(value,k));}
function title(value){return typeof value==='string'&&!!value.trim()&&value.length<=300&&!/[\u0000-\u001f\u007f]/.test(value);}
function assetURL(value){
 if(typeof value!=='string'||!value.startsWith('/imagenes/')||value.includes('?')||value.includes('#')||value.includes('\\'))return false;
 try{const url=new URL(value,ORIGIN),decoded=decodeURIComponent(value);return url.origin===ORIGIN&&url.pathname===value&&!decoded.split('/').some(v=>v==='.'||v==='..'||/[\u0000-\u001f\u007f]/.test(v));}catch{return false;}
}
function validPresentation(document){
 try{
  if(!keys(document,['schema','source_sha256','cut_date','published_at','inputs','products','version'])||document.schema!==SCHEMA||!HEX.test(document.source_sha256)||!/^\d{4}-\d{2}-\d{2}$/.test(document.cut_date)||typeof document.published_at!=='string'||!Number.isFinite(Date.parse(document.published_at)))return false;
  if(!keys(document.inputs,['multichannel_sha256','meta_sha256'])||!Object.values(document.inputs).every(v=>HEX.test(v)))return false;
  if(!document.products||Object.prototype.toString.call(document.products)!=='[object Object]')return false;
  const entries=Object.entries(document.products);if(!entries.length||entries.length>5000)return false;
  for(const [sku,entry]of entries){
   if(!/^[A-Z0-9_-]{3,40}$/.test(sku)||!keys(entry,['display_title','approved_media'])||!title(entry.display_title))return false;
   if(entry.approved_media!==null){const m=entry.approved_media;if(!keys(m,['url','sha256'])||typeof m.url!=='string'||!m.url.startsWith(ORIGIN+'/imagenes/')||!assetURL(m.url.slice(ORIGIN.length))||!HEX.test(m.sha256))return false;}
  }
  const {version,...body}=document;return version==='alex-presentation-v1-'+sha(stable(body));
 }catch{return false;}
}
function csvRows(text,required){
 if(Buffer.isBuffer(text))text=new TextDecoder('utf-8',{fatal:true}).decode(text);
 if(typeof text!=='string')throw Error('PRESENTATION_CSV');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('PRESENTATION_CSV');quoted=true;}else if(c===','){row.push(cell);cell='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';closed=false;}else{if(closed)throw Error('PRESENTATION_CSV');cell+=c;}
 }
 if(quoted)throw Error('PRESENTATION_CSV');if(row.length||cell){row.push(cell);rows.push(row);}
 const header=rows.shift();if(!header||new Set(header).size!==header.length||required.some(k=>!header.includes(k))||!rows.length||rows.length>5000)throw Error('PRESENTATION_CSV');
 const seen=new Set();return rows.map(row=>{if(row.length!==header.length)throw Error('PRESENTATION_CSV');const r=Object.fromEntries(header.map((k,i)=>[k,row[i]])),sku=r.sku||r.id;if(!/^[A-Z0-9_-]{3,40}$/.test(sku)||seen.has(sku))throw Error('PRESENTATION_CSV');seen.add(sku);return {sku,title:r.title,image_link:r.image_link};});
}
function preparePresentation({source_sha256,cut_date,multichannel,meta,webProducts,photos,previous,readAsset,now=()=>new Date().toISOString()}={}){
 const prior=validPresentation(previous)?previous:null;
 try{
  if(!HEX.test(source_sha256||'')||!/^\d{4}-\d{2}-\d{2}$/.test(cut_date||''))throw Error('PRESENTATION_SOURCE');
  const known=new Set(webProducts.map(p=>p.sku)),rows=[...csvRows(multichannel,['sku','title','image_link']),...csvRows(meta,['id','title','image_link'])],products={},hashed=new Map();
  function verify(url,expected){if(!hashed.has(url)){const bytes=readAsset(url);if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('PRESENTATION_ASSET');const raw=Buffer.from(bytes);if(raw.length>32000000)throw Error('PRESENTATION_ASSET');hashed.set(url,sha(raw));}if(hashed.get(url)!==expected)throw Error('PRESENTATION_ASSET_SHA');}
  for(const row of rows){
   if(!known.has(row.sku)||!title(row.title))throw Error('PRESENTATION_PUBLIC_SCOPE');
   let approved_media=null;const professional=photos[row.sku]?.imagenProfesional;
   if(row.image_link&&professional?.contiene_caja===false&&typeof professional.revision_visual==='string'&&professional.revision_visual.trim()){
    const versions=Object.values(professional.versiones||{}),match=versions.find(v=>assetURL(v?.url)&&ORIGIN+v.url===row.image_link);
    const descriptors=[{url:professional.original,sha256:professional.sha256_original},...versions];
    if(match&&descriptors.every(v=>assetURL(v?.url)&&HEX.test(v?.sha256||''))){for(const v of descriptors)verify(v.url,v.sha256);approved_media={url:row.image_link,sha256:match.sha256};}
   }
   const record={display_title:row.title,approved_media};if(products[row.sku]&&stable(products[row.sku])!==stable(record))throw Error('PRESENTATION_CSV_CONFLICT');products[row.sku]=record;
  }
  const semantic={schema:SCHEMA,source_sha256,cut_date,inputs:{multichannel_sha256:sha(multichannel),meta_sha256:sha(meta)},products};
  if(prior){const {version,published_at,...body}=prior;if(stable(body)===stable(semantic))return {presentation:prior,status:'PRESENTATION_READY'};}
  const published_at=now();
  if(prior&&prior.source_sha256===source_sha256&&prior.cut_date===cut_date&&Date.parse(published_at)<=Date.parse(prior.published_at))throw 'PRESENTATION_CLOCK_NOT_ADVANCED';
  const document=buildPresentation({...semantic,published_at,multichannel,meta});if(!validPresentation(document))throw Error('PRESENTATION_INVALID');
  return {presentation:document,status:'PRESENTATION_READY'};
 }catch(error){return {presentation:prior,status:'PRESENTATION_PREPARATION_FAILED',error_code:error==='PRESENTATION_CLOCK_NOT_ADVANCED'?'PRESENTATION_CLOCK_NOT_ADVANCED':'PRESENTATION_PREPARATION_FAILED'};}
}
module.exports={buildPresentation,preparePresentation,validPresentation,stable,csvRows};
