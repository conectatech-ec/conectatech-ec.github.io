// Private Worker transport for Python jobs. stdout is captured, never written to Actions logs.
const path=process.argv[2];
if(!/^\/commercial\/(?:catalog(?:\/status)?|status|report|complete)(?:\?sha256=[a-f0-9]{64})?$/.test(path||''))throw Error('PRIVATE_SOURCE_PATH');
let input='';for await(const chunk of process.stdin)input+=chunk;
try{
 const r=await fetch('https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'+path,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},body:input||undefined,signal:AbortSignal.timeout(45000)});
 const parts=[];let n=0;for await(const part of r.body){n+=part.length;if(n>2000000)throw Error('SOURCE_SIZE');parts.push(part);}
 console.log(JSON.stringify({status:r.status,filename:r.headers.get('x-report-filename'),bytes_b64:Buffer.concat(parts).toString('base64')}));
}catch{console.log(JSON.stringify({status:0,error:'PRIVATE_SOURCE_TRANSPORT'}));process.exitCode=1;}
