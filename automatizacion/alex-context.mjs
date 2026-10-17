const fold=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words={uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,quince:15,veinte:20,veinticinco:25,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,doscientos:200,trescientos:300,quinientos:500,mil:1000};
const vagueSector=/^(?:quito|guayaquil|ecuador|celular|telefono|casa|domicilio|tarjeta|contado|bateria|microfono|producto)$/;
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
 const deliveryChoices=[...text.matchAll(/(?:quiero|prefiero|necesito|mejor)\s+(?:el\s+)?(retiro(?:\s+en\s+tienda)?|retirar(?:lo|la)?(?:\s+en\s+tienda)?|entrega\s+en\s+quito|envio\s+nacional)\b/g)].filter(m=>!/(?:\bno\s+)$/.test(text.slice(Math.max(0,m.index-4),m.index)));
 if(deliveryChoices.length){const choice=deliveryChoices.at(-1)[1];next.delivery=/^retir/.test(choice)?'retiro':/nacional/.test(choice)?'nacional':'quito';}
 else if(['retiro','quito','nacional'].includes(proposed.delivery)&&new RegExp(proposed.delivery==='retiro'?'retir|tienda':proposed.delivery==='nacional'?'nacional|provincia':'quito','i').test(text)&&!/[¿?]|\bno\b/.test(text))next.delivery=proposed.delivery;
 return next;
}
export function redundantQuestion(question,memory={}){
 const q=fold(question);
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
