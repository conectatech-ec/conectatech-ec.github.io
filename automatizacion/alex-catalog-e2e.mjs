// Live published sources and approved assets only. No model calls, secrets or catalog mutations.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {refreshAlexCatalog,quoteCurrent} from './alex-catalog.mjs';
import {verifyAssets} from './live.mjs';
import {factBook} from './alex.mjs';
const s=await refreshAlexCatalog(),book=factBook(s),report={at:new Date().toISOString(),source_published_at:s.fuente_fecha,source_prices_cross_checked:s.prices_cross_checked,ai_calls:0,messages_sent:0,paid_services_activated:false,products:[]};
for(const p of s.productos){const current=quoteCurrent(s,p);if(!current){assert.equal(book[p.sku+'.cash'],undefined);assert.equal(book[p.sku+'.card'],undefined);}const media=p.foto?await verifyAssets({...p,banner:null}):[];report.products.push({sku:p.sku,quote_current:current,source_matches_593:p.price_verified,verified_photos:media.length});}
report.passed=true;const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('alex-live-catalog-check.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
