import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),hook=require('../../scripts/compra-enlaces.cjs');
const root=new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const urls=JSON.parse(read('seo-pages.json'));
test('la integración apagada conserva byte por byte todas las fichas existentes',()=>{
  for(const [sku,slug] of Object.entries(urls)){
    const html=read('productos/'+slug+'/index.html');
    assert.equal(hook(html,{sku,stock:1},JSON.parse(read('compra/config.json'))),html);
  }
});
test('la vista activa añade compra sin sustituir WhatsApp y preserva metadata y precios',()=>{
  const html=read('productos/'+urls.ADAP004+'/index.html');
  const out=hook(html,{sku:'ADAP004',stock:13},{enabled:true});
  assert.ok(out.includes('/compra/?sku=ADAP004'));assert.ok(out.includes('https://wa.me/593998576759'));
  assert.equal(out.split('</head>')[0],html.split('</head>')[0]);
  assert.equal(hook(out,{sku:'ADAP004',stock:13},{enabled:true}),out);
  const removed=out.replace(/<a data-ct-checkout[\s\S]*?<\/a>/,'').replace(require('../../politicas/enlaces.cjs').fragment,'');
  assert.equal(removed,html);
});
test('agotados conservan la ficha sin botón que prometa una compra',()=>{
  const html=read('productos/'+urls.ADAP004+'/index.html');
  assert.ok(!hook(html,{sku:'ADAP004',stock:0},{enabled:true}).includes('data-ct-checkout'));
});
