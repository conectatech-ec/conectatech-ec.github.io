// Sólo unidades selladas por SKU con instrucción del propietario y evidencia inmutable.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function(sku,root=process.cwd()){
 try{
  root=fs.realpathSync(root);const data=JSON.parse(fs.readFileSync(path.join(root,'importacion/excepciones-presentacion-sellada.json'),'utf8')),row=data.productos?.[sku];
  if(data.version!==1||row?.aprobado_por_propietario!==true||!['UNIDAD_SORPRESA_SELLADA','UNIDAD_COMERCIAL_SELLADA'].includes(row.tipo))return false;
  const p=row.evidencia||data.evidencia;if(typeof p?.archivo!=='string'||!p.archivo.startsWith('reportes/')||!p.archivo.endsWith('.json')||!/^[a-f0-9]{64}$/.test(p.sha256||''))return false;
  const file=fs.realpathSync(path.resolve(root,p.archivo));if(!file.startsWith(root+path.sep))return false;
  const bytes=fs.readFileSync(file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==p.sha256)return false;
  const source=JSON.parse(bytes),claim=source.excepciones_presentacion_sellada?.[sku];
  return source.origen==='CONFIRMACION_PROPIETARIO_CHAT'&&['autorizada','mostrar_empaque','unidad_sellada'].every(k=>claim?.[k]===true);
 }catch(_){return false;}
};
