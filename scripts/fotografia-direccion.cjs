// Correcciones fotográficas selectivas: referencias nuevas, originales inmutables.
const fs=require('fs'),crypto=require('crypto');
const file='importacion/fotografia-publicada/direccion-20261026-05.json';
const allowed=new Set(['CABL046','PAD001','SOPO007','MOUS003','JUGU067','REL028','LAMP003']);
function rows(){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).productos:{};}
function hash(url){const f='.'+url;return fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null;}
function valid(r){return r&&allowed.has(r.sku)&&r.revisado_visual===true&&
 hash(r.portada_anterior.url)===r.portada_anterior.sha256&&
 hash(r.imagenProfesional.original)===r.imagenProfesional.sha256_original&&
 Object.values(r.imagenProfesional.versiones).every(v=>hash(v.url)===v.sha256);}
function capture(){
 const products=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 return new Set(products.filter(p=>{const r=rows()[p.sku];return valid(r)&&[r.portada_anterior.url,r.imagenProfesional.versiones['1200'].url].includes(p.imageUrl);}).map(p=>p.sku));
}
function patchObjects(source,selected){
 // Sólo cambia imageUrl dentro del objeto de cada SKU; conserva los demás bytes.
 const registry=rows(),m=/const products=(\[[\s\S]*?\]);\s*\n/.exec(source);
 if(!m)throw Error('Catálogo no encontrado');
 const text=m[1];let depth=0,start=-1,quoted=false,escape=false;const edits=[];
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;continue;}
  if(c==='{'){if(depth===0)start=i;depth++;}
  if(c==='}'&&--depth===0&&start>=0){
   const original=text.slice(start,i+1),p=JSON.parse(original),r=registry[p.sku];
   if(selected.has(p.sku)&&valid(r)&&[r.portada_anterior.url,r.imagenProfesional.versiones['1200'].url].includes(p.imageUrl)){
    const updated=original.replace(/("imageUrl"\s*:\s*)"(?:\\.|[^"\\])*"/,(_,key)=>key+JSON.stringify(r.imagenProfesional.versiones['1200'].url));
    edits.push([start,i+1,updated]);
   }
   start=-1;
  }
 }
 let result=text;for(const [a,b,value]of edits.reverse())result=result.slice(0,a)+value+result.slice(b);
 const offset=m.index+m[0].indexOf(text);return source.slice(0,offset)+result+source.slice(offset+text.length);
}
function restore(selected){const before=fs.readFileSync('index.html','utf8'),after=patchObjects(before,selected);if(after!==before)fs.writeFileSync('index.html',after);}
function overlay(p,custom,selected){
 const r=rows()[p.sku];if(!selected.has(p.sku)||!valid(r))return;
 const old=custom.imagenProfesional?.versiones?.['1200'];
 if(!old||![[r.portada_anterior.url,r.portada_anterior.sha256],[r.imagenProfesional.versiones['1200'].url,r.imagenProfesional.versiones['1200'].sha256]].some(([url,sha])=>old.url===url&&old.sha256===sha))return;
 const secondary=(custom.galeria||[]).filter(i=>i.posicion!==1);
 custom.imagen=r.imagenProfesional.versiones['1200'].url;custom.imagenProfesional=r.imagenProfesional;
 custom.galeria=[r.imagenProfesional,...secondary];custom.imagenPendiente=false;
}
module.exports={capture,restore,overlay,patchObjects,valid};
