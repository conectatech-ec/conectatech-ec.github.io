// Presentation adapter: reuses the validated central contract and Alex's factual slots.
import {readFile,writeFile} from 'node:fs/promises';
import {sourceToAlex,validateCentral} from '../central-source.mjs';import {alexBaseline,quoteCurrent} from '../alex-catalog.mjs';import {factBook} from '../alex.mjs';
import {association,handoff} from './lead.mjs';
export function prepare(candidate,library,now=Date.now()){
 validateCentral(candidate,now);const p=candidate.products.find(p=>p.sku===association.sku);if(!p)throw Error('SKU_NOT_VALIDATED');
 const source=sourceToAlex(alexBaseline,candidate,rows=>rows.filter(p=>p.sku===association.sku),now),product=source.productos.find(p=>p.sku===association.sku);
 const current=quoteCurrent(source,product,now),available=current&&product.stock>0&&p.availability==='in_stock';
 const facts=factBook(source,now),money=available?[facts['TELF017.cash'],facts['TELF017.card']]:[];
 const priceLine=money.map(x=>x.slice(0,x.indexOf(' '))+' '+x.slice(x.indexOf(': ')+2)).map((x,i)=>i===0?x.replace(/\.$/,''):x).join(' · ');
 const text=available?['El Redmi 15C de 128 GB figura disponible según el corte validado.',priceLine,'¿Prefieres retiro en tienda o entrega?'].join('\n'):[facts['TELF017.unavailable']||facts.stale,'Puedo ayudarte con sus características y opciones de entrega.'].join('\n');
 const reasons=[];if(!library.visual_approved||!library.publication_verified)reasons.push('BANNER_APPROVAL_NOT_VERIFIED');if(!library.live_file_hash_verified)reasons.push('BANNER_BYTES_NOT_VERIFIED');if(!available)reasons.push('NO_CURRENT_CONFIRMED_AVAILABILITY');if(library.source_sha256!==candidate.source.sha256)reasons.push('BANNER_REVALIDATION_FOR_NEW_SOURCE_REQUIRED');if(!library.delivery_allowed)reasons.push('LIBRARY_DELIVERY_NOT_RELEASED');
 const samePrices=!!p.prices&&Math.round(Number(library.cash)*100)===p.prices.promo_cash_cents&&Math.round(Number(library.pvp)*100)===p.prices.pvp_card_cents;
 return {at:new Date(now).toISOString(),association,source:{mode:'normalized_candidate_not_published',cut_date:candidate.source.cut_date,generated_at:candidate.source.generated_at,expires_at:candidate.expires_at,sha256:candidate.source.sha256,fresh:current,shared_Hub_updated:false,existing_Alex_updated:false},availability:{confirmed_at_report:available,public_quantity:null},reply:{text,catalog_url:p.web?.url||null,banner_attachment:null,send_enabled:false},banner:{approved:library.visual_approved,sha256:library.banner_sha256,bytes_verified:library.live_file_hash_verified===true,prices_match_current_candidate:current?samePrices:null,regeneration_required_by_price:current?!samePrices:null,revalidation_required:library.source_sha256!==candidate.source.sha256,delivery_enabled:false,block_reasons:reasons},handoff:handoff(),personal_messages_read:0,external_e2e_complete:false,customer_messages_sent:0};
}
if(process.argv[1]?.endsWith('/prepare.mjs')){
 const [candidatePath,libraryPath,out]=process.argv.slice(2);if(!out)throw Error('Validated candidate, sanitized library evidence and output path required');
 const result=prepare(JSON.parse(await readFile(candidatePath)),JSON.parse(await readFile(libraryPath)));await writeFile(out,JSON.stringify(result,null,2)+'\n');await writeFile(out.replace(/\.json$/,'.txt'),result.reply.text+'\nFicha: '+result.reply.catalog_url+'\n');console.log(JSON.stringify({prepared:true,sku:association.sku,cut:result.source.cut_date,current:result.source.fresh,banner_delivery:false,customer_messages_sent:0}));
}
