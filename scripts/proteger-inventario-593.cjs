'use strict';
// Shared gate for existing publishers. No writes, schedules or business rules.
class ReporteIncompleto extends Error {
 constructor(code,details){super(code+' '+JSON.stringify(details));this.code=code;this.details=details;}
}
function comprobar({before,after,sourceSkus,sourceCount}){
 const unique=new Set(sourceSkus);
 const details={productos_unicos:unique.size,minimo:500,referencia:before.length};
 if(unique.size!==sourceSkus.length||sourceSkus.some(s=>!/^[A-Z0-9_-]{3,40}$/.test(s)))throw new ReporteIncompleto('REPORT_INVALID_OR_DUPLICATE_SKU',details);
 if(unique.size<500||!Number.isSafeInteger(sourceCount)||sourceCount<500)throw new ReporteIncompleto('REPORT_BELOW_MINIMUM_PRODUCTS',details);
 const missing=before.filter(p=>!unique.has(p.sku));
 details.ausentes=missing.length;
 if((before.length-missing.length)*10<before.length*9)throw new ReporteIncompleto('INCOMPLETE_FULL_REPORT',details);
 const next=new Map(after.map(p=>[p.sku,p]));
 const affected=new Set(missing.map(p=>p.sku));
 for(const p of before)if(p.stock>0&&!(next.get(p.sku)?.stock>0))affected.add(p.sku);
 details.ausentes_o_nuevos_no_disponibles=affected.size;
 details.limite_bajas=500;
 if(affected.size>=500)throw new ReporteIncompleto('REPORT_MASS_UNAVAILABILITY',details);
 return details;
}
function ejecutar(run){
 try{return run();}catch(error){
  if(error instanceof ReporteIncompleto)console.error(JSON.stringify({estado:'REPORTE_RECHAZADO',motivo:error.code,...error.details,accion:'ESPERAR_REPORTE_COMPLETO_CORREGIDO',inventario_anterior_conservado:true}));
  throw error;
 }
}
module.exports={comprobar,ejecutar,ReporteIncompleto};
