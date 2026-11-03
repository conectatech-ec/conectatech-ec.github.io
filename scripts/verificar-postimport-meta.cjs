'use strict';
// Finite, GET-only verification. Never imports, changes assets, or logs raw Graph data.
const fs=require('node:fs'),path=require('node:path');
const PUBLIC_SKUS=Object.freeze(['AUDI044','AUDI115','REL069','CABL139']);
const FIELD_CHOICES=Object.freeze(['retailer_id,name,image_url','retailer_id,name','retailer_id,image_url','retailer_id']);
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV_INVALID');if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,''));
 if(new Set(headers).size!==headers.length||!['id','title','image_link'].every(h=>headers.includes(h)))throw Error('CSV_INVALID');
 return rows.map(r=>{if(r.length!==headers.length)throw Error('CSV_INVALID');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
function httpsURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u:null;}catch{return null;}}
function nameKey(value){return typeof value==='string'?value.normalize('NFC').trim():'';}
function expectedTargets(csv){
 const rows=parseCSV(csv),out=new Map();for(const sku of PUBLIC_SKUS){const found=rows.filter(r=>r.id===sku);if(found.length!==1||!nameKey(found[0].title)||!httpsURL(found[0].image_link))throw Error('CSV_TARGETS_INVALID');out.set(sku,{name:nameKey(found[0].title),sourceURL:httpsURL(found[0].image_link).href});}return out;
}
function createReadOnlyReader(api,{catalogId,maxRequests=20}={}){
 if(!api||typeof api.request!=='function'||!/^\d+$/.test(String(catalogId||''))||!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>20)throw Error('VERIFY_CONFIGURATION_INVALID');
 const allowedPath=String(catalogId)+'/products';let requests=0;
 return {get requests(){return requests;},async request(method,resource,params={}){
  if(method!=='GET')throw Error('VERIFY_WRITES_FORBIDDEN');
  if(resource!==allowedPath||!FIELD_CHOICES.includes(params.fields)||params.limit!==100||Object.keys(params).some(k=>!['fields','limit','after'].includes(k))||params.after!==undefined&&(typeof params.after!=='string'||!params.after||params.after.length>8192))throw Error('VERIFY_REQUEST_OUT_OF_SCOPE');
  if(requests>=maxRequests)throw Error('VERIFY_REQUEST_LIMIT');requests++;
  return api.request('GET',allowedPath,{fields:params.fields,limit:100,...(params.after?{after:params.after}:{})});
 }};
}
function receipt(){return {schema:'conectatech.meta_postimport_readonly.v1',read_only:true,writes_attempted:false,execution_enabled:true,local_expected_csv_valid:false,graph_access_confirmed:false,pagination_complete:false,request_limit_reached:false,pagination_invalid:false,remote_read_failed:false,field_fallback_used:false,requested_fields:{retailer_id:false,name:false,image_url:false},requests:0,pages:0,targets_expected:PUBLIC_SKUS.length,targets_found:0,duplicate_target_count:0,names_confirmed:0,accepted_source_url_matches:0,image_cache_unknown:0,image_unknown:PUBLIC_SKUS.length,all_names_confirmed:false,all_accepted_source_metadata_confirmed:false,rendered_image_bytes_verified:false,whatsapp_client_visibility_verified:false,details:[]};}
function imageFacts(remoteURL,expectedURL){
 const remote=httpsURL(remoteURL),cache=!!remote&&/(?:^|\.)(?:fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(remote.hostname);
 // Even a matching origin URL confirms only accepted source metadata, never pixels/cache freshness.
 return {image_url_available:!!remote,accepted_source_url_matches:!!remote&&!cache&&remote.href===expectedURL,image_is_meta_cache:cache,image_exact_content_verified:false};
}
async function verifyPostImport({csv,api,catalogId,maxRequests=20}={}){
 const result=receipt();let expected,reader;
 try{expected=expectedTargets(csv);result.local_expected_csv_valid=true;reader=createReadOnlyReader(api,{catalogId,maxRequests});}catch{return result;}
 const records=new Map(PUBLIC_SKUS.map(sku=>[sku,[]])),cursors=new Set();let response,fields,after;
 try{
  // A field/schema error may mean a field is inaccessible in this API version.
  // Fallback preserves unknowns; it never claims the omitted field matches.
  for(let i=0;i<FIELD_CHOICES.length;i++){
   fields=FIELD_CHOICES[i];try{response=await reader.request('GET',String(catalogId)+'/products',{fields,limit:100});break;}
   catch(error){if(error.message==='VERIFY_REQUEST_LIMIT')throw error;if(Number(error.meta?.code)!==100||i===FIELD_CHOICES.length-1)throw Error('VERIFY_REMOTE_READ_FAILED');result.field_fallback_used=true;}
  }
  result.requested_fields=Object.fromEntries(['retailer_id','name','image_url'].map(f=>[f,fields.split(',').includes(f)]));
  while(true){
   if(!Array.isArray(response?.data))throw Error('VERIFY_REMOTE_READ_FAILED');result.graph_access_confirmed=true;result.pages++;
   for(const item of response.data){if(item&&records.has(item.retailer_id))records.get(item.retailer_id).push({name:item.name,image_url:item.image_url});}
   if(!response.paging?.next){result.pagination_complete=true;break;}
   after=response.paging.cursors?.after;if(typeof after!=='string'||!after||cursors.has(after)){result.pagination_invalid=true;break;}cursors.add(after);
   response=await reader.request('GET',String(catalogId)+'/products',{fields,limit:100,after});
  }
 }catch(error){if(error.message==='VERIFY_REQUEST_LIMIT')result.request_limit_reached=true;else result.remote_read_failed=true;}
 result.requests=reader.requests;
 for(const sku of PUBLIC_SKUS){
  const found=records.get(sku),unique=result.pagination_complete&&found.length===1,item=found[0],target=expected.get(sku),nameAvailable=typeof item?.name==='string'&&!!nameKey(item.name),image=imageFacts(item?.image_url,target.sourceURL);
  const accepted=unique&&image.accepted_source_url_matches,detail={sku,found:found.length>0,unique_confirmed:unique,name_available:nameAvailable,name_matches_expected:unique&&nameAvailable&&nameKey(item.name)===target.name,image_url_available:image.image_url_available,accepted_source_url_matches:accepted,image_is_meta_cache:image.image_is_meta_cache,image_unknown:!accepted,image_exact_content_verified:false};
  result.details.push(detail);if(detail.found)result.targets_found++;if(found.length>1)result.duplicate_target_count++;if(detail.name_matches_expected)result.names_confirmed++;if(accepted)result.accepted_source_url_matches++;if(image.image_is_meta_cache)result.image_cache_unknown++;
 }
 result.image_unknown=PUBLIC_SKUS.length-result.accepted_source_url_matches;result.all_names_confirmed=result.names_confirmed===PUBLIC_SKUS.length;result.all_accepted_source_metadata_confirmed=result.accepted_source_url_matches===PUBLIC_SKUS.length;
 return result;
}
async function main(){
 const args=process.argv.slice(2),options={};if(args[0]!=='--read-only'||args.length!==7)throw Error('VERIFY_USAGE_READ_ONLY_CSV_PLAN_OUTPUT');
 for(let i=1;i<args.length;i+=2){if(!['--csv','--plan','--output'].includes(args[i])||options[args[i]])throw Error('VERIFY_USAGE_READ_ONLY_CSV_PLAN_OUTPUT');options[args[i]]=args[i+1];}
 let result=receipt();result.execution_enabled=false;
 if(process.env.META_VERIFY_READ_ONLY==='true'){
  try{
   const {Graph}=require('./sincronizar-conjuntos-meta.cjs');
   const api=new Graph({token:process.env.META_ACCESS_TOKEN,version:process.env.META_GRAPH_VERSION||'v26.0'}),plan=JSON.parse(fs.readFileSync(options['--plan'],'utf8'));
   result=await verifyPostImport({csv:fs.readFileSync(options['--csv'],'utf8'),api,catalogId:plan.catalog_id,maxRequests:20});
  }catch{result.execution_enabled=true;result.remote_read_failed=true;}
 }
 fs.mkdirSync(path.dirname(options['--output']),{recursive:true});fs.writeFileSync(options['--output'],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(()=>{console.error('VERIFY_FAILED_NO_RAW_DETAILS');process.exitCode=1;});
module.exports={PUBLIC_SKUS,verifyPostImport,createReadOnlyReader,parseCSV,imageFacts};
