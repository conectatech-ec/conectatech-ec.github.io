/* Rótulo visible: no altera autenticidad, títulos, SEO ni datos de origen. */
function apple(p,c){
 const r=c.reglaSKU||{},brand=String(c.caracteristicas?.Marca||'').trim();
 if(brand&&!/^(apple|sin marca|gen[eé]rico|no (?:declarad[ao]|especificad[ao])|por verificar)$/i.test(brand))return false;
 if(r.marca_referencia_excepcion)return r.marca_referencia_excepcion==='APPLE';
 const name=[p.name,c.nombre,c.caracteristicas?.['Marca de referencia']].join(' ');
 if(/\b(?:Samsung|SAM|Xiaomi|XIA|JBL|Bose|Lenovo|Recci)\b/i.test(name))return false;
 return /\b(?:Apple|iPhone|IPH|iPad|AirPods|EarPods)\b|\bMagSafe\s*2\b/i.test(name)||
  /Marca de referencia:\s*APPLE\b/i.test(r.evidencia_autenticidad||'')||
  (/\bLightning\b/i.test(name)&&/^(?:CABL|ADAP|AUDI|CARG|CUBO)/.test(p.sku));
}
function label(p,c){const r=c.reglaSKU||{};return r.autenticidad==='original verificado'?'Producto original':r.autenticidad==='genérico/compatible'?(apple(p,c)||r.rotulo_ficha==='Producto compatible'?'Producto compatible':r.rotulo_ficha==='AAA'?'AAA':'Producto compatible (AAA)'):'';}
function visible(p,c,value){
 if(c.reglaSKU?.autenticidad!=='genérico/compatible'||(!apple(p,c)&&c.reglaSKU?.rotulo_ficha!=='Producto compatible'))return value;
 const clean=text=>text.replace(/Producto compatible\s*\(AAA\)/gi,'Producto compatible')
  .replace(/versión AAA\s*(?:\/\s*genérica|genérica\s*\/\s*compatible)/gi,m=>m[0]==='V'?'Versión compatible':'versión compatible')
  .replace(/versión AAA\b/gi,m=>m[0]==='V'?'Versión compatible':'versión compatible').replace(/Producto AAA\b/gi,'Producto compatible')
  .replace(/\bAAA genéricos\b/gi,'compatibles').replace(/\bAAA plateados\b/gi,'Plateados');
 // Sólo nodos de texto: conservar enlaces, fotografías, atributos y nombres de origen.
 return String(value??'').split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part:clean(part)).join('');
}
module.exports={apple,label,visible};
