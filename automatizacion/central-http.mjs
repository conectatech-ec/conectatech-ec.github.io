// Private Worker transport. Callers capture stdout in RAM; never persist the envelope.
import {pathToFileURL} from 'node:url';
const ORIGIN='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const READ_ONLY=new Set(['/health','/commercial/catalog','/commercial/catalog/status','/commercial/status','/messenger/status','/messenger/seller/status']);
export async function privateRequest({path,input='',token=process.env.PILOT_TOKEN,fetcher=fetch}={}){
 const readOnly=READ_ONLY.has(path)||/^\/commercial\/status\?sha256=[a-f0-9]{64}$/.test(path||'');
 if(!readOnly&&!/^\/commercial\/(?:report|complete)(?:\?sha256=[a-f0-9]{64})?$/.test(path||''))throw Error('PRIVATE_SOURCE_PATH');
 if(readOnly&&input)throw Error('PRIVATE_SOURCE_READ_ONLY');
 if(!token)throw Error('PRIVATE_SOURCE_TOKEN_REQUIRED');
 try{
  const r=await fetcher(ORIGIN+path,{method:input?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Cache-Control':'no-cache'},body:input||undefined,signal:AbortSignal.timeout(45000)});
  const parts=[];let n=0;for await(const part of r.body){n+=part.length;if(n>2000000)throw Error('SOURCE_SIZE');parts.push(part);}
  return {status:r.status,filename:r.headers.get('x-report-filename'),bytes_b64:Buffer.concat(parts).toString('base64')};
 }catch{return {status:0,error:'PRIVATE_SOURCE_TRANSPORT'};}
}
async function main(){
 let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>2_000_000)throw Error('PRIVATE_SOURCE_SIZE');}
 const result=await privateRequest({path:process.argv[2],input});
 console.log(JSON.stringify(result));if(result.status===0)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(()=>{console.log(JSON.stringify({status:0,error:'PRIVATE_SOURCE_REQUEST_REJECTED'}));process.exitCode=1;});
