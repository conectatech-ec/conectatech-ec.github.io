'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const policy=require('./galerias-calidad.json'),repository=path.resolve(__dirname,'../..');

// Sólo controla secundarias. Nunca modifica la portada ni los registros fotográficos.
function crearControl(registro,root=repository){
  const approved=new Map(registro.aprobadas.map(row=>[row.sku+'\0'+row.archivos[0].url,row]));
  const rejected=new Set(registro.retiradas.flatMap(row=>row.archivos.map(file=>file.sha256)));
  const hashes=new Map();
  function hash(url){
    const file=path.resolve(root,'.'+url);
    if(!file.startsWith(path.resolve(root)+path.sep))return null;
    try{
      const stat=fs.statSync(file),key=file+'\0'+stat.size+'\0'+stat.mtimeMs;
      if(!hashes.has(key))hashes.set(key,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
      return hashes.get(key);
    }catch{return null;}
  }
  function aprobada(sku,large,small){
    const row=approved.get(sku+'\0'+large);
    if(!row||row.resultado!=='PRESENTACION_COMERCIAL_REVISADA'||!row.revision_visual)return false;
    if(row.archivos.length!==2||row.archivos[1].url!==small)return false;
    return row.archivos.every(file=>file.url.startsWith('/imagenes/'+sku.toLowerCase()+'/')&&
      /^\/[\w./-]+\.webp$/.test(file.url)&&!file.url.split('/').includes('..')&&
      /^[a-f0-9]{64}$/.test(file.sha256)&&!rejected.has(file.sha256)&&hash(file.url)===file.sha256);
  }
  function secundarias(sku,views){
    return views.filter(view=>{
      if(!(view.posicion>1))return false;
      const large=view.versiones?.['1200'],small=view.versiones?.['300'];
      if(!large||!small||!aprobada(sku,large.url,small.url))return false;
      const row=approved.get(sku+'\0'+large.url);
      return row.archivos[0].sha256===large.sha256&&row.archivos[1].sha256===small.sha256;
    });
  }
  function filtrarHtml(sku,html){
    return html.replace(/<div class="gallery">([\s\S]*?)<\/div>/g,(_,body)=>{
      const links=body.match(/<a\b[^>]*>[\s\S]*?<\/a>/g)||[];
      if(links.join('')!==body)throw Error('Galería con estructura no reconocida: '+sku);
      const kept=links.filter(link=>{
        const large=link.match(/^<a\b[^>]*\bhref="([^"]+)"/),small=link.match(/<img\b[^>]*\bsrc="([^"]+)"/);
        return large&&small&&aprobada(sku,large[1].split('?')[0],small[1].split('?')[0]);
      });
      return kept.length?'<div class="gallery">'+kept.join('')+'</div>':'';
    });
  }
  return {aprobada,secundarias,filtrarHtml};
}
module.exports={...crearControl(policy),crearControl};
