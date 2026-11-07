import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkoutMode,checkoutApiBase,verifiedReceipt} from './cliente-contrato.mjs';
const items=[{sku:'PRUEBA',quantity:2,unitPriceCents:350,lineTotalCents:700}];
const quote={quoteId:'quote-test',items,subtotalCents:700,shippingCents:350,totalCents:1050};
const catalog={mode:'datahub',enabled:true};
const receipt=()=>({id:'ORDER-TEST',mode:'datahub',liveOrder:true,paid:false,stockReservedIn593:false,paymentStatus:'pending_cod',status:'pedido_recibido_contraentrega',...structuredClone(quote)});
test('no convierte una respuesta deshabilitada en compra real',()=>{
  assert.throws(()=>checkoutMode({mode:'datahub',enabled:false}));
  assert.throws(()=>checkoutMode({mode:'production',enabled:true}));
  assert.equal(checkoutMode(catalog),'datahub');
  assert.equal(checkoutMode({mode:'test'}),'test');
});
test('el endpoint público no acepta credenciales, HTTP ni URLs con secretos',()=>{
  const origin='https://conectatech-ec.github.io';
  assert.equal(checkoutApiBase('',origin),'');
  assert.equal(checkoutApiBase(origin,origin),'');
  assert.equal(checkoutApiBase('https://example.invalid',origin),'https://example.invalid');
  for(const url of ['http://example.invalid','https://key@example.invalid','https://example.invalid?token=x','https://example.invalid/#secret','https://example.invalid/private'])assert.throws(()=>checkoutApiBase(url,origin));
});
test('sólo reconoce un pedido duradero COD con importe y contenido aceptados',()=>{
  assert.equal(verifiedReceipt(receipt(),quote,catalog),'datahub');
  for(const patch of [{paid:true},{liveOrder:false},{stockReservedIn593:true},{quoteId:'otro'},{totalCents:1100},{shippingCents:0},{status:'solicitud_pendiente_de_confirmacion'},{items:[{...items[0],quantity:3}]}])assert.throws(()=>verifiedReceipt({...receipt(),...patch},quote,catalog));
});
test('conserva comprobantes sintéticos sin presentarlos como ventas',()=>{
  const r={...receipt(),mode:'test',liveOrder:false};
  assert.equal(verifiedReceipt(r,quote,{mode:'test'}),'test');
  assert.throws(()=>verifiedReceipt({...r,liveOrder:true},quote,{mode:'test'}));
});
