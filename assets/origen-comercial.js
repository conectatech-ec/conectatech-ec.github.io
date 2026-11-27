/* Referencia del enlace comercial. No registra clics, consultas, pedidos ni ventas. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.CONECTATECH_ORIGIN=api;if(root.document)api.install(root.document);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const sources=Object.freeze({google_maps:'GM',facebook:'FB',instagram:'IG',tiktok:'TT',youtube:'YT',whatsapp:'WA'});
 const fields=['utm_source','utm_medium','utm_campaign','utm_content','ref'];
 const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);
 const sku=value=>typeof value==='string'&&/^[A-Z]{2,10}[0-9]{1,6}$/.test(value)?value:'';
 function context(href){
  let url;try{url=new URL(href);}catch{return null;}
  const source=url.searchParams.get('utm_source'),channel=Object.hasOwn(sources,source)?sources[source]:null;
  if(!channel||url.searchParams.getAll('utm_source').length!==1)return null;
  const values={utm_source:source};
  for(const key of fields.slice(1)){
   const value=url.searchParams.get(key);
   if(!safe(value)||url.searchParams.getAll(key).length!==1)continue;
   if(key==='ref'&&!new RegExp('^'+channel+'-[A-Z0-9][A-Z0-9_-]{0,63}$').test(value))continue;
   values[key]=value;
  }
  return {channel,values};
 }
 function pageSKU(href){
  try{return sku(new URL(href).pathname.match(/^\/productos\/([a-z]+[0-9]+)-[^/]+\/$/i)?.[1].toUpperCase());}catch{return '';}
 }
 function internalURL(raw,href){
  href=href||(typeof location!=='undefined'?location.href:'');
  const ctx=context(href);if(!ctx)return raw;
  let url,base;try{base=new URL(href);url=new URL(raw,base);}catch{return raw;}
  if(url.origin!==base.origin||!['http:','https:'].includes(url.protocol)||
    !(/^\/(?:index\.html)?$/.test(url.pathname)||/^\/productos\/[a-z0-9-]+\/$/.test(url.pathname)))return raw;
  // Un enlace con origen propio conserva ese contexto; nunca se reemplaza por otro canal.
  if(url.searchParams.has('utm_source'))return raw;
  for(const [key,value] of Object.entries(ctx.values))url.searchParams.set(key,value);
  return raw.startsWith('/')&&!raw.startsWith('//')?url.pathname+url.search+url.hash:url.href;
 }
 function whatsappURL(raw,productSKU,href){
  href=href||(typeof location!=='undefined'?location.href:'');
  const ctx=context(href);if(!ctx)return raw;
  let url;try{url=new URL(raw);}catch{return raw;}
  if(url.protocol!=='https:'||url.hostname!=='wa.me'||url.port||url.username||url.password||
    !/^\/(?:593998576759|593964206977)\/?$/.test(url.pathname))return raw;
  const original=url.searchParams.get('text')||'Hola CONECTATECH, deseo consultar.';
  const text=original.replace(/\n\n\[CT360 Ref: [^\]\n]{1,400}\]$/,'');
  const identity=sku(productSKU)||sku(text.match(/\(([A-Z]{2,10}[0-9]{1,6})\)/)?.[1])||
    sku(text.match(/c[oó]digo\s+([A-Z]{2,10}[0-9]{1,6})\b/i)?.[1].toUpperCase());
  const ref=[ctx.channel+(identity?'-'+identity:'')];
  for(const key of ['ref','utm_campaign','utm_content'])if(ctx.values[key])ref.push(ctx.values[key]);
  url.searchParams.set('text',text+'\n\n[CT360 Ref: '+ref.join(' | ')+']');
  return url.href;
 }
 function install(doc){
  if(doc.documentElement.hasAttribute('data-ct-origin'))return;
  doc.documentElement.setAttribute('data-ct-origin','1');
  const bases=new WeakMap();
  function rewrite(anchor){
   if(!anchor.matches?.('a[href]'))return;
   const raw=anchor.getAttribute('href');let record=bases.get(anchor);
   if(!record||raw!==record.last)record={base:raw,last:raw};
   const id=sku(anchor.closest('[data-sku]')?.getAttribute('data-sku'));
   const next=whatsappURL(internalURL(record.base,doc.location.href),id,doc.location.href);
   record.last=next;bases.set(anchor,record);
   if(raw!==next)anchor.setAttribute('href',next);
  }
  function scan(node){if(node.nodeType===1)rewrite(node);node.querySelectorAll?.('a[href]').forEach(rewrite);}
  function start(){
   scan(doc);
   const observer=new doc.defaultView.MutationObserver(records=>{
    for(const record of records){
     if(record.type==='attributes')rewrite(record.target);
     else record.addedNodes.forEach(scan);
    }
   });
   observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
   for(const event of ['click','auxclick','contextmenu'])doc.addEventListener(event,e=>{const a=e.target.closest?.('a[href]');if(a)rewrite(a);},true);
   doc.defaultView.addEventListener('popstate',()=>scan(doc));
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
 return Object.freeze({context,pageSKU,internalURL,whatsappURL,install});
});
