// Por defecto solo informa. Nunca ejecutar generadores comerciales para añadir enlaces.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const link = require('./enlaces.cjs');
const config = require('./politica.json');
const rootArg = process.argv.indexOf('--root');
if (rootArg < 0 || !process.argv[rootArg + 1]) throw Error('Usar --root COPIA_AISLADA');
const root = path.resolve(process.argv[rootArg + 1]);
const apply = process.argv.includes('--aplicar');
if (apply && (config.estado !== 'APROBADA' || config.publicar !== true)) throw Error('Política sin aprobación: aplicación bloqueada');
const files = [path.join(root, 'index.html')];
const products = path.join(root, 'productos');
if (fs.existsSync(products)) for (const entry of fs.readdirSync(products, {withFileTypes:true})) {
  if (entry.isDirectory()) {
    const file = path.join(products, entry.name, 'index.html');
    if (fs.existsSync(file)) files.push(file);
  }
}
const result = [];
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8'), after = link(before);
  if (before === after) continue;
  result.push({archivo:path.relative(root,file), sha256_antes:crypto.createHash('sha256').update(before).digest('hex'), solo_enlace:true});
  if (apply) fs.writeFileSync(file, after);
}
process.stdout.write(JSON.stringify({modo:apply?'APLICADO':'SIMULACION_SIN_ESCRITURAS', archivos:result.length, cambios:result},null,2)+'\n');
