const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const filename = path.resolve('scripts/verificar-catalogo.cjs');
// Cargar la función de medición sin iniciar Chromium ni ejecutar el verificador.
const code = fs.readFileSync(filename, 'utf8')
  .replace(/^#![^\n]*\n/, '')
  .replace(/main\(\)\.catch[\s\S]*$/, '');
const context = {require: require('node:module').createRequire(filename), __dirname: path.dirname(filename), process, console, URL};
vm.runInNewContext(code + '\nglobalThis.checkCompact=compactCard;', context);
const base = 'reportes/continuacion-117/qa-publica/';
const report = JSON.parse(fs.readFileSync(base + 'catalogo-falso-positivo-fila.json'));
const measurement = JSON.parse(fs.readFileSync(base + 'rel066-medicion.json'));
const observed = report.resultados.find(x => x.ancho_viewport === 390).diseno.tarjetas.find(c => c.sku === 'REL066');
const card = {...observed, altura_contenido: measurement.natural.height};
assert.equal(context.checkCompact(card, 390), true);
assert.equal(context.checkCompact({...card, altura: 471}, 390), false);
assert.equal(context.checkCompact({...card, altura: 450, altura_contenido: 440}, 390), false);
assert.equal(context.checkCompact({...card, contenido_largo: ['descripcion']}, 390), false);
assert.equal(context.checkCompact({...card, altura_contenido: card.altura + 5}, 390), false);
const proof = {
  estado: 'APROBADO',
  casoRealREL066: {alturaVisible: card.altura, alturaContenido: card.altura_contenido, alturaBase: card.altura_contenido - card.alto_estado - card.alto_subtitulo},
  controles: ['contenido real compacto aceptado', 'altura total 471px rechazada', 'contenido base sobre 410px rechazado', 'descripción extensa rechazada', 'contenido mayor que caja visible rechazado'],
  limitesNoAmpliados: true
};
fs.writeFileSync(base + 'regresion-medicion-fila.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
