'use strict';
// Public presentation only. Identity, financial data and quantities are never emitted.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const ORIGIN='https://conectatech-ec.github.io',SCHEMA='conectatech.alex.presentation.v1';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function fail(code){throw Error(code);}
// Pure publisher API: caller supplies the already approved Web title/photo map.
// This function signs public metadata; it does not grant photographic approval.
function buildPresentation({source_sha256,cut_date,published_at,multichannel,meta,products}){
 const body={schema:SCHEMA,source_sha256,cut_date,published_at,inputs:{multichannel_sha256:sha(multichannel),meta_sha256:sha(meta)},products};
 return {...body,version:'alex-presentation-v1-'+sha(stable(body))};
}
function csvRows(bytes,required){
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('PRESENTATION_CSV_ENCODING');}
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)fail('PRESENTATION_CSV_QUOTING');quoted=true;}
  else if(c===','){row.push(cell);cell='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';closed=false;}
  else{if(closed)fail('PRESENTATION_CSV_QUOTING');cell+=c;}
 }
 if(quoted)fail('PRESENTATION_CSV_QUOTING');if(row.length||cell){row.push(cell);rows.push(row);}
 const header=rows.shift();if(!header||new Set(header).size!==header.length||required.some(k=>!header.includes(k))||rows.length<1||rows.length>5000)fail('PRESENTATION_CSV_SCHEMA');
 const seen=new Set();return rows.map(row=>{if(row.length!==header.length)fail('PRESENTATION_CSV_SCHEMA');const obj=Object.fromEntries(header.map((k,i)=>[k,row[i]])),sku=obj.sku||obj.id;if(!/^[A-Z0-9_-]{3,40}$/.test(sku)||seen.has(sku))fail('PRESENTATION_CSV_SKU');seen.add(sku);return {...obj,sku};});
}
function preparePresentation(root=process.cwd()){
 const oldCwd=process.cwd();root=fs.realpathSync(root);process.chdir(root);
 try{
  function read(file,max=12000000){const full=fs.realpathSync(path.resolve(root,file));if(!full.startsWith(root+path.sep))fail('PRESENTATION_PATH');const st=fs.statSync(full);if(!st.isFile()||st.size>max)fail('PRESENTATION_SIZE');return fs.readFileSync(full);}
  const json=file=>JSON.parse(read(file).toString('utf8'));
  const state=json('datos-593/estado-ultimo-corte.json');
  if(state.referencia!=='datos-593/corte-comercial-publico-validado.json')fail('PRESENTATION_SOURCE');
  const cut=json(state.referencia),summary=json('exportaciones/resumen-canales.json');
  if(!/^[a-f0-9]{64}$/.test(state.origen_sha256||'')||!/^\d{4}-\d{2}-\d{2}$/.test(state.fecha_corte||'')||cut.sha256_original!==state.origen_sha256||cut.fecha_corte!==state.fecha_corte||summary.fuente_sha256!==state.origen_sha256||summary.fecha_corte!==state.fecha_corte||!Number.isFinite(Date.parse(summary.generated_at)))fail('PRESENTATION_SOURCE');
  const html=read('index.html').toString('utf8'),match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);if(!match)fail('PRESENTATION_WEB_SCHEMA');
  const products=JSON.parse(match[1]),bySku=new Map(products.map(p=>[p.sku,p]));if(bySku.size!==products.length)fail('PRESENTATION_WEB_DUPLICATE');
  const seo=json('seo-contenido.json'),editorial=json('importacion/editorial/publicados.json');
  const wrapper=read('assets/editorial-titulos-datos.js').toString('utf8').match(/^\s*window\.CONECTATECH_TITULOS_PRO_DATOS=(\{[\s\S]*\});\s*$/);
  if(!wrapper||!isDeepStrictEqual(JSON.parse(wrapper[1]),editorial))fail('PRESENTATION_EDITORIAL_BROWSER_DRIFT');
  const titles=require(path.join(root,'assets/editorial-titulos.js'));
  const photos=require(path.join(root,'scripts/editorial-fotografia-efectiva.cjs'))(products,seo);
  const multichannel=read('exportaciones/contenido-multicanal.csv',3000000),meta=read('exportaciones/meta-catalogo-piloto.csv',3000000);
  const rows=[...csvRows(multichannel,['sku','title','image_link']),...csvRows(meta,['id','title','image_link'])],out={};
  const hashed=new Map();
  function verify(url,expected){
   if(typeof url!=='string'||!url.startsWith('/imagenes/')||url.includes('?')||url.includes('#')||!url.split('/').every(v=>v!=='.'&&v!=='..')||!/^[a-f0-9]{64}$/.test(expected||''))fail('PRESENTATION_ASSET_APPROVAL');
   if(!hashed.has(url))hashed.set(url,sha(read('.'+url,32000000)));
   if(hashed.get(url)!==expected)fail('PRESENTATION_ASSET_SHA');
  }
  for(const row of rows){
   const p=bySku.get(row.sku);if(!p)fail('PRESENTATION_UNKNOWN_SKU');
   const expectedTitle=titles.entry(p,editorial)?.titulo||seo[p.sku]?.nombre||p.name;
   const current=photos[p.sku],expectedImage=current?.imagen||seo[p.sku]?.imagen||p.imageUrl||'';
   const expectedUrl=expectedImage?new URL(expectedImage,ORIGIN).href:'';
   if(row.title!==expectedTitle||row.image_link!==expectedUrl)fail('PRESENTATION_WEB_FEED_DRIFT');
   if(typeof expectedTitle!=='string'||!expectedTitle.trim()||expectedTitle.length>300||/[\u0000-\u001f\u007f]/.test(expectedTitle))fail('PRESENTATION_TITLE');
   let approved_media=null;const professional=current?.imagenProfesional;
   // A published URL without official SHA/visual metadata cannot approve a new image.
   if(expectedImage&&professional&&professional.contiene_caja===false&&(professional.revision_visual===true||(typeof professional.revision_visual==='string'&&professional.revision_visual.trim()))){
    const version=Object.values(professional.versiones||{}).find(v=>new URL(v.url,ORIGIN).href===expectedUrl);
    if(version){verify(professional.original,professional.sha256_original);for(const asset of Object.values(professional.versiones))verify(asset.url,asset.sha256);approved_media={url:expectedUrl,sha256:version.sha256};}
   }
   const record={display_title:expectedTitle,approved_media};if(out[p.sku]&&!isDeepStrictEqual(out[p.sku],record))fail('PRESENTATION_CSV_CONFLICT');out[p.sku]=record;
  }
  return buildPresentation({source_sha256:state.origen_sha256,cut_date:state.fecha_corte,published_at:summary.generated_at,multichannel,meta,products:out});
 }finally{process.chdir(oldCwd);}
}
if(require.main===module){try{if(process.argv.length!==3)fail('PRESENTATION_ROOT_REQUIRED');console.log(JSON.stringify(preparePresentation(process.argv[2])));}catch(error){console.error(/^PRESENTATION_[A-Z_]+$/.test(error.message)?error.message:'PRESENTATION_PREPARATION_FAILED');process.exitCode=1;}}
module.exports={preparePresentation,buildPresentation,csvRows,stable};
