'use strict';
module.exports = function(title, sku, authenticity) {
  let result=String(title||'');
  const charger=/^CARG/.test(sku);
  const batteryFormat=/^PILA/.test(sku)||/\bAA\s*(?:[+/,&]|y)\s*AAA\b|\bincluye\s+AAA\b|\bpilas?\b.*\bAAA\b/i.test(result);
  if(batteryFormat) result=result.replace(/\bAAA\b/g,'FORMATO_PILA_TEMPORAL');
  // AAA en pilas describe el formato físico; no es una condición comercial.
  if(!/^PILA/.test(sku)) result=result.replace(/\s*(?:[|·—–-]\s*)?(?:versi[oó]n\s+)?(?:AAA(?:\s*\/\s*gen[eé]rica?)?|gen[eé]ric[oa](?:\s*\/\s*compatible)?|original(?:\s+verificad[oa])?)\b/gi,' ');
  if(!charger) result=result.replace(/\bcompatibles?\b(?!\s+con\b)/gi,'');
  result=result.replace(/\(\s*\)/g,'').replace(/\s+/g,' ').replace(/\s*\|\s*$/,'').trim();
  if(charger&&authenticity==='genérico/compatible'&&!/\bcompatible\b/i.test(result)) result+=' | compatible';
  result=result.replace(/FORMATO_PILA_TEMPORAL/g,'AAA');
  return result;
};
