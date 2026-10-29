// Correcciones fotográficas selectivas: referencias nuevas, originales inmutables.
const fs=require('fs'),crypto=require('crypto');
const file='importacion/fotografia-publicada/direccion-20261026-05.json';
const secondFile='importacion/fotografia-publicada/direccion-20261026-06.json';
const thirdFile='importacion/fotografia-publicada/direccion-20261026-07.json';
const fourthFile='importacion/fotografia-publicada/direccion-20261026-08.json';
const fifthFile='importacion/fotografia-publicada/direccion-20261027-09.json';
const sixthFile='importacion/fotografia-publicada/direccion-20261027-10.json';
const seventhFile='importacion/fotografia-publicada/direccion-20261027-11.json';
const eighthFile='importacion/fotografia-publicada/direccion-20261027-12.json';
const ninthFile='importacion/fotografia-publicada/direccion-20261027-13.json';
const tenthFile='importacion/fotografia-publicada/direccion-20261027-14.json';
const eleventhFile='importacion/fotografia-publicada/direccion-20261027-15.json';
const twelfthFile='importacion/fotografia-publicada/direccion-20261027-16.json';
const thirteenthFile='importacion/fotografia-publicada/direccion-20261027-17.json';
const fourteenthFile='importacion/fotografia-publicada/direccion-20261027-18.json';
const fifteenthFile='importacion/fotografia-publicada/direccion-20261027-19.json';
const sixteenthFile='importacion/fotografia-publicada/direccion-20261027-20.json';
const seventeenthFile='importacion/fotografia-publicada/direccion-20261028-21.json';
const eighteenthFile='importacion/fotografia-publicada/direccion-20261028-22.json';
const nineteenthFile='importacion/fotografia-publicada/direccion-20261028-23.json';
const twentiethFile='importacion/fotografia-publicada/direccion-20261028-24.json';
const twentyFirstFile='importacion/fotografia-publicada/direccion-20261029-25.json';
const twentySecondFile='importacion/fotografia-publicada/direccion-20261029-26.json';
const twentyThirdFile='importacion/fotografia-publicada/direccion-20261029-27.json';
const twentyFourthFile='importacion/fotografia-publicada/direccion-20261029-28.json';
const allowed=new Set(['ADAP054','AUDI017','AUDI086','AUDI094','AUDI122','CABL004','CABL068','CABL131','CABL136','CABL150','CABL152','CABL161','FLAS013','HUB012','MICR10','MICR14','MOUS018','MOUS045','RADI002','RADI008','SOPO041','STYL003','STYL006','TARJ006','TARJ016','TARJ019','TECL017','TRIP010','TVBO006','TVBO010','ADAP002','ADAP025','ADAP030','ADAP032','ADAP038','ADAP049','AUDI065','AUDI067','AUDI096','CABL002','CABL031','CABL035','CABL074','CABL092','CABL132','CABL140','CABL149','CAMA005','FLAS033','MICR03','MICR36','REPR001','SOPO017','TARJ004','TARJ005','TARJ012','TARJ013','TRIP020','TVBO001','WEBC004','ADAP019','ADAP042','ADAP067','ADAP087','ALEX001','ALEX002','AUDI042','AUDI053','AUDI062','AUDI082','AUDI099','AUDI116','AUDI118','AUDI123','CABL025','CABL079','CABL123','GADG001','HUB010','MICR23','MOUS005','PARL003','PARL016','POWE001','PROT001','RADI004','TVBO004','TVBO008','ADAP007','ADAP011','ADAP033','ADAP036','ADAP062','ADAP070','ADAP076','ADAP089','ADAP092','ADAP096','AIRT001','AIRT003','AUDI015','AUDI036','AUDI061','AUDI063','AUDI066','AUDI073','AUDI111','CABL078','CAMA001','HUB008','MOUS009','MOUS037','PARL020','PARL029','PARL043','REPR002','TIMB001','TVBO005','ADAP069','CARG028','CARG029','CARG034','CARG046','CARG048','CUBO005','CUBO024','CARG010','CARG037','TERM001','CUBO009','CUBO010','CARG069','HUB025','MOUS035','MOUS029','CORT06','SOPO002','REL050','ADAP086','ADAP053','ADAP091','CAPT004','HUB016','CORT04','CUBO018','SOPO057','CUBO019','CUBO025','ADAP075','ADAP080','LINT008','CABL046','PAD001','SOPO007','MOUS003','JUGU067','REL028','LAMP003','ESTA002','MICR32','STYL002','MOUS031','MOUS032','MOUS043','POWE015','CABL171','CUBO003','SOPO005','AUDI098','RADI007','POWE016','AIRT002','MOUS020','PADM002','JUGU163','MOUS040','REL011','REL016','PANE002','PANE003','BINO001','MICR08','PROT005','MOUS001','JUGU022','PROT002','PROT004','AUDI044','CUBO002']);
function rows(){return Object.assign({},... [file,secondFile,thirdFile,fourthFile,fifthFile,sixthFile,seventhFile,eighthFile,ninthFile,tenthFile,eleventhFile,twelfthFile,thirteenthFile,fourteenthFile,fifteenthFile,sixteenthFile,seventeenthFile,eighteenthFile,nineteenthFile,twentiethFile,twentyFirstFile,twentySecondFile,twentyThirdFile,twentyFourthFile].map(f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).productos:{}));}
function premium(){return fs.existsSync(secondFile)?JSON.parse(fs.readFileSync(secondFile,'utf8')).ajuste_titulo:null;}
function hash(url){const f='.'+url;return fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null;}
function valid(r){return r&&allowed.has(r.sku)&&r.revisado_visual===true&&
 hash(r.portada_anterior.url)===r.portada_anterior.sha256&&
 (r.mantener_vistas||[]).every(p=>hash(p.original)===p.sha256_original&&Object.values(p.versiones).every(v=>hash(v.url)===v.sha256))&&
 (r.portadas_previas_autorizadas||[]).every(p=>hash(p.url)===p.sha256)&&
 (r.archivos_originales_conservados||[]).every(p=>hash(p.url)===p.sha256)&&
 (r.vistas_retira_archivos_conservados||[]).every(p=>hash(p.url)===p.sha256)&&
 (r.imagenProfesional?[r.imagenProfesional]:r.vistas||[]).every(p=>hash(p.original)===p.sha256_original&&Object.values(p.versiones).every(v=>hash(v.url)===v.sha256));}
