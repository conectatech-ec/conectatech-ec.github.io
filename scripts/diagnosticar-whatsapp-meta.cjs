'use strict';
// Read-only discovery for the existing master catalog. Never logs Graph bodies,
// private asset identifiers, phone numbers, credentials, names, prices or stock.
const fs=require('node:fs');
const CATALOG='1036301566100990';
const PUBLIC_MAIN_PHONE='593998576759';
const PRODUCT_FIELDS=['review_status','visibility','review_rejection_reasons'];
const ID=/^\d{4,32}$/;

class SafeReadError extends Error{
 constructor(reason,http=0,code=null){super(reason);this.reason=reason;this.http=http;this.code=Number.isSafeInteger(code)&&code>=0&&code<=10000000?code:null;}
}
const failure=e=>({readable:false,http_status:e instanceof SafeReadError?e.http:0,meta_error_code:e instanceof SafeReadError?e.code:null,reason:e instanceof SafeReadError?e.reason:'READ_FAILED'});
function assetId(value){
 if(typeof value==='string'&&ID.test(value))return value;
 if(typeof value==='number'&&Number.isSafeInteger(value)&&ID.test(String(value)))return String(value);
 throw new SafeReadError('ASSET_ID_SCHEMA_INVALID');
}

class ReadOnlyMeta{
 constructor({token,version='v26.0',transport=fetch,maxRequests=90,maxPages=20,maxWabas=10}){
  if(typeof token!=='string'||!token)throw new SafeReadError('EXISTING_ACCESS_UNAVAILABLE');
  if(!/^v\d+\.\d+$/.test(version))throw new SafeReadError('GRAPH_VERSION_INVALID');
  this.token=token;this.version=version;this.transport=transport;this.maxRequests=maxRequests;this.maxPages=maxPages;this.maxWabas=maxWabas;
  this.requests=0;this.rateLimited=false;this.businesses=new Set();this.wabas=new Set();
 }
 permit(method,path,fields){
  if(method!=='GET')throw new SafeReadError('GET_ONLY');
  if(path===CATALOG&&['id','id,business{id}','id,owner_business{id}'].includes(fields))return;
  if(path===CATALOG+'/products'&&PRODUCT_FIELDS.some(f=>fields==='retailer_id,'+f))return;
  const match=/^(\d+)\/(owned_whatsapp_business_accounts|client_whatsapp_business_accounts|phone_numbers|product_catalogs)$/.exec(path);
  if(match&&['owned_whatsapp_business_accounts','client_whatsapp_business_accounts'].includes(match[2])&&this.businesses.has(match[1])&&fields==='id')return;
  if(match&&this.wabas.has(match[1])&&((match[2]==='phone_numbers'&&fields==='id,display_phone_number')||(match[2]==='product_catalogs'&&fields==='id')))return;
  throw new SafeReadError('READ_SCOPE_VIOLATION');
 }
 async request(method,path,params){
  this.permit(method,path,params.fields);
  if(this.rateLimited)throw new SafeReadError('RATE_LIMIT_STOP');
  if(this.requests>=this.maxRequests)throw new SafeReadError('READ_BUDGET_EXHAUSTED');
  const url=new URL('https://graph.facebook.com/'+this.version+'/'+path);
  for(const [key,value] of Object.entries(params)){
   if(!['fields','limit','after'].includes(key))throw new SafeReadError('READ_PARAMETER_VIOLATION');
   url.searchParams.set(key,String(value));
  }
  this.requests++;
  let response,data;
  try{response=await this.transport(url,{method:'GET',headers:{Authorization:'Bearer '+this.token},redirect:'error',signal:AbortSignal.timeout(30000)});data=JSON.parse(await response.text());}
  catch{throw new SafeReadError('TRANSPORT_OR_JSON_FAILURE');}
  const code=Number(data?.error?.code);
  if(response.status===429||[4,17,32,613].includes(code))this.rateLimited=true;
  if(!response.ok||data?.error)throw new SafeReadError('GRAPH_READ_NOT_AVAILABLE',response.status,Number.isFinite(code)?code:null);
  if(!data||typeof data!=='object')throw new SafeReadError('GRAPH_SCHEMA_INVALID',response.status);
  return data;
 }
 async list(path,fields){
  const rows=[];const seen=new Set();let after;
  for(let page=0;page<this.maxPages;page++){
   const data=await this.request('GET',path,{fields,limit:100,...(after?{after}:{})});
   if(!Array.isArray(data.data))throw new SafeReadError('GRAPH_LIST_SCHEMA_INVALID');
   rows.push(...data.data);
   if(!data.paging?.next)return {rows,complete:true};
   // Never follow paging.next: it can contain tokens or an unrelated host.
   after=data.paging?.cursors?.after;
   if(typeof after!=='string'||!after||seen.has(after))throw new SafeReadError('PAGINATION_INVALID');
   seen.add(after);
  }
  return {rows,complete:false};
 }
 async ownership(field){
  const data=await this.request('GET',CATALOG,{fields:'id,'+field+'{id}'});
  if(assetId(data.id)!==CATALOG)throw new SafeReadError('MASTER_CATALOG_ID_MISMATCH');
  const id=data[field]?.id;
  if(id!==undefined)this.businesses.add(assetId(id));
  return {readable:true,http_status:200,business_found:id!==undefined};
 }
}

