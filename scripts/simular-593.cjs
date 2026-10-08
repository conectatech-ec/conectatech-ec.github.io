const fs=require('fs');
const source='datos-593/inventario-publico.csv';
if(!fs.existsSync(source))throw Error('Falta '+source+'. Subir primero exportación pública preparada desde 593.');
function parseCSV(text){
 const out=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}
  else if(c===','&&!q){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v!==''))out.push(row);row=[];}
  else cell+=c;
 }
 if(q)throw Error('CSV con comillas sin cerrar');
 if(cell||row.length){row.push(cell);out.push(row);}
 const heads=out.shift().map(x=>x.replace(/^\uFEFF/,'').trim());
 return out.map((r,i)=>Object.fromEntries(heads.map((h,j)=>[h,(r[j]||'').trim()])));
}
const input=parseCSV(fs.readFileSync(source,'utf8'));
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
if(!match)throw Error('Catálogo original no encontrado');
const current=JSON.parse(match[1]); const old=Object.fromEntries(current.map(p=>[p.sku,p]));
const seen=new Set(),updates=[],news=[],noLonger=[];
for(const x of input){
 const sku=x.sku.toUpperCase();
 if(!sku||seen.has(sku))throw Error('SKU vacío o duplicado: '+sku);
 seen.add(sku);
 const stock=Number(x.stock),base=Number(x.precio_general),iva=Number(x.iva);
 if(!Number.isFinite(stock)||!Number.isFinite(base)||!Number.isFinite(iva)||stock<-10000||stock>1000000||base<0||base>100000)throw Error('Valores inválidos en '+sku);
 const applicable=x.tipo==='PRODUCTO'&&stock>0&&base>0;
 // Regla comercial de este catálogo: P. General x 1.15 y luego x 1.15.
 const promo=Math.round((base*1.15+Number.EPSILON)*100)/100;
 const pvp=Math.round((promo*1.15+Number.EPSILON)*100)/100;
 const oldP=old[sku];
 if(oldP){
  if(oldP.stock!==stock||Math.abs(oldP.promo-promo)>0.009||Math.abs(oldP.pvp-pvp)>0.009){
   updates.push({sku,nombre:x.nombre,antes:{stock:oldP.stock,promo:oldP.promo,pvp:oldP.pvp},despues:{stock,promo,pvp},publicable:applicable});
  }
 }else if(applicable)news.push({sku,nombre:x.nombre,stock,promo,pvp,categoria:x.categoria});
}
for(const p of current){const x=input.find(r=>r.sku.toUpperCase()===p.sku);if(!x||x.tipo!=='PRODUCTO'||Number(x.stock)<=0||Number(x.precio_general)<=0)noLonger.push({sku:p.sku,nombre:p.name,stock593:x?.stock??null});}
const report={modo:'SIMULACION, SIN MODIFICAR CATALOGO',fuente:source,fecha:new Date().toISOString(),filas:input.length,skuCatalogo:current.length,nuevos:news.length,actualizaciones:updates.length,noPublicables:noLonger.length,detalle:{nuevos:news,actualizaciones:updates,noPublicables:noLonger}};
fs.mkdirSync('reportes',{recursive:true});
fs.writeFileSync('reportes/sincronizacion-593.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({filas:report.filas,nuevos:report.nuevos,actualizaciones:report.actualizaciones,noPublicables:report.noPublicables}));
