const fold=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words={uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,quince:15,veinte:20,veinticinco:25,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,doscientos:200,trescientos:300,quinientos:500,mil:1000};
const vagueSector=/^(?:quito|guayaquil|ecuador|celular|telefono|casa|domicilio|tarjeta|contado|bateria|microfono|producto)$/;
export const bankNames={pacifico:'Pacífico',guayaquil_amex:'Guayaquil / American Express',diners:'Diners',pichincha:'Pichincha'};
const bankPattern=/\b(?:pacifico|guayaquil|american express|amex|diners|pichincha)\b/g;
const bankId=s=>/pacifico/.test(s)?'pacifico':/guayaquil|express|amex/.test(s)?'guayaquil_amex':/diners/.test(s)?'diners':'pichincha';
export function bankIntent(input,memory={}){
 const text=fold(input),mentions=[];
 for(const clause of text.split(/\b(?:pero|sino|aunque|en cambio|sin embargo)\b|[,;.!?¿]/)){
  for(const m of clause.matchAll(bankPattern)){
   const before=clause.slice(0,m.index),after=clause.slice(m.index+m[0].length);
   const denied=(!/\bno tengo (?:ningun )?problema\b/.test(before)&&/\b(?:no|tampoco)\s+(?:tengo|cuento|uso|utilizo|quiero|puedo|voy|pagare|pagaria|pago|dispongo|me interesa|es)\b/.test(before))||/\bno\s+(?:la\s+|esa\s+|tarjeta\s+)?$/.test(before)||/\bsin\s+(?:tarjeta\s+(?:de\s+)?)?$/.test(before)||/^\s+(?:(?:aun|todavia)\s+)?(?:no(?:\s+(?:tengo|uso|quiero))?|tampoco tengo)\b/.test(after);
   mentions.push({bank:bankId(m[0]),denied,chosen:!denied&&/\b(?:tengo|cuento con|uso|usare|utilizo|prefiero|mejor|pagare|pago|elijo|cambio a|cambiemos a|ahora con|me quedo con|si)\b/.test(before)&&! /\b(?:y si|que pasa si|si pago|si uso|si usara|si pagara|si tuviera|no se|aceptan|puedo pagar)\b/.test(before),query:!denied});
  }
 }
 // Resolve a denial of "esa" against the bank most recently discussed, not any product.
 const explicitlyNamed=mentions.length;
 if(!mentions.length&&/\b(?:no|tampoco)\s+(?:la\s+)?(?:tengo|uso|quiero|puedo usar)\b|\besa\s+(?:tarjeta\s+)?no\b/.test(text)&&/\besa\b|\bla tengo\b/.test(text)){
  const bank=memory.last_bank_mentioned||memory.bank;if(bank)mentions.push({bank,denied:true,chosen:false});
 }
 const denied=[...new Set(mentions.filter(m=>m.denied).map(m=>m.bank))],positive=mentions.filter(m=>!m.denied),chosen=positive.filter(m=>m.chosen).at(-1)?.bank||null;
 const noCards=/\b(?:no|tampoco)\s+(?:tengo|uso|quiero usar|quiero pagar con)\s+(?:ninguna\s+)?tarjetas?\b/.test(text)&&!explicitlyNamed;
 const refusedCard=/\bno\s+(?:(?:quiero|voy a|puedo)\s+(?:pagar|comprar(?:lo|la)?)|pago)\s+con\s+tarjeta\b/.test(text)&&!positive.length;
 const unsupported=!mentions.length&&/tarjeta|banco|pago|pagar|uso|tengo|meses|cuotas/.test(text)&&(text.match(/\b(?:produbanco|bolivariano|internacional|austro|solidario|machala|amazonas)\b/)?.[0]||text.match(/\bbanco\s+(?!es\b|usar\b|quiero\b|tengo\b)([a-z]{3,20})\b/)?.[1])||null;
 return {mentions,denied,chosen,named:positive.at(-1)?.bank||null,no_cards:noCards||refusedCard,objection:denied.length>0||noCards||refusedCard,unsupported_bank:unsupported,unsupported_chosen:!!unsupported&&/\b(?:tengo|uso|prefiero|mejor)\b/.test(text)&&! /\b(?:y si|que pasa si|si uso|si tengo|no tengo)\b/.test(text)};
}
export function buyingIntent(input){
 const text=fold(input),deferred=(/\bno\s+(?:quiero|voy a|pienso)\s+comprar\b/.test(text)&&!/\bcomprar(?:lo|la)?\s+(?:con|en|al)\b/.test(text))||/\b(?:solo|solamente)\s+(?:estoy\s+)?(?:mirando|averiguando|cotizando)\b|\b(?:lo voy a pensar|voy a pensarlo|me lo pienso|por ahora no|luego te aviso|despues te escribo)\b|\b(?:despues|luego|otro dia|mas tarde)\b.{0,30}\b(?:continu|segu|vemos|retom|compr)|\b(?:continu|segu|compr|retom)\w*\b.{0,20}\b(?:despues|luego|otro dia|mas tarde)\b/.test(text);
 const resume=!deferred&&/\b(?:sigamos|continuemos|retomemos|quiero continuar|quiero seguir|podemos seguir|quiero retomar|volvi|ya volvi)\b/.test(text);
 return {deferred,resume};
}
export function statedBudget(input){
 const text=fold(input),amount='(?:\\d{1,5}(?:[.,]\\d{1,2})?|'+Object.keys(words).join('|')+')';
 const pattern=new RegExp('(?:presupuesto(?:\\s+(?:ahora|maximo|es|de|hasta|son)){0,3}|puedo gastar|quiero gastar|no mas de|maximo de|hasta)\\s*\\$?\\s*('+amount+')(?!\\d|[.,]\\d)\\b','g');
 const matches=[...text.matchAll(pattern)];if(!matches.length)return null;
 const raw=matches.at(-1)[1],n=words[raw]||Number(raw.replace(',','.'));return n>0&&n<100000?n:null;
}
export function mergePreferences(input,proposed={},memory={}){
 const text=fold(input),next={...memory},budget=statedBudget(input);
 if(typeof next.sector==='string'&&vagueSector.test(fold(next.sector)))delete next.sector;
 if(budget!==null)next.budget=budget;
 // Newly proposed preferences must appear in the current user input, not old model prose.
 for(const [key,max]of [['brand',40],['sector',60],['need',100]])if(typeof proposed[key]==='string'&&proposed[key].length>1&&proposed[key].length<=max&&text.includes(fold(proposed[key]))){
  const value=fold(proposed[key]);
  if(key==='sector'){
   const locationCue=/\b(?:estoy|vivo|sector|barrio|zona|direccion|entrega|envio|quito|guayaquil)\b/.test(text),lastAsk=(memory.history||[]).filter(t=>t.role==='assistant').at(-1)?.text||'';
   if(vagueSector.test(value)||!locationCue&&!/sector|barrio|zona/i.test(lastAsk))continue;
  }
  if(key==='brand'&&/^(?:celular|telefono|bateria|microfono|producto|tarjeta|contado)$/.test(value))continue;
  next[key]=proposed[key];
 }
 const location=String(input).match(/\b(?:estoy|vivo|me encuentro|estamos)\s+(?:en|por)\s+([^.;?!\n]{2,70})|\b(?:sector|barrio|zona)\s*(?:es\s+|de\s+)?([^.;?!\n]{2,70})/i);
 if(location){const value=(location[1]||location[2]).split(',')[0].replace(/\s+(?:Quito|Guayaquil)$/i,'').trim();if(value.length>=2&&value.length<=60&&!vagueSector.test(fold(value))&&!/\b(?:no se|todavia|busco|quiero|presupuesto)\b/i.test(value))next.sector=value;}
 const payments=[...text.matchAll(/(?:pago|pagare|prefiero(?:\s+pagar)?|mejor|quiero pagar|usare|comprar(?:lo|la)?)\s+(?:(?:al|en|con)\s+)?(contado|tarjeta|efectivo)\b/g)].filter(m=>{
  const before=text.slice(Math.max(0,m.index-60),m.index).split(/[.;?!¿]/).at(-1);return !/(?:\bno\s+(?:quiero\s+)?)$/.test(before)&&!/(?:\bsi|cuanto|cuesta|precio)\b[^.;?!]*$/.test(before);
 });
 if(payments.length)next.payment=payments.at(-1)[1]==='efectivo'?'contado':payments.at(-1)[1];
 else if(['contado','tarjeta'].includes(proposed.payment)&&text.includes(proposed.payment)&&!/[¿?]|cuanto|cuesta|aceptan|compar|precio|intereses|planes|meses/.test(text)&&!new RegExp('\\bno(?:\\s+(?:quiero|con|en|al|pago)){0,3}\\s+'+proposed.payment).test(text)){
  const alternatives=['contado','tarjeta'].filter(p=>text.includes(p));if(alternatives.length===1)next.payment=proposed.payment;
 }
 const bank=bankIntent(input,memory),rejected=new Set(memory.rejected_banks||[]);
 for(const id of bank.denied)rejected.add(id);
 if(bank.denied.includes(next.bank)||bank.no_cards){delete next.bank;delete next.months;}
 if(bank.denied.includes(next.last_bank_mentioned)||bank.no_cards)delete next.last_bank_months;
 if(bank.chosen){if(next.bank!==bank.chosen){delete next.months;delete next.last_bank_months;}next.bank=bank.chosen;next.payment='tarjeta';rejected.delete(bank.chosen);next.payment_change_pending=false;}
 if(bank.named)next.last_bank_mentioned=bank.named;
 if(bank.named)next.last_bank_unsupported=false;
 if(bank.unsupported_bank){next.last_bank_unsupported=true;delete next.last_bank_months;if(bank.unsupported_chosen){delete next.bank;delete next.months;next.payment='tarjeta';}}
 if(bank.objection&&!bank.chosen)next.payment_change_pending=true;
 if(bank.no_cards){if(next.payment==='tarjeta')delete next.payment;next.card_declined=true;}
 if(payments.length){if(next.payment==='contado'){delete next.bank;delete next.months;delete next.last_bank_months;next.payment_change_pending=false;}else{next.card_declined=false;}}
 if(bank.chosen)next.card_declined=false;
 if(/\bquiero usar otra tarjeta\b/.test(text)&&!/\bno quiero\b/.test(text)){next.payment='tarjeta';next.card_declined=false;next.payment_change_pending=true;}
 next.rejected_banks=[...rejected].filter(id=>Object.hasOwn(bankNames,id)).slice(0,4);
 const buy=buyingIntent(input);if(buy.deferred){next.stage='consulta';next.purchase_deferred=true;}if(buy.resume||!buy.deferred&&/\bquiero comprar|\bme (?:lo|la) llevo\b/.test(text)){next.stage='consulta';next.purchase_deferred=false;}
 const deliveryChoices=[...text.matchAll(/(?:quiero|prefiero|necesito|mejor)\s+(?:la?\s+|el\s+)?(retiro(?:\s+en\s+tienda)?|retirar(?:lo|la)?(?:\s+en\s+tienda)?|(?:entrega|contraentrega)\s+en\s+quito|envio(?:s)?\s+nacional(?:es)?)\b/g)].filter(m=>!/(?:\bno\s+)$/.test(text.slice(Math.max(0,m.index-4),m.index)));
 if(deliveryChoices.length){const choice=deliveryChoices.at(-1)[1];next.delivery=/^retir/.test(choice)?'retiro':/nacional/.test(choice)?'nacional':'quito';}
 else if(['retiro','quito','nacional'].includes(proposed.delivery)&&new RegExp(proposed.delivery==='retiro'?'retir|tienda':proposed.delivery==='nacional'?'nacional|provincia':'quito','i').test(text)&&!/[¿?]|\bno\b/.test(text))next.delivery=proposed.delivery;
 return next;
}
export function redundantQuestion(question,memory={}){
 const q=fold(question);
 if(memory.payment_change_pending&&/otra.*tarjeta|otro.*pago|tarjeta.*(?:cuentas|tienes)|forma.{0,20}pago/.test(q))return false;
 return !!(memory.budget&&/presupuesto|cuanto.{0,35}(?:gastar|invertir)/.test(q)||memory.sector&&/sector|barrio|zona|en que parte/.test(q)||memory.payment&&/forma.{0,20}pago|como.{0,20}pagar|contado.{0,20}tarjeta|tarjeta.{0,20}contado/.test(q)||memory.bank&&/que banco|cual.{0,15}banco/.test(q)||memory.delivery&&/prefieres.{0,40}(?:retirar|retiro|recibir)|como.{0,20}(?:entrega|recibir|retirar)/.test(q));
}
export function asksHuman(input){
 const text=fold(input);
 if(/reclamo|me cobraron|devolucion|estafa|contrasena|cvv|cvc/.test(text))return true;
 return text.split(/\b(?:pero|aunque|sin embargo)\b|[;.!?]/).some(clause=>{
  if(/\bno\s+(?:quiero|necesito|deseo|me pases|me transfieras)\b.{0,45}\b(?:persona|humano|vendedor|asesor real)\b/.test(clause))return false;
  return /\b(?:hablar|pasame|quiero|necesito)\b.{0,35}\b(?:persona|humano|vendedor|asesor real)\b|^\s*(?:vendedor|humano|hablar con una persona)\s*$/.test(clause);
 });
}
