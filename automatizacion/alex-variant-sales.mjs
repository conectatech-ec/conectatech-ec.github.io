// Verified commercial rendering inside Alex, shared by generative and catalogue fallback paths.
import {phoneFamily} from './phone-variants.mjs';
import {quoteCurrent} from './alex-catalog.mjs';
import {buyingIntent,bankIntent,imageRequested} from './alex-context.mjs';
const money=n=>'$'+Number(n).toFixed(2);
const available=(source,p,now)=>quoteCurrent(source,p,now)&&p.price_verified!==false&&p.stock>0&&
 (!p.central_availability||p.central_availability==='in_stock')&&!(p.blocked_reasons||[]).length;
export function variantSalesReply(input,source,memory={},now=Date.now()){
 const buying=buyingIntent(input);
 if(buying.deferred||buying.resume||bankIntent(input,memory).objection)return null;
 // A native choice advances with the selected product; do not reopen the same
 // family menu after the buyer just chose one of its options.
 if(/^Elijo este producto del producto [A-Z]{3,8}\d{2,6}$/.test(input))return null;
 if(!source?.productos||/rebaj|descuento|car[oa]\b|no me alcanza|garant[ií]a|reclamo|hablar.*persona|olvida|borra|no comprar|comprar[eé] todav[ií]a|continuar despu[eé]s|sigamos|retom|me lo llevo|quiero comprar/i.test(input))return null;
 const directList=/variant|version|configur|opciones|alternativas|disponib|precios|cu[aá]nto.*cuestan/i.test(input);
 const mediaRequested=imageRequested(input),comparing=/comp[aá]r|diferenc|versus|\bvs\b/i.test(input);
 if(!directList&&/bater[ií]a|pantalla|c[aá]mara|garant[ií]a|direcci[oó]n|env[ií]o|contraentrega|retiro|foto(?:graf[ií]a)?|imagen|banner/i.test(input)&&!/busco|me interesa|necesito.*(?:Samsung|Redmi|HONOR|TECNO|Infinix|ZTE|Xiaomi)/i.test(input))return null;
 if(/banco|meses|cuotas|intereses|Pac[ií]fico|Pichincha|Diners|Guayaquil/i.test(input)&&!directList&&!/precio|cu[aá]nto/i.test(input))return null;
 let family=phoneFamily(input,source.productos,{focus:memory.focus||[]});
 if(!family&&(memory.focus||[]).length>1&&/precio|tarjeta|contado|cu[aá]nto/i.test(input))family=phoneFamily('variantes',source.productos,{focus:memory.focus});
 if(!family||!family.has_named_model&&!family.explicit_variant&&!family.is_family_query)return null;
 if(!family.variants.length)return {text:'No tengo verificada esa configuración del '+family.identity.brand+' '+family.identity.model+(family.requested.connectivity?' '+family.requested.connectivity:'')+'. ¿Quieres revisar las otras versiones verificadas?',focus:[],selection_focus:[],variant_options:[],facts:[],images:[],image:null,intent:'recommend',action:'answer',purchasable:false,has_verified_photo:false};
 const identities=new Map(family.all_identities.map(v=>[v.sku,v]));
 const valid=family.variants.filter(p=>identities.get(p.sku)?.verified_identity&&p.price_verified!==false&&p.central_availability!=='blocked'&&!(p.blocked_reasons||[]).length);
 if(!valid.length)return null;
 const fresh=valid.some(p=>quoteCurrent(source,p,now)),offers=valid.filter(p=>available(source,p,now));
 const exactIds=new Set(family.exact.map(p=>p.sku)),ordered=(fresh?offers:valid).slice().sort((a,b)=>
  (family.explicit_variant?Number(exactIds.has(b.sku))-Number(exactIds.has(a.sku)):0)||
  (identities.get(a.sku).storage_gb||0)-(identities.get(b.sku).storage_gb||0)||
  (identities.get(a.sku).ram_physical_gb||0)-(identities.get(b.sku).ram_physical_gb||0)||a.sku.localeCompare(b.sku));
 const title=family.identity.brand+' '+family.identity.model;
 if(!ordered.length)return {text:title+': no tengo disponibilidad confirmada de estas versiones. ¿Quieres revisar otra opción?',focus:family.exact.map(p=>p.sku),selection_focus:family.exact.map(p=>p.sku),variant_options:[],facts:[],images:[],image:null,intent:'recommend',action:'answer',purchasable:false,has_verified_photo:false};
 const label=p=>{const v=identities.get(p.sku);return [v.storage_gb?v.storage_gb+' GB':'Almacenamiento por confirmar',v.ram_physical_gb?v.ram_physical_gb+' GB RAM física':'RAM por confirmar',v.ram_virtual_gb?'+'+v.ram_virtual_gb+' GB virtual':null,v.connectivity].filter(Boolean).join(' · ');};
 const options=ordered.map(p=>({sku:p.sku,label:label(p),storage_gb:identities.get(p.sku).storage_gb,ram_physical_gb:identities.get(p.sku).ram_physical_gb,ram_virtual_gb:identities.get(p.sku).ram_virtual_gb,connectivity:identities.get(p.sku).connectivity,cash:fresh?p.promo:null,card:fresh?p.pvp:null,current:fresh}));
 let recommendation='',suggested=null;
 if(fresh&&ordered.length>1){
  const within=memory.budget?ordered.filter(p=>p.promo<=memory.budget):ordered;
  const need=String(memory.need||input),more=/much[ao]s? fotos|much[ao]s? (?:archivos|videos)|m[aá]s (?:espacio|memoria|almacenamiento)|multitarea|juegos|varias aplicaciones/i.test(need);
  if(memory.budget&&within.length){suggested=more?within.at(-1):within[0];recommendation='Para tu presupuesto, te recomiendo la de '+identities.get(suggested.sku).storage_gb+' GB.';}
  else if(more){suggested=ordered.at(-1);recommendation='Para guardar más fotos y archivos, te conviene la de '+identities.get(suggested.sku).storage_gb+' GB.';}
  else{const small=identities.get(ordered[0].sku).storage_gb,big=identities.get(ordered.at(-1).sku).storage_gb;recommendation=small!==big?small+' GB para uso diario; '+big+' GB si quieres más espacio.':'Si priorizas multitarea, compara la RAM física de cada opción.';}
  if(memory.budget&&!within.length)recommendation='Estas opciones superan tu presupuesto de contado; podemos revisar otro modelo.';
 }
 const rawExact=family.explicit_variant?family.exact.filter(p=>valid.some(v=>v.sku===p.sku)):[];
 const exact=rawExact.length>1&&fresh?rawExact.filter(p=>offers.some(o=>o.sku===p.sku)):rawExact;
 let selected=exact.length?exact.map(p=>p.sku):suggested?[suggested.sku]:(memory.focus||[]).filter(s=>ordered.some(p=>p.sku===s));
 if(!selected.length)selected=ordered.map(p=>p.sku);
 const primaryUnavailable=fresh&&family.explicit_variant&&family.exact.length&&!family.exact.some(p=>offers.some(v=>v.sku===p.sku));
 const cardOnly=/tarjeta|\bPVP\b/i.test(input)&&!/contado|efectivo/i.test(input),cashOnly=/contado|efectivo/i.test(input)&&!/tarjeta|\bPVP\b/i.test(input);
 const compareOnly=comparing&&!/precio|cu[aá]nto|cuesta|vale|tarjeta|contado|\bPVP\b/i.test(input);
 const header=title+(fresh?compareOnly?' · Comparación':cardOnly?' · 💳 con tarjeta (PVP)':cashOnly?' · 💵 de contado':' · 💵 contado / 💳 tarjeta (PVP)':' · precios y disponibilidad por confirmar');
 const rowPrice=p=>!fresh||compareOnly?'':cardOnly?': '+money(p.pvp):cashOnly?': '+money(p.promo):': '+money(p.promo)+' / '+money(p.pvp);
 const rows=ordered.map(p=>'• '+label(p)+rowPrice(p));
 const useAlreadyAsked=(memory.asked_topics||[]).includes('phone_use')||(memory.history||[]).some(t=>t.role==='assistant'&&/lo usar[ií]as|uso diario|para qu[eé].*usar/i.test(t.text)&&/\?/.test(t.text));
 const usefulQuestion=!cardOnly&&!cashOnly&&!comparing&&!memory.purchase_deferred&&!memory.need&&!memory.budget&&!useAlreadyAsked&&ordered.length>1?'¿Lo usarías para lo básico o para guardar muchas fotos?':'';
 // Payment follow-ups answer payment; do not repeat the initial sales pitch.
 if(cardOnly||cashOnly)recommendation='';
 if(comparing&&fresh&&ordered.length>1){const low=identities.get(ordered[0].sku),high=identities.get(ordered.at(-1).sku);if(low.storage_gb!==high.storage_gb&&low.ram_physical_gb!==high.ram_physical_gb)recommendation=memory.budget&&suggested?'Por tu presupuesto, me quedo con '+identities.get(suggested.sku).storage_gb+' GB; la otra opción ofrece más espacio y RAM.':low.storage_gb+' GB si priorizas ahorrar; '+high.storage_gb+' GB y '+high.ram_physical_gb+' GB RAM si necesitas más espacio y multitarea.';}
 const availability=fresh&&!cardOnly&&!cashOnly?'Disponibilidad según la última actualización; confirmamos al comprar.':'';
 let text=[primaryUnavailable?'La versión que pediste no tiene disponibilidad confirmada.':null,header,...rows,recommendation,availability,usefulQuestion].filter(Boolean).join('\n');
 if(text.length>700)text=[header,...ordered.map(p=>'• '+(identities.get(p.sku).storage_gb||'?')+' GB / '+(identities.get(p.sku).ram_physical_gb||'?')+' GB RAM'+(identities.get(p.sku).connectivity?' '+identities.get(p.sku).connectivity:'')+(fresh?': '+money(p.promo)+' / '+money(p.pvp):'')),recommendation].filter(Boolean).join('\n');
 return {text,focus:family.explicit_variant&&exact.length?exact.map(p=>p.sku):ordered.map(p=>p.sku),selection_focus:selected,variant_options:options,
  facts:fresh?ordered.flatMap(p=>compareOnly?[]:cardOnly?[p.sku+'.card']:cashOnly?[p.sku+'.cash']:[p.sku+'.cash',p.sku+'.card']):[],images:ordered.map(p=>p.sku),image:null,intent:comparing?'compare':mediaRequested?'photo':cardOnly||cashOnly?'price':'recommend',action:comparing?'compare':'recommend',media_requested:mediaRequested,asked_topic:usefulQuestion?'phone_use':null,
  purchasable:selected.length===1&&offers.some(p=>p.sku===selected[0]),has_verified_photo:ordered.some(p=>!!p.foto),recommendation_sku:suggested?.sku||null};
}
