'use strict';
// Recibo del validador existente. Nunca usa la hora de subida como fecha del inventario.
const SHA=/^[a-f0-9]{64}$/;
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('REVISION_593_HORA_CONFIRMADA_INVALIDA');
 const n=Date.parse(value);
 if(new Date(n).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))throw Error('REVISION_593_HORA_CONFIRMADA_INVALIDA');
 return n;
}
function localDay(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function validar(cut,prior,baseline){
 const same=prior?.origen_sha256===cut.sha256_original&&prior?.fecha_corte===cut.fecha_corte;
 if(same)return prior.revision_fuente||null;
 const intradia=prior?.fecha_corte===cut.fecha_corte;
 const r=cut.revision_fuente;
 if(!r){if(intradia)throw Error('REVISION_593_FALTA_RECIBO_ORDEN: Corte con igual fecha requiere prueba de orden');return null;}
 if(r.version!==1||!SHA.test(r.anterior_sha256||'')||r.anterior_sha256!==prior?.origen_sha256)throw Error('REVISION_593_BASE_CAMBIO_REVALIDAR');
 const previous=prior.revision_fuente||baseline?.revision_fuente;
 if(!Number.isSafeInteger(r.secuencia)||r.secuencia!==(previous?.secuencia||0)+1)throw Error('REVISION_593_SECUENCIA_NO_POSTERIOR');
 const generated=instant(r.generado_en),received=instant(r.recibido_en);
 if(received>Date.now()+120000)throw Error('REVISION_593_RECEPCION_FUTURA');
 if(localDay(generated)!==cut.fecha_corte||generated>received)throw Error('REVISION_593_FECHA_CORTE_NO_CONFIRMADA');
 if(r.evidencia!=='XLSX_CORE_CREATED_EQUALS_MODIFIED')throw Error('REVISION_593_ORIGEN_HORA_NO_CONFIRMADO');
 if(previous&&received<=instant(previous.recibido_en))throw Error('REVISION_593_RECEPCION_NO_POSTERIOR');
 let priorGenerated=previous?.generado_en;
 // Migración del recibo: el validador recupera el XLSX previo privado y confirma
 // sus core timestamps/SHA. No se inventa su hora a partir del commit o de Drive.
 if(intradia&&!priorGenerated){
  const proof=r.anterior_confirmado;
  if(!proof||proof.sha256!==prior.origen_sha256||proof.evidencia!=='XLSX_CORE_CREATED_EQUALS_MODIFIED')throw Error('REVISION_593_FALTA_ORDEN_CORTE_ANTERIOR');
  priorGenerated=proof.generado_en;
  if(localDay(instant(priorGenerated))!==prior.fecha_corte)throw Error('REVISION_593_ANTERIOR_NO_CONFIRMADO');
 }
 if(priorGenerated&&generated<=instant(priorGenerated))throw Error('REVISION_593_RETROCESO_HORA_EXPORTACION');
 return {version:1,anterior_sha256:r.anterior_sha256,secuencia:r.secuencia,generado_en:r.generado_en,recibido_en:r.recibido_en,evidencia:r.evidencia};
}
function comprobarHistorial(cut,prior,root=process.cwd()){
 if(!prior||prior.origen_sha256===cut.sha256_original)return;
 const cp=require('child_process');const file='datos-593/estado-ultimo-corte.json';
 const commits=cp.execFileSync('git',['log','--format=%H','--',file],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const commit of commits){
  const state=JSON.parse(cp.execFileSync('git',['show',commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
  if(state.origen_sha256===cut.sha256_original)throw Error('REVISION_593_SHA_HISTORICO_NO_REPUBLICAR');
 }
}
module.exports={validar,comprobarHistorial};
