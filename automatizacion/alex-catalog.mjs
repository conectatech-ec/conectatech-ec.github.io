import original from './generated/catalogo.json' with {type:'json'};
import extra from './generated/alex-productos-extra.json' with {type:'json'};
import {readCatalogSnapshot} from './live.mjs';
export const INVENTORY_FEED='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/datos-593/inventario-publico.csv';
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
 const q=fold(query),exact=products.filter(p=>new RegExp('\\b'+p.sku.toLowerCase()+'\\b').test(q));if(exact.length)return exact.slice(0,2);
 const models=(q.match(/\b[a-z]{1,12}\d+[a-z0-9]*\b/g)||[]).filter(x=>!/^telf\d+|^gb\d+/.test(x));if(!models.length)return [];
 const matches=products.filter(p=>models.some(m=>new RegExp('\\b'+m+'\\b').test(fold(p.nombre))));
 const capacities=q.match(/\b(\d+)\s*gb\b/g)||[];
 return matches.filter(p=>!capacities.length||capacities.every(c=>fold(p.nombre).replace(/\s/g,'').includes(c.replace(/\s/g,'')))).slice(0,2);
}
export async function refreshAlexCatalog(seed=alexBaseline,fetcher=fetch,now=Date.now(),query=''){
 const input=typeof query==='string'?query:query.input||'',focus=typeof query==='object'?query.focus||[]:[];
 const source=await readCatalogSnapshot(seed,fetcher,now,products=>{const current=catalogMatches(input,products);return current.length?current:products.filter(p=>focus.includes(p.sku)).slice(0,2);},true);
 let inventory=[];
 try{const r=await fetcher(INVENTORY_FEED,{signal:AbortSignal.timeout(10000),cf:{cacheTtl:60,cacheEverything:true}});if(!r.ok)throw Error('INVENTORY_UNAVAILABLE');const text=await r.text();if(text.length>500000)throw Error('INVENTORY_SIZE');inventory=csvRows(text);}catch{/* Block quotes, keep existing verified product facts and logistics usable. */}
 for(const p of source.productos){const matches=inventory.filter(r=>r.sku===p.sku),r=matches[0];p.price_verified=matches.length===1&&Number(r.promo_contado)===p.promo&&Number(r.pvp_final)===p.pvp&&Number(r.stock)===p.stock;}
 return {...source,inventory_source:INVENTORY_FEED,prices_cross_checked:true};
}
