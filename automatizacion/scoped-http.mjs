// Private GET-only transport. Python captures stdout in RAM; no body is persisted.
import {pathToFileURL} from 'node:url';
const paths=new Set(['/health','/commercial/catalog','/commercial/catalog/status','/messenger/status','/messenger/seller/status']);
export async function readPrivate(path,{token=process.env.PILOT_TOKEN,fetcher=fetch}={}){
 if(!paths.has(path)||!token)throw Error('SCOPED_PRIVATE_READ_REJECTED');
 try{
  const r=await fetcher('https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(45000)});
  const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.byteLength;if(size>2_000_000)throw Error();chunks.push(chunk);}
  return {status:r.status,bytes_b64:Buffer.concat(chunks).toString('base64')};
 }catch{return {status:0,error:'SCOPED_PRIVATE_TRANSPORT_FAILED'};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 readPrivate(process.argv[2]).then(result=>{console.log(JSON.stringify(result));if(result.status===0)process.exitCode=1;}).catch(()=>{console.log(JSON.stringify({status:0,error:'SCOPED_PRIVATE_READ_REJECTED'}));process.exitCode=1;});
