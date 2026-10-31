const assert=require('node:assert/strict'),fs=require('fs'),api=require('../assets/editorial-titulos.js'),c=JSON.parse(fs.readFileSync('importacion/editorial/publicados.json'));
const selected=c.faseFinalCelularesTablets?.skus||[];assert(selected.length>0);const s=selected[0],outside=['TELF001','TELF012','TELF016','TELF020','TELF015'].find(x=>!selected.includes(x));assert(outside);
assert.equal(api.entry({sku:s},c),c.productos[s]);assert.equal(api.entry({sku:outside},c),null);
const disabled=structuredClone(c);disabled.faseFinalCelularesTablets.autorizada=false;assert.equal(api.entry({sku:s},disabled),null);
const legacy=structuredClone(c);delete legacy.faseFinalCelularesTablets;assert.equal(api.entry({sku:s},legacy),null);
const ordinary=Object.keys(c.productos).find(x=>!x.startsWith('TELF')&&!x.startsWith('TABL'));assert.equal(api.entry({sku:ordinary},c),c.productos[ordinary]);
console.log('Fase final: lista explícita, exclusión exterior y reversión verificadas; accesorios conservados.');
