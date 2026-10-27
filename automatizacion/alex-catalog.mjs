import original from './generated/catalogo.json' with {type:'json'};
import extra from './generated/alex-productos-extra.json' with {type:'json'};
import {readCatalogSnapshot} from './live.mjs';
import {central,sourceToAlex} from './central-source.mjs';
import enrichment from './central/enrichment.json' with {type:'json'};
import {readSharedHub} from './shared-hub.mjs';
export const INVENTORY_FEED='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/datos-593/inventario-publico.csv';
export const INVENTORY_HISTORY='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/commits?path=datos-593%2Finventario-publico.csv&sha=main&per_page=1';
// A new catalogue build is not a new stock check. Pin CSV to its own last changed commit.
export async function inventorySnapshot(fetcher=fetch,now=Date.now()){
 const r=await fetcher(INVENTORY_HISTORY,{headers:{Accept:'application/vnd.github+json','User-Agent':'CONECTATECH-Alex-pilot'},signal:AbortSignal.timeout(10000),cf:{cacheTtl:3600,cacheEverything:true}});
 if(!r.ok)throw Error('INVENTORY_PROVENANCE_UNAVAILABLE');
 const text=await r.text();if(text.length>250000)throw Error('INVENTORY_PROVENANCE_SIZE');
 const entry=JSON.parse(text)?.[0],sha=entry?.sha,stamp=Date.parse(entry?.commit?.committer?.date);
 if(!/^[a-f0-9]{40}$/.test(sha||'')||!Number.isFinite(stamp)||stamp>now+300000)throw Error('INVENTORY_PROVENANCE_INVALID');
 const url=INVENTORY_FEED.replace('/main/','/'+sha+'/');
 const csv=await fetcher(url,{signal:AbortSignal.timeout(10000),cf:{cacheTtl:3600,cacheEverything:true}});
 if(!csv.ok)throw Error('INVENTORY_UNAVAILABLE');const body=await csv.text();if(body.length>500000)throw Error('INVENTORY_SIZE');
 // Existing validated-cut document, pinned with the CSV. Category-only edits must not renew stock.
 const proof=await fetcher(url.replace('inventario-publico.csv','REFERENCIA-OFICIAL.md'),{signal:AbortSignal.timeout(10000),cf:{cacheTtl:3600,cacheEverything:true}});
 if(!proof.ok)throw Error('INVENTORY_CUT_UNAVAILABLE');const note=await proof.text();if(note.length>20000)throw Error('INVENTORY_CUT_SIZE');
 const match=note.match(/Inventario exportado el (\d{2})-(\d{2})-(\d{4})/),date=match?`${match[3]}-${match[2]}-${match[1]}`:null;
 // The source provides a date, not an extraction time: use start of that date in Quito conservatively.
 const bound=date?Date.parse(date+'T00:00:00-05:00'):NaN;
 if(!Number.isFinite(bound)||new Date(bound-5*3600000).toISOString().slice(0,10)!==date||bound>now+300000||bound>stamp+300000)throw Error('INVENTORY_CUT_INVALID');
 return {rows:csvRows(body),updated_at:new Date(stamp).toISOString(),cut_date:date,freshness_bound:new Date(bound).toISOString(),commit:sha,url};
}
const pilotIds=['TELF017','TELF018','TELF019','TELF001','REL046'];
const pilotProducts=pilotIds.filter(s=>![...original.productos,...extra.productos].some(p=>p.sku===s)).map(s=>{const p=central.products.find(p=>p.sku===s),e=enrichment.products[s]||{};return {sku:s,nombre:p.name,public_name:e.display_name||p.name,descripcion:e.description||'',caracteristicas:e.specifications||{},foto:e.photo_url||null,foto_sha256:e.photo_sha256||null,banner:null,banner_sha256:null,url:p.web?.url||null,stock:0,promo:0,pvp:0,price_verified:false};});
export const alexBaseline={...original,productos:[...original.productos,...extra.productos]};
export const alexIds=alexBaseline.productos.map(p=>p.sku);
export const publicName=p=>(p.public_name||({MICR27:'JBL Quantum Stream',POWE003:'Philco FLP8202CV',ADAP005:'adaptador Europa a Latino'}[p.sku])||p.nombre).replace(new RegExp('\\b'+p.sku+'\\b','g'),'').trim();
export function quoteCurrent(source,p,now=Date.now()){
 if(!p||p.price_verified===false)return false;
 const stamp=Date.parse(source?.fuente_fecha);
 return Number.isFinite(stamp)&&stamp<=now+300000&&now-stamp<=86400000;
}
export function csvRows(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('INVALID_INVENTORY_CSV');if(cell||row.length){row.push(cell);rows.push(row);}const header=rows.shift();for(const key of ['sku','stock','promo_contado','pvp_final'])if(!header?.includes(key))throw Error('INVALID_INVENTORY_CSV');
 return rows.map(row=>Object.fromEntries(header.map((k,i)=>[k,row[i]])));
}
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function catalogMatches(query,products){
 const q=fold(query).replace(/\bredmi\s*15\s*c\b/g,'redmi 15c').replace(/\b15\s+c\b/g,'15c'),exact=products.filter(p=>new RegExp('\\b'+p.sku.toLowerCase()+'\\b').test(q));if(exact.length)return exact.slice(0,2);
 const models=(q.match(/\b(?:[a-z]{1,12}\d+[a-z0-9]*|\d+[a-z]{1,5})\b/g)||[]).filter(x=>!/^telf\d+|^gb\d+|^\d+(?:gb|mah|w)$/.test(x));if(!models.length)return [];
 const label=p=>fold([p.nombre,p.public_name,p.catalog_identity].filter(Boolean).join(' '));
 const matches=products.filter(p=>models.some(m=>new RegExp('\\b'+m+'\\b').test(label(p))));
 const capacities=q.match(/\b(\d+)\s*gb\b/g)||[];
 return matches.filter(p=>!capacities.length||capacities.every(c=>label(p).replace(/\s/g,'').includes(c.replace(/\s/g,'')))).slice(0,2);
}
export async function refreshAlexCatalog(seed=alexBaseline,fetcher=fetch,now=Date.now(),query='',centralData=fetcher===fetch?central:null){
 const input=typeof query==='string'?query:query.input||'',focus=typeof query==='object'?query.focus||[]:[];
 if(centralData){
  if(typeof query==='object'&&query.sharedHub===true){try{centralData=await readSharedHub(centralData,fetcher,now);}catch{/* Last valid compiled source keeps its original expiry; never renew it on a read error. */}}
  const extended={...seed,productos:[...seed.productos,...pilotProducts.filter(p=>centralData.products.some(c=>c.sku===p.sku)&&!seed.productos.some(s=>s.sku===p.sku))]};
  return sourceToAlex(extended,centralData,products=>{const current=catalogMatches(input,products);return current.length?current:products.filter(p=>focus.includes(p.sku)).slice(0,2);},now);
 }
 const source=await readCatalogSnapshot(seed,fetcher,now,products=>{const current=catalogMatches(input,products);return current.length?current:products.filter(p=>focus.includes(p.sku)).slice(0,2);},true);
 let inventory=[],snapshot=null;
 try{snapshot=await inventorySnapshot(fetcher,now);inventory=snapshot.rows;}catch{/* Missing provenance blocks quotes, never the technical catalogue or logistics. */}
 for(const p of source.productos){const matches=inventory.filter(r=>r.sku===p.sku),r=matches[0];p.price_verified=matches.length===1&&Number(r.promo_contado)===p.promo&&Number(r.pvp_final)===p.pvp&&Number(r.stock)===p.stock;}
 const published=source.fuente_fecha,inventoryDate=snapshot?.updated_at||null;
 const inventoryBound=snapshot?Math.min(Date.parse(inventoryDate),Date.parse(snapshot.freshness_bound)):NaN;
 const effective=snapshot?new Date(Math.min(Date.parse(published),inventoryBound)).toISOString():null;
 return {...source,feed_published_at:published,fuente_fecha:effective,inventory_updated_at:inventoryDate,inventory_cut_date:snapshot?.cut_date||null,inventory_freshness_bound:snapshot?.freshness_bound||null,inventory_commit:snapshot?.commit||null,inventory_source:snapshot?.url||INVENTORY_FEED,source_error_code:!snapshot?'INVENTORY_PROVENANCE_UNAVAILABLE':now-inventoryBound>86400000?'INVENTORY_STALE':now-Date.parse(published)>86400000?'FEED_STALE':null,prices_cross_checked:true};
}
