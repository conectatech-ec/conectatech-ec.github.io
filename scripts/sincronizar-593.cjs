const fs=require('fs');
const source='datos-593/inventario-publico.csv';
const apply=process.env.APLICAR_CAMBIOS==='SI';
const confirm=process.env.CONFIRMAR==='APLICAR';
if(apply&&!confirm)throw Error('Para aplicar cambios debe confirmar APLICAR');
const csv=fs.readFileSync(source,'utf8');
function parseCSV(str){
 const records=[];let record=[],cell='',q=false;
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(c==='"'){if(q&&str[i+1]==='"'){cell+='"';i++;}else q=!q;}
  else if(c===','&&!q){record.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&str[i+1]==='\n')i++;record.push(cell);cell='';if(record.some(x=>x!==''))records.push(record);record=[];}
  else cell+=c;
 }
 if(q)throw Error('CSV inválido: comillas sin cerrar');
 if(record.length||cell){record.push(cell);records.push(record);}
 const headers=records.shift().map(h=>h.replace(/^\uFEFF/,'').trim());
 const expected=['sku','nombre','stock','precio_general','iva','tipo','categoria','clasificacion'];
 if(expected.some(e=>!headers.includes(e)))throw Error('Encabezados incorrectos; solo usar exportación pública 593 preparada y validada');
 return records.map((r,i)=>{
  if(r.length!==headers.length)throw Error('Columnas inconsistentes en fila '+(i+2));
  return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));
 });
}
const input=parseCSV(csv);
if(input.length<1000)throw Error('Exportación aparentemente incompleta: '+input.length+' filas');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
if(!match)throw Error('No se encontró array de productos');
const original=JSON.parse(match[1]);
const bySKU=new Map(original.map(p=>[p.sku,p]));
if(bySKU.size!==original.length)throw Error('SKU duplicado en web');
const existingSKU=new Set(),seen=new Set(),added=[],updated=[],outOfStock=[],warnings=[];
const round=n=>Math.round((n+1e-9)*100)/100;
const safeCategory=s=>s?s[0].toUpperCase()+s.slice(1).toLowerCase():'Otros';
for(const raw of input){
 const sku=raw.sku.trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,40}$/.test(sku)||seen.has(sku))throw Error('SKU inválido o duplicado: '+sku);
 seen.add(sku);
 const stock=Number(raw.stock),base=Number(raw.precio_general),iva=Number(raw.iva);
 if(![stock,base,iva].every(Number.isFinite)||stock<-10000||stock>1000000||base<0||base>100000)throw Error('Cantidad o precio inválido: '+sku);
 const current=bySKU.get(sku);
 const sellable=raw.tipo.toUpperCase()==='PRODUCTO'&&base>0;
 if(current){
  existingSKU.add(sku);
  const nextStock=sellable?stock:0;
  const nextPromo=base>0?round(base*1.15):current.promo;
  const nextPvp=base>0?round(nextPromo*1.15):current.pvp;
  if(current.stock!==nextStock||current.promo!==nextPromo||current.pvp!==nextPvp){
   updated.push({sku,antes:{stock:current.stock,promo:current.promo,pvp:current.pvp},despues:{stock:nextStock,promo:nextPromo,pvp:nextPvp}});
   if(current.stock>0&&nextStock<=0)outOfStock.push(sku);
   current.stock=nextStock;current.promo=nextPromo;current.pvp=nextPvp;
  }
 }else if(sellable&&stock>0){
  if(!raw.nombre)throw Error('Nombre vacío para '+sku);
  const promo=round(base*1.15),pvp=round(promo*1.15);
  const p={sku,name:raw.nombre,category:safeCategory(raw.categoria),stock,promo,pvp,priority:'MEDIA',role:'CATALOGO'};
  original.push(p);bySKU.set(sku,p);added.push({sku,nombre:p.name,stock,promo,pvp});
 }
}
const notInExport=[...existingSKU].length;
const missing=[...new Set(JSON.parse(match[1]).map(p=>p.sku))].filter(sku=>!seen.has(sku));
if(missing.length>10)throw Error('Exportación incompleta o incompatible: '+missing.length+' SKU anteriores ausentes');
if(missing.length)warnings.push('SKU anteriores ausentes en exportación: '+missing.join(', '));
if(added.length>250||updated.length>500)throw Error('Cambios masivos inesperados, requieren revisión: '+added.length+' altas y '+updated.length+' actualizaciones');
const report={fecha:new Date().toISOString(),modo:apply?'APLICACION_AUTORIZADA':'SIMULACION',source,filas593:input.length,
 fichasWebAntes:bySKU.size-added.length,fichasWebDespues:original.length,nuevos:added.length,
 modificados:updated.length,agotados:outOfStock.length,warnings,detalles:{nuevos:added,modificados:updated,agotados:outOfStock,ausentes:missing}};
fs.mkdirSync('reportes',{recursive:true});
fs.writeFileSync('reportes/sincronizacion-593.json',JSON.stringify(report,null,2)+'\n');
if(apply){
 const rendered=html.replace(match[0],'const products='+JSON.stringify(original)+';\n');
 if(rendered===html&&added.length+updated.length>0)throw Error('No se logró actualizar HTML');
 fs.writeFileSync('index.html',rendered);
}
console.log(JSON.stringify({modo:report.modo,filas593:input.length,nuevos:added.length,modificados:updated.length,agotados:outOfStock.length,ausentes:missing.length},null,2));
