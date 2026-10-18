// Pure reusable contracts. No Meta transport, credentials, messaging or publication side effects.
export const STATES=['PENDIENTE','PREPARADO','REVISAR','APROBADO','PUBLICADO','ACTUALIZAR','PAUSADO','BLOQUEADO'];
export const CHANNELS=['MARKETPLACE_RAFA','META_CATALOGO','FACEBOOK_PAGINA','INSTAGRAM','WEB'];
export function assertFresh(batch,now=Date.now()){
 if(!Number.isFinite(Date.parse(batch.valid_until))||Date.parse(batch.valid_until)<=now)throw Error('Inventario vencido: revalidar exportación; no promocionar ni sincronizar');
}
export function metrics(observations=[]){
 const result={views:null,inquiries:null,leads:null,confirmed_sales:null};const latest=new Map();
 for(const o of observations){
  if(!Object.hasOwn(result,o.metric)||!Number.isSafeInteger(o.value)||o.value<0||!o.evidence||!Number.isFinite(Date.parse(o.observed_at))||!CHANNELS.includes(o.channel)||!o.sku)throw Error('Métrica sin evidencia o formato válido');
  if(o.metric==='confirmed_sales'&&o.confirmed_by_admin!==true)throw Error('Venta sin confirmación administrativa');
  if(o.source==='click'||o.source==='message')throw Error('Evento no equivale a métrica comercial confirmada');
  const key=[o.channel,o.sku,o.metric].join(':');const prior=latest.get(key);
  if(prior&&o.period!==prior.period)throw Error('No mezclar períodos de medición diferentes');
  if(!prior||Date.parse(o.observed_at)>Date.parse(prior.observed_at))latest.set(key,o);
 }
 for(const o of latest.values())result[o.metric]=(result[o.metric]??0)+o.value;
 return result;
}
export function reconcile(before,after){
 const old=new Map(before.map(p=>[p.sku,p]));
 const actions=after.map(p=>{const prior=old.get(p.sku);old.delete(p.sku);return {sku:p.sku,action:!p.available?'PAUSADO':!prior?'PREPARADO':['price','pvp','title','description','image_url','available'].some(k=>JSON.stringify(prior[k])!==JSON.stringify(p[k]))?'ACTUALIZAR':prior.source?.image_sha256!==p.source?.image_sha256?'ACTUALIZAR':'SIN_CAMBIO',automatic_external_action:false};});
 for(const [sku] of old)actions.push({sku,action:'PAUSADO',reason:'Ausente de la fuente vigente',automatic_external_action:false});
 return actions;
}
export function transition(entry,next,{actor,evidence,approvedFingerprint,now=Date.now()}={}){
 if(!STATES.includes(next)||!STATES.includes(entry.state)||!actor)throw Error('Estado/actor inválido');
 const allowed={PENDIENTE:['PREPARADO','BLOQUEADO'],PREPARADO:['REVISAR','PAUSADO','BLOQUEADO'],REVISAR:['APROBADO','PREPARADO','PAUSADO','BLOQUEADO'],APROBADO:['PUBLICADO','ACTUALIZAR','PAUSADO','BLOQUEADO'],PUBLICADO:['ACTUALIZAR','PAUSADO','BLOQUEADO'],ACTUALIZAR:['PREPARADO','PAUSADO','BLOQUEADO'],PAUSADO:['PREPARADO','BLOQUEADO'],BLOQUEADO:['REVISAR']};
 if(!allowed[entry.state].includes(next))throw Error('Transición no permitida');
 if(['APROBADO','PUBLICADO'].includes(next)){
  if(!evidence?.reference||evidence.kind!=='OWNER_APPROVAL'||!approvedFingerprint||approvedFingerprint!==entry.fingerprint)throw Error('Falta aprobación explícita ligada al contenido y canal');
  if(Date.parse(entry.valid_until)<=now)throw Error('Inventario vencido');
  if(!entry.category_verified||!entry.fulfillment_verified||!entry.capability_verified)throw Error('Falta verificar categoría, entrega o capacidad del canal');
 }
 if(next==='PUBLICADO'){
  const u=new URL(evidence.publication_url||'https://invalid.example');
  const host=u.hostname;
  const official=entry.channel==='WEB'?host==='conectatech-ec.github.io':entry.channel==='INSTAGRAM'?host==='www.instagram.com'||host==='instagram.com':entry.channel==='META_CATALOGO'?host==='business.facebook.com'||host==='www.facebook.com':host==='www.facebook.com'||host==='facebook.com';
  if(!evidence.publication_id||u.protocol!=='https:'||!official||!evidence.verified_at)throw Error('Falta evidencia verificable del canal; importar catálogo no acredita Marketplace');
 }
 return {...entry,state:next,history:[...(entry.history||[]),{from:entry.state,to:next,actor,at:new Date(now).toISOString(),evidence:evidence||null}]};
}
export async function publishExternally(){throw Error('Publicación externa desactivada. Requiere aprobación del propietario y adaptador oficial autorizado por canal.');}
export function alexProduct(item,batch,now=Date.now()){
 assertFresh(batch,now);if(!item.available)throw Error('Producto no disponible');
 return {product_id:item.sku,title:item.title,model:item.model,price:item.price,currency:item.currency,description:item.description,image:item.image_url,banner:item.banner_url,link:item.product_url,features:item.features,guarantee:item.guarantee,personal_messaging_access:false};
}
