import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readStatus,run} from '../servidor/verificar-status-datahub.mjs';
const body={schema:'conectatech.commercial.v1',source_sha256:'a'.repeat(64),cut_date:'2026-11-06',generated_at:'2026-11-06T10:00:00Z',expires_at:'2026-11-07T10:00:00Z',current:false,processor_release:'b'.repeat(40),products:[{private:'SECRET'}],token:'SECRET'};
const envelope=data=>({status:200,bytes_b64:Buffer.from(JSON.stringify(data)).toString('base64')});
test('una sola llamada con ruta fija y sin cuerpo; salida acotada sin datos privados',async()=>{
 const calls=[];const output=await readStatus(async args=>{calls.push(args);return envelope(body);},Date.parse('2026-11-08T00:00:00Z'));
 assert.deepEqual(calls,[{path:'/commercial/catalog/status',input:''}]);
 assert.equal(output.source_version,'593-v1-'+body.source_sha256);assert.equal(output.current,false);
 assert.equal(output.current_at_verification,false);assert.equal(output.worker_release,null);
 assert.ok(!/SECRET|bytes_b64|products|token/.test(JSON.stringify(output)));
});
test('401 y errores no se convierten en verificación ni imprimen el cuerpo',async()=>{
 for(const status of [0,401,403,500])await assert.rejects(readStatus(async()=>({status,bytes_b64:'SECRET'})),/STATUS_READ_FAILED/);
});
test('rechaza metadatos ausentes o valores que podrían filtrar texto arbitrario',async()=>{
 for(const edit of [{source_sha256:'SECRET'},{current:'SECRET'},{processor_release:'SECRET'},{generated_at:'SECRET'},{schema:null}])
  await assert.rejects(readStatus(async()=>envelope({...body,...edit})),/STATUS_INVALID/);
});
test('no confunde vigencia declarada con fecha local ni con revisión del Worker',async()=>{
 const output=await readStatus(async()=>envelope({...body,current:true}),Date.parse('2026-11-08T00:00:00Z'));
 assert.equal(output.current,true);assert.equal(output.current_at_verification,false);assert.equal(output.worker_release,null);
});
test('un transporte no revisado se rechaza antes de importarlo',async()=>{
 await assert.rejects(run(import.meta.filename),/TRANSPORT_NOT_REVIEWED/);
});
