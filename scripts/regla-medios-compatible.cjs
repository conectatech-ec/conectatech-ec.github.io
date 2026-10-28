// Una corrección comercial puede conservar la aprobación de los mismos medios.
// Requiere un registro explícito ligado por SHA y la misma política fotográfica.
const crypto=require('node:crypto');
const ignored=new Set(['autenticidad','evidencia_autenticidad','revision','rotulo_ficha','conservar_medios_comercial']);
const photoPolicy=r=>JSON.stringify(Object.fromEntries(Object.entries(r||{}).filter(([k])=>!ignored.has(k)).sort(([a],[b])=>a.localeCompare(b))));
module.exports=function compatibleRevision(media,rule){
 if(!media)return false;
 if(media.revision_regla===rule.revision)return true;
 const keep=rule.conservar_medios_comercial;
 return !!keep&&keep.revision_medios===media.revision_regla&&keep.revision_comercial===rule.revision&&
  typeof keep.motivo==='string'&&keep.motivo.trim().length>0&&
  keep.sha256_medios===crypto.createHash('sha256').update(JSON.stringify(media)).digest('hex')&&
  photoPolicy(media.regla)===photoPolicy(rule);
};