function capture(){
 const products=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 const registry=rows();
 return new Set(products.filter(p=>{const r=registry[p.sku];return valid(r)&&[r.portada_anterior.url,r.imagenProfesional?.versiones['1200'].url,...(r.portadas_previas_autorizadas||[]).map(v=>v.url)].includes(p.imageUrl);}).map(p=>p.sku));
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
   const original=text.slice(start,i+1),p=JSON.parse(original),r=registry[p.sku];let updated=original;
   if(selected.has(p.sku)&&valid(r)&&r.imagenProfesional&&[r.portada_anterior.url,r.imagenProfesional.versiones['1200'].url,...(r.portadas_previas_autorizadas||[]).map(v=>v.url)].includes(p.imageUrl)){
    updated=original.replace(/("imageUrl"\s*:\s*)"(?:\\.|[^"\\])*"/,(_,key)=>key+JSON.stringify(r.imagenProfesional.versiones['1200'].url));
   }
   const title=premium();
   if(p.sku==='CUBO024'&&title?.sku==='CUBO024'&&title.autorizado_por_propietario===true&&[title.anterior,title.nuevo].includes(p.name))updated=updated.replace(/("name"\s*:\s*)"(?:\\.|[^"\\])*"/,(_,key)=>key+JSON.stringify(title.nuevo));
   if(updated!==original)edits.push([start,i+1,updated]);
   start=-1;
  }
 }
 let result=text;for(const [a,b,value]of edits.reverse())result=result.slice(0,a)+value+result.slice(b);
 const offset=m.index+m[0].indexOf(text);return source.slice(0,offset)+result+source.slice(offset+text.length);
}
function restore(selected){const before=fs.readFileSync('index.html','utf8'),after=patchObjects(before,selected);if(after!==before)fs.writeFileSync('index.html',after);}
function overlay(p,custom,selected){
 const title=premium();
 if(p.sku==='CUBO024'&&title?.sku==='CUBO024'&&title.autorizado_por_propietario===true&&[title.anterior,title.nuevo].includes(custom.nombre))custom.nombre=title.nuevo;
 const r=rows()[p.sku];if(!selected.has(p.sku)||!valid(r))return;
 const old=custom.imagenProfesional?.versiones?.['1200'];
 const next=r.imagenProfesional?.versiones['1200'];
 if(!old||![[r.portada_anterior.url,r.portada_anterior.sha256],...(next?[[next.url,next.sha256]]:[]),...(r.portadas_previas_autorizadas||[]).map(p=>[p.url,p.sha256])].some(([url,sha])=>old.url===url&&old.sha256===sha))return;
 if(r.vistas){const kept=(custom.galeria||[]).filter(i=>!(r.retirar_vistas||[]).includes(i.versiones['1200'].url));const urls=new Set(kept.map(i=>i.versiones['1200'].url));custom.galeria=[...kept,...r.vistas.filter(i=>!urls.has(i.versiones['1200'].url))];return;}
 const secondary=(custom.galeria||[]).filter(i=>i.posicion!==1&&!(r.retirar_vistas||[]).includes(i.versiones['1200'].url)&&i.versiones['1200'].url!==r.imagenProfesional.versiones['1200'].url);
 const urls=new Set(secondary.map(i=>i.versiones['1200'].url));
 secondary.push(...(r.mantener_vistas||[]).filter(i=>!urls.has(i.versiones['1200'].url)));
 custom.imagen=r.imagenProfesional.versiones['1200'].url;custom.imagenProfesional=r.imagenProfesional;
 custom.galeria=[r.imagenProfesional,...secondary];custom.imagenPendiente=false;
}
module.exports={capture,restore,overlay,patchObjects,valid};
