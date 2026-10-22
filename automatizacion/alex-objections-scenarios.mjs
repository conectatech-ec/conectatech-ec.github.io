// Public synthetic customer script; shared assertions for local and deployed private HTTPS.
import assert from 'node:assert/strict';
export const objectionConversation=[
 'Hola, busco un Samsung A17',
 'Me interesa el Samsung A17 de 128 GB; mi presupuesto es de doscientos dólares',
 '¿Qué precio tiene al contado?',
 '¿Y con tarjeta cuánto cuesta?',
 '¿Y con tarjeta Pacífico a tres meses?',
 'Pero no tengo tarjeta Pacífico',
 'Tengo Pichincha',
 '¿Y a seis meses?',
 'Mejor uso Diners',
 '¿Y a doce meses cuánto termino pagando?',
 '¿Hacen contraentrega en Quito?',
 'Prefiero contraentrega en Quito. Estoy en La Carolina, Quito',
 '¿Y también hacen envíos nacionales?',
 'No quiero comprar todavía',
 'Quiero continuar después',
 'Sigamos con ese Samsung',
 '¿Y si pago con Pichincha a seis meses?',
 'Mejor pago al contado',
 '¿Qué batería tiene ese?',
 'Quiero ver una fotografía de ese Samsung',
 '¿Y ese cuánto cuesta?'
];
const bankKeys=['pacifico','pichincha','diners','guayaquil_amex','plans'];
export function assertCommercialTurn(i,a,previous,{quotesCurrent=false,cash=null,card=null}={}){
 assert.ok(a.text&&a.text.length<=440,'Short useful response');assert.ok((a.text.match(/\?/g)||[]).length<=1,'At most one main question');
 assert.ok(!/TELF011|TELF012|SKU|stock referencial|\d+ unidades/i.test(a.text),'No internal or invented inventory copy');
 assert.notEqual(a.action,'handoff','No unnecessary human transfer');
 if(i===0){assert.deepEqual(a.focus,['TELF011','TELF012']);assert.match(a.text,/128 GB/);assert.match(a.text,/256 GB/);}
 else {assert.deepEqual(a.focus,['TELF011'],'Exact variant and pronouns survive');assert.equal(a.memory.budget,200,'Budget survives transcript trimming');}
 if(i>0)assert.ok(!/¡?hola|bienvenid|soy alex/i.test(a.text),'No repeated greetings');
 if(i===2||i===3||i===17||i===20){if(quotesCurrent){assert.ok(a.text.includes((i===3?card:cash)),'Exact verified price');}else{assert.match(a.text,/requiere confirmación/);assert.ok(!a.text.includes('$'),'No old price');}}
 if(i===5){assert.ok(!/Pacífico|tres meses|sin intereses/i.test(a.text),'Denial never repeats rejected promotion');assert.match(a.text,/otra|otro/);assert.ok(a.text.includes('?'));assert.equal(a.memory.bank||null,null);assert.equal(a.memory.months||null,null);assert.ok(a.memory.rejected_banks.includes('pacifico'));}
 if(i>5){assert.ok(!/Pacífico/i.test(a.text),'Rejected offer remains excluded after later turns');assert.ok(!(a.facts||[]).includes('pacifico'));assert.ok(!(a.facts||[]).includes('plans'));}
 if(i===6){assert.equal(a.memory.bank,'pichincha');assert.equal(a.memory.payment,'tarjeta');assert.equal(a.memory.months||null,null,'New bank must not inherit old terms');}
 if(i===7){assert.equal(a.memory.months,6);assert.ok(!/a seis.{0,20}con intereses/i.test(a.text));}
 if(i===8){assert.equal(a.memory.bank,'diners');assert.equal(a.memory.months||null,null);assert.ok(!/Pichincha/i.test(a.text),'Bank switch is not old offer');}
 if(i===9){assert.equal(a.memory.months,12);assert.match(a.text,/PVP más intereses/);assert.ok(!a.text.includes('$'),'Unverified interest total never calculated');}
 if(i===10){assert.match(a.text,/cobertura|costo|fecha/);assert.ok(!/gratis|te llega hoy|garantiz/i.test(a.text));}
 if(i>=11){assert.equal(a.memory.delivery,'quito','A shipping question does not change the chosen delivery');assert.equal(a.memory.sector,'La Carolina');}
 if(i===12){assert.match(a.text,/costo adicional/);assert.equal(a.memory.bank,'diners');}
 if(i===13||i===14){assert.equal(a.memory.stage,'consulta');assert.equal(a.memory.purchase_deferred,true);assert.ok(!/¿|sin intereses|confirm.*compra|prefieres.*(?:pago|entrega|retir)/i.test(a.text));assert.ok(!(a.quick_replies||[]).some(q=>q.payload.includes(':buy')));}
 if(i===15){assert.equal(a.memory.bank,'diners');assert.equal(a.memory.months,12);assert.equal(a.memory.purchase_deferred,false);assert.match(a.text,/Samsung/);assert.ok(!(a.facts||[]).some(f=>bankKeys.includes(f)),'Resuming does not repeat unrelated promotions');}
 if(i===16){assert.equal(a.memory.bank,'diners','A hypothetical alternative is not a new preference');assert.equal(a.memory.months,12,'A quoted alternative does not rewrite chosen-bank terms');}
 if(i===17){assert.equal(a.memory.payment,'contado');assert.equal(a.memory.bank||null,null);assert.equal(a.memory.months||null,null);}
 if(i===18){assert.match(a.text,/5000 mAh/);assert.ok(!(a.facts||[]).some(f=>bankKeys.includes(f)));}
 if(i===19){assert.ok(a.image===null||a.image==='TELF011'||a.image.includes('/telf011/'));}
 if(previous&&i!==0&&i!==1&&i!==15&&i!==20&&i!==18){assert.equal(a.memory.budget,previous.budget);}
}
