import {test} from 'node:test';
import assert from 'node:assert/strict';
import {phoneVariant,phoneFamily} from '../phone-variants.mjs';

const phone=(sku,source_name,extra={})=>({sku,source_name,name:source_name,category:'TELEFONOS',...extra});
const a17=[
 phone('TELFSYN001','TELEFONO SAMSUNG A17 4GB+128GB'),
 phone('TELFSYN002','TELEFONO SAMSUNG A17 8GB+256GB'),
 phone('TELFSYN003','TELEFONO SAMSUNG A17 PRO 256GB 8GB+8GB'),
 phone('TELFSYN004','TELEFONO SAMSUNG A17 PLUS 256GB 8GB+8GB')
];
const redmi=[
 phone('TELFSYN010','TELEFONO REDMI 15C 128GB 4GB+4GB'),
 phone('TELFSYN011','TELEFONO REDMI 15C 256GB 4GB+4GB'),
 phone('TELFSYN012','TELEFONO REDMI 15C 256GB 8GB+8GB'),
 phone('TELFSYN013','TELEFONO REDMI 15 256GB 8GB+8GB')
];
test('RAM notation preserves storage, physical RAM and virtual expansion without adding them',()=>{
 const samsung=phoneVariant(a17[0]);assert.equal(samsung.brand,'Samsung');assert.equal(samsung.model,'A17');assert.equal(samsung.storage_gb,128);assert.equal(samsung.ram_physical_gb,4);assert.equal(samsung.ram_virtual_gb,null);
 const expanded=phoneVariant(redmi[2]);assert.equal(expanded.storage_gb,256);assert.equal(expanded.ram_physical_gb,8);assert.equal(expanded.ram_virtual_gb,8);assert.notEqual(expanded.ram_physical_gb,16);
 const annotated=phoneVariant(phone('TELFSYN014','TELEFONO REDMI 15C 256GB 16 GB RAM total (8 GB físicos + 8 GB virtuales)'));
 assert.equal(annotated.ram_physical_gb,8);assert.equal(annotated.ram_virtual_gb,8);
 const short=phoneVariant(phone('TELFSYN015','TELEFONO REDMI 15C 256GB 8+8GB'));assert.equal(short.ram_physical_gb,8);assert.equal(short.ram_virtual_gb,8);
 const totalOnly=phoneVariant(phone('TELFSYN016','TELEFONO REDMI 15C 256GB 16 GB RAM TOTAL'));
 assert.equal(totalOnly.ram_physical_gb,null);assert.ok(totalOnly.issues.includes('RAM_TOTAL_NOT_PHYSICAL'));
});
test('A named model returns every SKU variant and preserves exact storage/RAM selection separately',()=>{
 const all=[...a17,...redmi];
 assert.deepEqual(phoneFamily('Busco un Samsung A17',all).variants.map(p=>p.sku),a17.slice(0,2).map(p=>p.sku));
 const three=phoneFamily('Redmi 15C',all);assert.equal(three.variants.length,3);assert.equal(three.exact.length,3);assert.equal(three.is_family_query,true);
 const exact=phoneFamily('Redmi 15C de 256 GB y 8 GB de RAM',all);assert.equal(exact.variants.length,3);assert.deepEqual(exact.exact.map(p=>p.sku),['TELFSYN012']);assert.equal(exact.explicit_variant,true);
 assert.deepEqual(phoneFamily('TELFSYN001',all).exact.map(p=>p.sku),['TELFSYN001']);
 const snapshot=JSON.stringify(all);phoneFamily('Redmi 15C',all);assert.equal(JSON.stringify(all),snapshot);
});
test('Pro, Plus and base model identities are distinct and never silently substituted',()=>{
 const base=phoneFamily('Samsung Galaxy A17',a17);assert.deepEqual(base.variants.map(p=>p.sku),['TELFSYN001','TELFSYN002']);
 assert.deepEqual(phoneFamily('Samsung A17 Pro',a17).variants.map(p=>p.sku),['TELFSYN003']);
 assert.deepEqual(phoneFamily('Samsung A17 Plus',a17).variants.map(p=>p.sku),['TELFSYN004']);
 assert.equal(phoneFamily('Samsung A17',a17.slice(2)),null);
 assert.deepEqual(phoneFamily('Redmi 15',redmi).variants.map(p=>p.sku),['TELFSYN013']);
});
test('Networks remain explicit per SKU; a 4G request excludes 5G and unknown connectivity',()=>{
 const rows=[phone('TELFSYN020','TELEFONO SAMSUNG A17 4G 128GB 4GB'),phone('TELFSYN021','TELEFONO SAMSUNG A17 5G 256GB 8GB'),phone('TELFSYN022','TELEFONO SAMSUNG A17 256GB 8GB')];
 const generic=phoneFamily('Samsung A17',rows);assert.equal(generic.variants.length,3);assert.deepEqual(generic.all_identities.map(i=>i.connectivity),['4G','5G',null]);
 assert.deepEqual(phoneFamily('Samsung A17 4G',rows).variants.map(p=>p.sku),['TELFSYN020']);
 assert.deepEqual(phoneFamily('Samsung A17 5G',rows).variants.map(p=>p.sku),['TELFSYN021']);
});
test('HONOR, TECNO, Infinix, ZTE and Xiaomi names use their actual model families',()=>{
 const rows=[
  phone('TELFSYN030','TELEFONO HONOR X5C 128GB 4GB+4GB'),phone('TELFSYN031','TELEFONO HONOR X5C PLUS 256GB 4GB+4GB'),
  phone('TELFSYN032','TELEFONO TECNO SPARK GO 3 64GB 4GB+4GB'),phone('TELFSYN033','TELEFONO TECNO SPARK GO 3 128GB 4GB+4GB'),
  phone('TELFSYN034','TELEFONO INFINIX HOT 70 128GB 4GB+4GB'),phone('TELFSYN035','TELEFONO INFINIX HOT 70 256GB 8GB+8GB'),
  phone('TELFSYN036','TELEFONO ZTE V80 MAX 256GB 4GB+10GB'),phone('TELFSYN037','TELEFONO ZTE V80 MAX 256GB 8GB+12GB'),
  phone('TELFSYN038','TELEFONO XIAOMI 14 128GB 8GB'),phone('TELFSYN039','TELEFONO XIAOMI 14 256GB 12GB')
 ];
 assert.equal(phoneFamily('HONOR X5C',rows).variants.length,1);
 assert.equal(phoneFamily('TECNO SPARK GO 3',rows).variants.length,2);
 assert.equal(phoneFamily('Infinix Hot70',rows).variants.length,2);
 assert.equal(phoneFamily('ZTE V80 Max',rows).variants.length,2);
 assert.equal(phoneFamily('Xiaomi 14',rows).variants.length,2);
 assert.equal(phoneFamily('Samsung A17',rows),null);
});
test('A capacity follow-up stays inside the chosen model, without changing physical RAM by virtual totals',()=>{
 const selected=phoneFamily('¿Y el de 256 GB?',redmi,{focus:['TELFSYN010']});assert.equal(selected.variants.length,3);assert.deepEqual(selected.exact.map(p=>p.sku),['TELFSYN011','TELFSYN012']);
 const physical=phoneFamily('¿Y el de 8 GB de RAM?',redmi,{focus:['TELFSYN010']});assert.deepEqual(physical.exact.map(p=>p.sku),['TELFSYN012']);
 assert.equal(phoneFamily('¿Y cuánto cuesta?',redmi,{focus:['TELFSYN010']}),null);
 assert.equal(phoneFamily('Compara Samsung A17 y Redmi 15C',[...a17,...redmi]),null);
});
test('Ambiguous or inconsistent identity metadata never becomes a verified physical variant',()=>{
 const malformed=phoneVariant(phone('TELFSYN040','TELEFONO HONOR X7D 256B 6GB+6GB'));assert.equal(malformed.storage_gb,null);assert.equal(malformed.verified_identity,false);
 const conflict=phoneVariant(phone('TELFSYN041','TELEFONO SAMSUNG A17 4GB+128GB',{caracteristicas:{Almacenamiento:'256 GB','RAM física':'8 GB'}}));assert.equal(conflict.verified_identity,false);assert.ok(conflict.issues.includes('STORAGE_CONFLICT'));assert.ok(conflict.issues.includes('RAM_PHYSICAL_CONFLICT'));
 const ambiguous=phoneVariant(phone('TELFSYN042','TELEFONO SAMSUNG A17 128GB+256GB'));assert.equal(ambiguous.verified_identity,false);
 assert.equal(phoneVariant(phone('TELFSYN043','TELEFONO NOTE 50S 256GB')),null);
 assert.equal(phoneVariant({sku:'CASE001',source_name:'FUNDA PARA SAMSUNG A17 128GB'}),null);
 const unproven=phoneVariant({sku:'TELFSYN044',nombre:'Samsung A17 128GB'});assert.equal(unproven.verified_identity,false);
});
test('The identity helper keeps unavailable or blocked source rows visible for the caller business guard, never fabricating stock/prices',()=>{
 const rows=redmi.slice(0,3).map((p,i)=>({...p,availability:i===1?'out_of_stock':i===2?'blocked':'in_stock',prices:i===2?null:{promo_cash_cents:10000+i}}));
 const family=phoneFamily('Redmi 15C',rows);assert.equal(family.variants.length,3);assert.equal(family.variants[1],rows[1]);assert.equal(family.variants[2].prices,null);
 assert.ok(family.all_identities.every(p=>!Object.hasOwn(p,'stock')&&!Object.hasOwn(p,'quantity')&&!Object.hasOwn(p,'prices')));
});
