// Adapter for the existing commercial receiver and original publisher only.
export const observerContract='CT593_OBSERVER_V1';
const repo='conectatech-ec/conectatech-ec.github.io';
const branch='automatizacion/piloto-cloud-3sku-20261015';
const workflow='publicar-corte-comercial-593.yml';
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function observerReady(env){return !!env.COMMERCIAL_ACTIONS_TOKEN&&env.COMMERCIAL_OBSERVER_READY===observerContract;}
export async function dispatchReport(env,sha,{fetcher=fetch}={}){
 if(!observerReady(env))return 'observer_not_ready';
 if(!sha64(sha))return 'invalid_source';
 try{
  const r=await fetcher('https://api.github.com/repos/'+repo+'/actions/workflows/'+workflow+'/dispatches',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+env.COMMERCIAL_ACTIONS_TOKEN,Accept:'application/vnd.github+json',
    'Content-Type':'application/json','User-Agent':'CONECTATECH-593','X-GitHub-Api-Version':'2022-11-28'},
   body:JSON.stringify({ref:branch,inputs:{source_sha256:sha,verify_only:false}})});
  return r.status===204?'triggered':'dispatch_denied';
 }catch{return 'dispatch_unavailable';}
}
export async function verifyPublished593(sha,commit,validation,{fetcher=fetch}={}){
 if(!sha64(sha)||!/^([a-f0-9]{40})$/.test(commit||'')||!validation)return false;
 const options={redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/vnd.github+json','User-Agent':'CONECTATECH-593'}};
 try{
  const [stateResponse,ancestryResponse]=await Promise.all([
   fetcher('https://raw.githubusercontent.com/'+repo+'/'+commit+'/datos-593/estado-ultimo-corte.json',options),
   fetcher('https://api.github.com/repos/'+repo+'/compare/'+commit+'...main',options)]);
  if(!stateResponse.ok||!ancestryResponse.ok)return false;
  const stateText=await stateResponse.text(),ancestryText=await ancestryResponse.text();
  if(stateText.length>100000||ancestryText.length>2000000)return false;
  const s=JSON.parse(stateText),a=JSON.parse(ancestryText);
  return ['ahead','identical'].includes(a.status)&&a.merge_base_commit?.sha===commit&&
   s.origen_sha256===sha&&s.fecha_corte===validation.cut_date&&
   s.revision_fuente?.generado_en===validation.generated_at;
 }catch{return false;}
}
