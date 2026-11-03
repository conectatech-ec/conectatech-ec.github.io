'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {buildPresentation,preparePresentation,validPresentation,stable}=require('./presentacion-publica-alex.cjs');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),ORIGIN='https://conectatech-ec.github.io';
const bytes={'/imagenes/audi044/original.png':Buffer.from('original aprobado'),'/imagenes/audi044/400.webp':Buffer.from('400 aprobado'),'/imagenes/audi044/1200-r1.webp':Buffer.from('1200 aprobado')};
const cover={original:'/imagenes/audi044/original.png',sha256_original:sha(bytes['/imagenes/audi044/original.png']),contiene_caja:false,revision_visual:'Aprobada visualmente',versiones:{400:{url:'/imagenes/audi044/400.webp',sha256:sha(bytes['/imagenes/audi044/400.webp'])},1200:{url:'/imagenes/audi044/1200-r1.webp',sha256:sha(bytes['/imagenes/audi044/1200-r1.webp'])}}};
const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
function csv(id,rows){return [id+',title,image_link,price,private_unused',...rows.map(r=>[r[0],r[1],r[2],'9.00 USD','COLUMN_MUST_NOT_PROJECT'].map(q).join(','))].join('\n')+'\n';}
function fixture(edit={}){
 const a=['AUDI044','Audífonos públicos aprobados',ORIGIN+cover.versiones[1200].url],b=['PUB002','Nombre público sin foto',''],c=['FIN001','Agotado público sin aprobación',ORIGIN+'/imagenes/fin001/vendor.webp'];
 return {source_sha256:'a'.repeat(64),cut_date:'2026-11-02',multichannel:csv('sku',[a,b]),meta:csv('id',[a,c]),webProducts:[{sku:'AUDI044',source_name:'RAW_IDENTITY_MUST_NOT_PROJECT',stock:999,prices:{secret:123}},{sku:'PUB002'},{sku:'FIN001'},{sku:'PRIVATE999'}],photos:{AUDI044:{imagenProfesional:structuredClone(cover)}},readAsset:url=>bytes[url],now:()=> '2026-11-03T02:00:00.000Z',...edit};
}
test('Public union, exact CSV hashes and complete original/version SHA validation without identity/finance projection',()=>{
 const seen=[],input=fixture({readAsset:url=>{seen.push(url);return bytes[url];}}),before=stable(input.webProducts),result=preparePresentation(input),doc=result.presentation;
 assert.equal(result.status,'PRESENTATION_READY');assert(validPresentation(doc));assert.deepEqual(Object.keys(doc.products).sort(),['AUDI044','FIN001','PUB002']);assert.equal(doc.products.AUDI044.approved_media.sha256,sha(bytes[cover.versiones[1200].url]));assert.equal(doc.products.FIN001.approved_media,null);assert.equal(doc.products.PUB002.approved_media,null);assert.equal(doc.inputs.multichannel_sha256,sha(input.multichannel));assert.equal(doc.inputs.meta_sha256,sha(input.meta));assert.equal(doc.published_at,'2026-11-03T02:00:00.000Z');assert.equal(seen.length,3);assert.equal(stable(input.webProducts),before);
 for(const secret of ['RAW_IDENTITY','stock','prices','COLUMN_MUST_NOT_PROJECT','PRIVATE999'])assert(!JSON.stringify(doc).includes(secret));
 for(const entry of Object.values(doc.products))assert.deepEqual(Object.keys(entry).sort(),['approved_media','display_title']);
});
test('Builder/stable contract uses the exact version signed by the independent consumer API',()=>{
 const input={source_sha256:'a'.repeat(64),cut_date:'2026-11-02',published_at:'2026-11-03T02:00:00.000Z',multichannel:'multi',meta:'meta',products:{PUB001:{display_title:'Público',approved_media:null}}};
 const document=buildPresentation(input),{version,...body}=document;assert.equal(version,'alex-presentation-v1-'+sha(stable(body)));assert.equal(version,'alex-presentation-v1-c87e1fae5a21f3a272be88a1bf8d401f3824a2f8899224764e5fc37a2ab6569f');
});
test('Same semantic body preserves the entire previous document and never renews publication/version',()=>{
 const previous=preparePresentation(fixture()).presentation;let clock=0;
 const next=preparePresentation(fixture({previous,now:()=>{clock++;return '2026-11-04T03:00:00.000Z';}}));assert.equal(next.presentation,previous);assert.equal(clock,0);assert.equal(next.status,'PRESENTATION_READY');
});
test('New approved title emits once at the real supplied publication time; source cut stays intact',()=>{
 const first=preparePresentation(fixture()).presentation,input=fixture({previous:first,now:()=> '2026-11-03T02:10:00.000Z'});input.multichannel=input.multichannel.replace('Audífonos públicos aprobados','Título público actualizado');input.meta=input.meta.replace('Audífonos públicos aprobados','Título público actualizado');const next=preparePresentation(input).presentation;assert.notEqual(next.version,first.version);assert.equal(next.published_at,'2026-11-03T02:10:00.000Z');assert.equal(next.source_sha256,first.source_sha256);assert.equal(next.cut_date,first.cut_date);assert.equal(preparePresentation({...input,previous:next}).presentation,next);
});
test('Missing visual approval, vendor without SHA, box or unapproved paths produce null media and no invented approval',()=>{
 for(const edit of [p=>delete p.revision_visual,p=>p.contiene_caja=true,p=>delete p.sha256_original,p=>delete p.versiones[400].sha256,p=>p.original='/imagenes/../private.png']){const input=fixture({readAsset(){assert.fail('Unknown media must not read assets');}});edit(input.photos.AUDI044.imagenProfesional);const result=preparePresentation(input);assert.equal(result.status,'PRESENTATION_READY');assert.equal(result.presentation.products.AUDI044.approved_media,null);}
});
test('Any original/version SHA mismatch preserves the last intact document and a constant sanitized error',()=>{
 const previous=preparePresentation(fixture()).presentation;
 for(const target of Object.keys(bytes)){const result=preparePresentation(fixture({previous,readAsset:url=>url===target?Buffer.from('alterado'):bytes[url]}));assert.equal(result.presentation,previous);assert.equal(result.status,'PRESENTATION_PREPARATION_FAILED');assert(validPresentation(result.presentation));}
});
test('Read interruption cannot replace last valid, and recovery succeeds without resetting commerce',()=>{
 const previous=preparePresentation(fixture()).presentation,result=preparePresentation(fixture({previous,readAsset(){throw Error('PRIVATE_SOURCE_PATH_OR_SECRET');}}));assert.equal(result.presentation,previous);assert(!JSON.stringify(result).includes('PRIVATE_SOURCE_PATH_OR_SECRET'));assert.equal(preparePresentation(fixture({previous})).presentation,previous);
});
test('A failed new cut retains original old SHA/date rather than relabeling it',()=>{
 const previous=preparePresentation(fixture()).presentation,result=preparePresentation(fixture({previous,source_sha256:'b'.repeat(64),cut_date:'2026-11-03',readAsset(){throw Error('interruption');}}));assert.equal(result.presentation,previous);assert.equal(result.presentation.source_sha256,'a'.repeat(64));assert.equal(result.presentation.cut_date,'2026-11-02');assert.equal(result.status,'PRESENTATION_PREPARATION_FAILED');
});
test('Malformed/tampered previous projection cannot leak extra identity fields when preparation fails',()=>{
 const previous=preparePresentation(fixture()).presentation;previous.products.AUDI044.source_name='PRIVATE_IDENTITY';const {version,...body}=previous;previous.version='alex-presentation-v1-'+sha(stable(body));assert(!validPresentation(previous));const result=preparePresentation(fixture({previous,readAsset(){throw Error('interrupted');}}));assert.equal(result.presentation,null);assert.equal(result.status,'PRESENTATION_PREPARATION_FAILED');assert(!JSON.stringify(result).includes('PRIVATE_IDENTITY'));
});
test('Unknown SKU, duplicate CSV, conflicting public rows or malformed CSV cannot authorize a candidate',()=>{
 const previous=preparePresentation(fixture()).presentation;
 for(const edit of [i=>i.webProducts=i.webProducts.filter(p=>p.sku!=='AUDI044'),i=>i.multichannel+=i.multichannel.split('\n')[1]+'\n',i=>i.meta=i.meta.replace('Audífonos públicos aprobados','Conflicting title'),i=>i.multichannel='sku,title\ninvalid\n']){const input=fixture({previous});edit(input);const result=preparePresentation(input);assert.equal(result.presentation,previous);assert.equal(result.status,'PRESENTATION_PREPARATION_FAILED');}
});
test('Bad publication date or invalid digest is never considered valid metadata',()=>{
 assert.equal(preparePresentation(fixture({now:()=> 'not-a-date'})).presentation,null);const document=preparePresentation(fixture()).presentation;document.products.AUDI044.display_title='tampered';assert(!validPresentation(document));
});
test('Same-cut equal/backward clock preserves last valid bytes, then real later time recovers',()=>{
 const previous=preparePresentation(fixture()).presentation,original=stable(previous);
 for(const stamp of [previous.published_at,'2026-11-03T01:59:59.999Z']){
  const input=fixture({previous,now:()=>stamp});input.multichannel=input.multichannel.replace('Audífonos públicos aprobados','Cambio editorial posterior');input.meta=input.meta.replace('Audífonos públicos aprobados','Cambio editorial posterior');
  const failed=preparePresentation(input);assert.equal(failed.presentation,previous);assert.equal(stable(failed.presentation),original);assert.equal(failed.status,'PRESENTATION_PREPARATION_FAILED');assert.equal(failed.error_code,'PRESENTATION_CLOCK_NOT_ADVANCED');
  const recovered=preparePresentation({...input,previous:failed.presentation,now:()=> '2026-11-03T02:00:00.001Z'});assert.equal(recovered.status,'PRESENTATION_READY');assert.notEqual(recovered.presentation.version,previous.version);assert.equal(recovered.presentation.published_at,'2026-11-03T02:00:00.001Z');
 }
});
test('Official boolean visual approval accepts only the same original/version SHA contract as historical text',()=>{
 const input=fixture(),seen=[];input.photos.AUDI044.imagenProfesional.revision_visual=true;input.readAsset=url=>{seen.push(url);return bytes[url];};
 const result=preparePresentation(input);assert.equal(result.status,'PRESENTATION_READY');assert(validPresentation(result.presentation));assert.equal(result.presentation.products.AUDI044.approved_media.url,ORIGIN+cover.versiones[1200].url);assert.equal(result.presentation.products.AUDI044.approved_media.sha256,sha(bytes[cover.versiones[1200].url]));assert.equal(seen.length,3);
});
test('Boolean approval with a wrong original/version SHA preserves last valid and never approves changed bytes',()=>{
 const previous=preparePresentation(fixture()).presentation;
 for(const target of Object.keys(bytes)){const input=fixture({previous,readAsset:url=>url===target?Buffer.from('changed unapproved bytes'):bytes[url]});input.photos.AUDI044.imagenProfesional.revision_visual=true;const result=preparePresentation(input);assert.equal(result.status,'PRESENTATION_PREPARATION_FAILED');assert.equal(result.presentation,previous);assert(validPresentation(result.presentation));}
});
test('False/null review and truth-like values without the SHA contract cannot invent photographic approval',()=>{
 for(const review of [false,null,undefined,0,'']){const input=fixture({readAsset(){assert.fail('Rejected visual review must not read media');}});input.photos.AUDI044.imagenProfesional.revision_visual=review;const result=preparePresentation(input);assert.equal(result.status,'PRESENTATION_READY');assert.equal(result.presentation.products.AUDI044.approved_media,null);}
 for(const review of [true,'true','Aprobada visualmente']){const input=fixture({readAsset(){assert.fail('Missing SHA evidence must not read media');}});input.photos.AUDI044.imagenProfesional.revision_visual=review;delete input.photos.AUDI044.imagenProfesional.sha256_original;const result=preparePresentation(input);assert.equal(result.status,'PRESENTATION_READY');assert.equal(result.presentation.products.AUDI044.approved_media,null);}
});
