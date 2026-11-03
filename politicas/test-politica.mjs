import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {garantia, validar, respuestaAlex} from './garantias.mjs';
const require = createRequire(import.meta.url), link = require('./enlaces.cjs');
const config = JSON.parse(fs.readFileSync(new URL('./politica.json',import.meta.url),'utf8'));
const clone = ()=>structuredClone(config);

test('plazos y terminología aprobados',()=>{
  const c=clone();c.garantias.reglas_categoria.celulares.valor=1;c.garantias.reglas_categoria.accesorios.valor=30;
  assert.equal(garantia(c,{categoriaCatalogo:'TELEFONOS'}).texto,'1 año de garantía por defectos de fabricación');
  assert.equal(garantia(c,{categoriaGarantia:'accesorios'}).texto,'30 días de garantía por defectos de fabricación');
  assert.ok(!JSON.stringify(config).includes('12 meses'));
});
test('categorías desconocidas y SKU no se adivinan',()=>{
  assert.equal(garantia(config,{sku:'TELF_PRUEBA'}).valor,null);
  assert.equal(garantia(config,{categoriaGarantia:'tablets'}).valor,null);
});
test('categoría ampliable por datos, sin reescribir resolver',()=>{
  const c=clone();c.garantias.reglas_categoria.celulares.valor=2;
  assert.equal(garantia(c,{categoriaGarantia:'celulares'}).etiqueta,'2 años de garantía');
});
test('excepción documentada de SKU prevalece',()=>{
  const c=clone();c.garantias.excepciones_sku.PRUEBA={categoria:'accesorios',valor:90,unidad:'dia',aprobada:true,evidencia:'caso de prueba, no SKU real'};
  assert.equal(garantia(c,{sku:'PRUEBA'}).valor,90);
});
test('no reducir plazo ni ampliar sin evidencia',()=>{
  const c=clone();c.garantias.excepciones_sku.PRUEBA={categoria:'accesorios',valor:29,unidad:'dia',aprobada:true,evidencia:'prueba'};
  assert.throws(()=>validar(c),/reducir/);
  c.garantias.excepciones_sku.PRUEBA.valor=90;c.garantias.excepciones_sku.PRUEBA.aprobada=false;
  assert.throws(()=>validar(c),/evidencia/);
});
test('no acortar derecho legal a ventana comercial',()=>{
  const c=clone();c.devolucion_legal.valor=3;
  assert.throws(()=>validar(c),/Derechos legales/);
  assert.match(respuestaAlex(config,'devolucion_legal'),/quince/);
  assert.match(respuestaAlex(config,'cambio_voluntario'),/derecho legal/);
});
test('Alex evalúa daños y deriva errores sin prometer plazos',()=>{
  assert.match(respuestaAlex(config,'danio_o_exclusion'),/no elimina automáticamente/);
  assert.match(respuestaAlex(config,'error_tienda'),/responsable/);
  const alex=JSON.parse(fs.readFileSync(new URL('./alex-fuente.json',import.meta.url),'utf8'));
  assert.equal(alex.worker_modificado,false);
  assert.equal(alex.requiere_coordinacion_sesion_alex,true);
});
test('enlace idempotente y resto del HTML íntegro',()=>{
  const before='<html><body><script type="application/ld+json">{"sku":"PRUEBA","price":"1.00"}</script><footer>Original</footer></body></html>';
  const after=link(before);
  assert.equal(after.replace(link.fragment,''),before);
  assert.equal(link(after),after);
  assert.match(link('<html><body>Ficha</body></html>'),/<footer>/);
});
test('Merchant no contiene tarifas, plazos de pago ni publicación inventados',()=>{
  const google=JSON.parse(fs.readFileSync(new URL('./merchant-center.json',import.meta.url),'utf8'));
  assert.equal(google.publicar,false);
  assert.equal(google.politica_publicada,false);
  assert.equal(google.plazo_legal.valor,15);
  assert.equal(google.campos_google_no_confirmados.refund_processing_days,null);
  assert.equal(google.campos_google_no_confirmados.return_shipping_fee,null);
  assert.deepEqual(google.conservar_exclusiones,['Shopping_ads','Free_listings']);
});
test('página y texto completo generados, sin publicar ni datos estructurados de devolución incompletos',()=>{
  const page=fs.readFileSync(new URL('../cambios-devoluciones-garantias/index.html',import.meta.url),'utf8');
  assert.match(page,/noindex,nofollow/);assert.match(page,/Borrador para aprobación/);
  assert.ok(!page.includes('MerchantReturnPolicy'));assert.ok(!page.includes('{{'));
  for(const section of config.secciones) assert.ok(page.includes('id="'+section.id+'"'));
});
