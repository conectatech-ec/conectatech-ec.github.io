// Una única lectura autenticada. El sobre privado nunca se imprime ni persiste.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const TRANSPORT_SHA256='eeaa847164b5e1e40a177cadadda30fb542b1f8e3cb482b6dd47003641462b8a';
const hex=/^[a-f0-9]{64}$/;
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT[0-9:.]+(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value));
export async function readStatus(request,now=Date.now()){
 const envelope=await request({path:'/commercial/catalog/status',input:''});
 if(envelope?.status!==200)throw Error('STATUS_READ_FAILED');
 let data;
 try{data=JSON.parse(Buffer.from(envelope.bytes_b64,'base64').toString('utf8'));}catch{throw Error('STATUS_INVALID');}
 if(data?.schema!=='conectatech.commercial.v1'||!hex.test(data.source_sha256||'')||
    !/^\d{4}-\d\d-\d\d$/.test(data.cut_date||'')||!Number.isFinite(Date.parse(data.cut_date))||
    !instant(data.generated_at)||!instant(data.expires_at)||typeof data.current!=='boolean'||
    (data.processor_release!=null&&!/^[a-f0-9]{40}$/.test(data.processor_release)))throw Error('STATUS_INVALID');
 return {verified_at:new Date(now).toISOString(),cut_date:data.cut_date,generated_at:data.generated_at,
  source_sha256:data.source_sha256,source_version:'593-v1-'+data.source_sha256,source_version_derived:true,
  expires_at:data.expires_at,current:data.current,current_at_verification:Date.parse(data.expires_at)>=now,
  processor_release:data.processor_release??null,worker_release:null,
  worker_release_note:'El endpoint consultado no acredita la revisión del Worker. No se consultó /health.'};
}
export async function run(transportPath){
 if(!transportPath||createHash('sha256').update(fs.readFileSync(transportPath)).digest('hex')!==TRANSPORT_SHA256)throw Error('TRANSPORT_NOT_REVIEWED');
 const {privateRequest}=await import(pathToFileURL(path.resolve(transportPath)).href);
 return readStatus(privateRequest);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await run(process.argv[2]),null,2));}
 catch{console.log(JSON.stringify({verified:false,error:'DATAHUB_STATUS_NOT_VERIFIED'}));process.exitCode=1;}
}
