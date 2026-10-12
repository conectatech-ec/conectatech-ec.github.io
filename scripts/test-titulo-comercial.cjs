const assert=require('node:assert/strict');const title=require('./titulo-comercial.cjs');
assert.equal(title('Audífonos Tune 220 | versión AAA rosa','AUDI065','genérico/compatible'),'Audífonos Tune 220 rosa');
assert.equal(title('Cargador USB-C AAA','CARG001','genérico/compatible'),'Cargador USB-C | compatible');
assert.equal(title('Pila alcalina AAA','PILA001','original verificado'),'Pila alcalina AAA');
assert.equal(title('Cargador para AA + AAA + 9V','CARG006','original verificado'),'Cargador para AA + AAA + 9V');
assert.equal(title('Adaptador compatible con USB-C','ADAP001','original verificado'),'Adaptador compatible con USB-C');
assert.equal(title('Reloj original verificado','REL001','original verificado'),'Reloj');
console.log('Política de títulos verificada.');
