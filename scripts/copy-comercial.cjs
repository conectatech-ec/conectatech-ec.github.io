'use strict';
// La condición comercial se conserva en su rótulo. Aquí se comprueban sólo
// los textos de venta, sin tocar originales593, datos técnicos ni clasificación.
function problemas(text,sku=''){
 const value=String(text||'');const reasons=[];
 const battery=/^PILA/.test(sku)||/\b(?:pilas?|bater[ií]as?|celdas?|Ni[- ]?(?:Cd|MH))\b/i.test(value);
 if(/\b(?:producto|versi[oó]n|clasificaci[oó]n|condici[oó]n|calidad)\s+(?:[^.;]{0,25}\s)?AAA\b/i.test(value)||/\bAAA\s*(?:\/\s*)?gen[eé]ric/i.test(value)||(/\bAAA\b/.test(value)&&!battery))reasons.push('clasificación AAA repetida como texto de venta');
 if(/seg[uú]n clasificaci[oó]n comercial (?:del propietario|confirmada)/i.test(value))reasons.push('clasificación interna repetida en el texto comercial');
 if(/\bgen[eé]ric[oa]s?\b/i.test(value))reasons.push('clasificación genérica repetida como texto de venta');
 if(/\b(?:producto|versi[oó]n)\s+compatible(?:\s*\(AAA\))?(?=\s*(?:[.;,]|$))|\bversi[oó]n compatible\b|\bproducto compatible de terceros\b/i.test(value))reasons.push('clasificación compatible repetida como beneficio');
 if(/\bno se presentan como\b|\bno se promete el rendimiento de un (?:producto|art[ií]culo) original\b/i.test(value))reasons.push('aviso de originalidad repetido en el texto comercial');
 if(/\bno (?:es|son)\s+(?:un(?:os)?\s+)?(?:producto|reloj|Apple Watch|Apple|Samsung|JBL|Bose)[^.;]{0,45}\boriginal(?:es)?\b|\bno (?:es fabricado|se atribuye fabricaci[oó]n)\b/i.test(value))reasons.push('aviso de originalidad repetido en el texto comercial');
 return reasons;
}
function revisar(p,c){
 const fields=[['descripcion',c.descripcion],['descripcionSeo',c.descripcionSeo]];
 for(const [i,b]of(c.beneficios||[]).entries())fields.push(['beneficio'+i,[b.valor,b.titulo,b.descripcion].join(' ')]);
 return fields.flatMap(([campo,text])=>problemas(text,p.sku).map(motivo=>({campo,motivo})));
}
function exigir(p,c){const errors=revisar(p,c);if(errors.length)throw Error('Texto comercial pendiente '+p.sku+': '+errors.map(x=>x.campo+' '+x.motivo).join('; '));}
module.exports={problemas,revisar,exigir};