function publicScope(root='.'){
 const html=fs.readFileSync(root+'/index.html','utf8');
 const match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
 if(!match)throw new SafeReadError('PUBLIC_SCOPE_UNAVAILABLE');
 const products=JSON.parse(match[1]);
 const ids=new Set(products.map(p=>p.sku));
 if(products.length!==1170||ids.size!==1170||[...ids].some(s=>typeof s!=='string'||!/^[A-Z0-9_-]{3,40}$/.test(s)))throw new SafeReadError('PUBLIC_SCOPE_INVALID');
 return ids;
}
function enumBucket(field,value){
 if(value===undefined||value===null||value==='')return 'not_reported';
 if(typeof value!=='string')return 'other';
 const normalized=value.trim().toLowerCase().replace(/[\s-]+/g,'_');
 const allowed=field==='visibility'?['published','staging','hidden','archived','visible','not_visible']:['approved','pending','rejected','in_review','not_requested','not_applicable','outdated'];
 return allowed.includes(normalized)?normalized:'other';
}
function aggregateItems(field,rows,scope){
 const counts={};const seen=new Set();let outside=0,invalid=0,duplicates=0,reasons=0,unknownReasons=0;
 for(const item of rows){
  const id=item?.retailer_id;
  if(typeof id!=='string'||!id){invalid++;continue;}
  if(seen.has(id)){duplicates++;continue;}seen.add(id);
  if(!scope.has(id)){outside++;continue;}
  if(field==='review_rejection_reasons'){
   const value=item[field];
   if(Array.isArray(value)){if(value.length)reasons++;}
   else if(typeof value==='string'){if(value.trim())reasons++;}
   else if(value!==undefined&&value!==null)unknownReasons++;
  }else{const bucket=enumBucket(field,item[field]);counts[bucket]=(counts[bucket]||0)+1;}
 }
 return {public_items:seen.size-outside,outside_public_scope:outside,invalid_records:invalid,duplicate_records:duplicates,
  ...(field==='review_rejection_reasons'?{public_items_with_rejection_reasons:reasons,unknown_reason_formats:unknownReasons}:{counts})};
}

