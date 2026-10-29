const assert=require('node:assert/strict'),{label,apple,visible}=require('./condicion-ficha.cjs');
const generic={reglaSKU:{autenticidad:'genérico/compatible',rotulo_ficha:'AAA'},caracteristicas:{}};
for(const name of ['Cargador para iPhone 20 W','Audífonos EarPods Lightning','Cable USB-A a Lightning','Cargador para Mac MagSafe 2'])assert.equal(label({sku:'CABL005',name},generic),'Producto compatible');
for(const name of ['Cargador Xiaomi de 33 W','Control inalámbrico PlayStation 4','Cargador Samsung de 45 W'])assert.equal(label({sku:'CARG036',name},generic),'AAA');
assert.equal(apple({sku:'CARG039',name:'Cargador para vehículo 4 en 1'},{...generic,caracteristicas:{Conexiones:'Lightning y USB-C'}}),false);
assert.equal(label({sku:'MICR03',name:'Micrófonos para iPhone'},{...generic,reglaSKU:{autenticidad:'original verificado'}}),'Producto original');
assert.equal(visible({sku:'ADAP007',name:'Adaptador Lightning'},generic,'Clasificación: Producto compatible (AAA)'),'Clasificación: Producto compatible');
assert.equal(visible({sku:'CUBO009',name:'Cargador Xiaomi'},generic,'Producto compatible (AAA)'),'Producto compatible (AAA)');
assert.equal(visible({sku:'AUDI005',name:'AirPods Max'},generic,'<img alt="AAA plateados"><p>AAA plateados. Versión AAA genérica/compatible.</p>'),'<img alt="AAA plateados"><p>Plateados. Versión compatible.</p>');
assert.equal(visible({sku:'AUDI111',name:'AirPods'},generic,'Audífonos inalámbricos AAA genéricos.'),'Audífonos inalámbricos compatibles.');
console.log('Condición en ficha: Apple compatible, otras marcas AAA y originales preservados.');

for(const name of ['Cargador Samsung','Cargador Xiaomi']){const c={...generic,reglaSKU:{...generic.reglaSKU,rotulo_ficha:'Producto compatible'}};assert.equal(label({sku:'CARG036',name},c),'Producto compatible');assert.equal(visible({sku:'CARG036',name},c,'Producto compatible (AAA)'),'Producto compatible');}