async function diagnose({token,scope,transport=fetch,version='v26.0',maxRequests=90,maxPages=20,maxWabas=10,now=new Date()}){
 const report={schema:'conectatech.whatsapp-read-only.v1',at:now.toISOString(),catalog_id:CATALOG,
  read_only:true,existing_access_present:!!token,public_scope_count:scope.size,
  product_review:{},catalog_ownership:{},assets:{businesses_found:0,wabas_found:0,waba_scan_truncated:false,invalid_asset_records:0,phone_records_read:0,main_public_number_found:false,master_catalog_found:false,main_number_and_master_catalog_same_waba:false,reads:[]},
  private_asset_ids_exported:false,phone_numbers_exported:false,private_names_exported:false,prices_or_stock_exported:false,
  customer_messages:0,write_requests:0,paid_services_activated:false,whatsapp_app_visibility_verified:false,whatsapp_chat_activated:false};
 if(!token){report.state='NO_EXISTING_META_ACCESS';report.read_requests=0;return report;}
 const client=new ReadOnlyMeta({token,version,transport,maxRequests,maxPages,maxWabas});
 try{
  const master=await client.request('GET',CATALOG,{fields:'id'});
  if(assetId(master.id)!==CATALOG)throw new SafeReadError('MASTER_CATALOG_ID_MISMATCH');
 }catch(e){report.state='EXISTING_ACCESS_CANNOT_READ_MASTER';report.access=failure(e);report.read_requests=client.requests;return report;}
 for(const field of PRODUCT_FIELDS){
  try{const page=await client.list(CATALOG+'/products','retailer_id,'+field);report.product_review[field]={readable:true,http_status:200,complete:page.complete,...aggregateItems(field,page.rows,scope)};}
  catch(e){report.product_review[field]=failure(e);}
 }
 for(const field of ['business','owner_business']){
  try{report.catalog_ownership[field]=await client.ownership(field);}catch(e){report.catalog_ownership[field]=failure(e);}
 }
 report.assets.businesses_found=client.businesses.size;
 const readAsset=async(operation,path,fields)=>{
  try{const result=await client.list(path,fields);report.assets.reads.push({operation,readable:true,http_status:200,complete:result.complete,records:result.rows.length});return result.rows;}
  catch(e){report.assets.reads.push({operation,...failure(e)});return [];}
 };
 for(const business of client.businesses)for(const edge of ['owned_whatsapp_business_accounts','client_whatsapp_business_accounts']){
  const rows=await readAsset(edge,business+'/'+edge,'id');
  for(const row of rows){
   let id;try{id=assetId(row?.id);}catch{report.assets.invalid_asset_records++;continue;}
   if(client.wabas.has(id))continue;
   if(client.wabas.size<maxWabas)client.wabas.add(id);else report.assets.waba_scan_truncated=true;
  }
 }
 report.assets.wabas_found=client.wabas.size;
 for(const waba of client.wabas){
  const phones=await readAsset('phone_numbers',waba+'/phone_numbers','id,display_phone_number');
  const catalogs=await readAsset('product_catalogs',waba+'/product_catalogs','id');
  const main=phones.some(p=>typeof p.display_phone_number==='string'&&p.display_phone_number.replace(/\D/g,'')===PUBLIC_MAIN_PHONE);
  const master=catalogs.some(c=>{try{return assetId(c?.id)===CATALOG;}catch{report.assets.invalid_asset_records++;return false;}});
  report.assets.phone_records_read+=phones.length;
  report.assets.main_public_number_found ||= main;report.assets.master_catalog_found ||= master;
  report.assets.main_number_and_master_catalog_same_waba ||= main&&master;
 }
 report.state=(client.rateLimited||client.requests>=maxRequests)?'READ_ONLY_DISCOVERY_PARTIAL':'READ_ONLY_DISCOVERY_COMPLETE';report.read_requests=client.requests;
 report.limits={max_requests:maxRequests,max_pages_per_edge:maxPages,max_wabas:maxWabas,rate_limit_stop:client.rateLimited,request_budget_reached:client.requests>=maxRequests};
 report.note='Meta review/visibility is not proof of visibility in the WhatsApp application. Missing asset access here does not prove that no WABA exists elsewhere.';
 return report;
}

async function main(){
 const output='work/auto-meta/whatsapp-read-only.json';let report;
 try{report=await diagnose({token:process.env.META_ACCESS_TOKEN,version:process.env.META_GRAPH_VERSION||'v26.0',scope:publicScope()});}
 catch(e){report={schema:'conectatech.whatsapp-read-only.v1',state:'READ_ONLY_DIAGNOSTIC_STOPPED',read_only:true,error:failure(e),private_values_exported:false,write_requests:0,customer_messages:0,paid_services_activated:false};}
 fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('WHATSAPP_READ_ONLY: '+JSON.stringify(report));
}
module.exports={ReadOnlyMeta,SafeReadError,diagnose,aggregateItems,enumBucket,publicScope,CATALOG,PUBLIC_MAIN_PHONE};
if(require.main===module)main().catch(()=>{console.error('No se pudo completar el diagnóstico de lectura; detalles privados omitidos.');process.exitCode=1;});
