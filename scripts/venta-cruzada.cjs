'use strict';
// Pilot: no touch pricing, stock or 593. Never infer case/glass fit from "Android".
const RULES={
 generic:[
  ['MICA006','Mica','Confirmar medida exacta para este modelo'],
  ['ESTU050','Estuche','Confirmar variante exacta para este modelo'],
  ['CARG053','Cargador','Confirmar puerto y potencia'],
  ['CABL025','Cable','Confirmar conexión USB-C']
 ],
 samsungA17:[
  ['MICA006','Mica','Confirmar medida exacta para este modelo'],
  ['ESTU050','Estuche','Confirmar variante exacta para este modelo'],
  ['CARG037','Cargador con cable','Confirmar potencia y compatibilidad']
 ]
};
const PHONE_BRANDS=/\b(SAMSUNG|GALAXY|HONOR|REDMI|POCO|ZTE|NUBIA|INFINIX|TECNO)\b/i;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n).toFixed(2);
function sugerencias(phone,products,slugs){
 if(!phone||!/^TELF/.test(phone.sku)||!(phone.stock>0)||!PHONE_BRANDS.test(phone.name))return [];
 const rules=phone.sku==='TELF011'||phone.sku==='TELF012'?RULES.samsungA17:RULES.generic;
 const bySku=new Map(products.map(p=>[p.sku,p]));
 return rules.flatMap(([sku,kind,warning])=>{
  const p=bySku.get(sku),slug=slugs[sku];
  if(!p||!slug||!/^[a-z0-9-]+$/.test(slug)||!(p.stock>0)||!(p.promo>0)||!(p.pvp>0))return [];
  const photo=/^\/imagenes\/[a-z0-9_\/.-]+\.(?:webp|jpg|jpeg|png)$/i.test(p.imageUrl||'')?p.imageUrl:'';
  return [{sku:p.sku,name:p.name,kind,warning,promo:p.promo,pvp:p.pvp,photo,href:'/productos/'+slug+'/'}];
 }).slice(0,4);
}
const css="<style>\n.ct-vc{margin:24px 0;padding:22px;background:white;border:1px solid #dfe8f0;border-radius:20px;color:#17334e}\n.ct-vc h2{font:800 23px/1.2 system-ui;margin:0 0 6px}.ct-vc-intro{font:14px/1.5 system-ui;color:#506277;margin:0 0 15px}\n.ct-vc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(156px,1fr));gap:12px}\n.ct-vc-card{border:1px solid #dfebf1;border-radius:14px;padding:12px;background:#fbfdff;display:flex;flex-direction:column;gap:7px}\n.ct-vc-image{height:110px;display:flex;align-items:center;justify-content:center;background:white;border-radius:10px;overflow:hidden}\n.ct-vc-image img{max-height:100%;max-width:100%;object-fit:contain}.ct-vc-empty{font:12px system-ui;color:#77879a}\n.ct-vc-name{font:700 13px/1.35 system-ui;color:#143f70;text-decoration:none}.ct-vc-name:hover{text-decoration:underline}\n.ct-vc-type{font:800 11px system-ui;color:#237b50;text-transform:uppercase}.ct-vc-promo{font:800 19px system-ui;color:#08753d}\n.ct-vc-pvp{font:12px system-ui;color:#667488}.ct-vc-note{font:12px/1.3 system-ui;color:#765628;margin-top:auto}\n.ct-vc-select{display:flex;align-items:center;gap:6px;font:700 13px system-ui;color:#203c58;cursor:pointer}\n.ct-vc-action{margin-top:16px;background:#08753d;color:white;border:0;border-radius:12px;padding:13px 18px;font:800 14px system-ui;cursor:pointer}\n.ct-vc-action:disabled{opacity:.5;cursor:not-allowed}.ct-vc-disclaimer{font:12px/1.5 system-ui;color:#596c7e;margin:10px 0 0}\n@media(max-width:520px){.ct-vc{padding:14px}.ct-vc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ct-vc-card{padding:9px}.ct-vc-image{height:95px}}\n</style>";
const js="<script>\n(function(){\n var box=document.querySelector('[data-ct-vc]');if(!box)return;\n var btn=box.querySelector('[data-ct-vc-action]');\n var checks=[].slice.call(box.querySelectorAll('input[data-vc-sku]'));\n checks.forEach(function(c){c.addEventListener('change',function(){btn.disabled=!checks.some(function(x){return x.checked;});});});\n btn.addEventListener('click',function(){\n  var items=checks.filter(function(x){return x.checked;}).map(function(x){return '- '+x.getAttribute('data-vc-nombre')+' ('+x.getAttribute('data-vc-sku')+')';});\n  if(!items.length)return;\n  var msg='Hola CONECTATECH, deseo consultar el teléfono '+box.getAttribute('data-ct-producto')+' ('+box.getAttribute('data-ct-sku')+') y estos accesorios:\\n'+items.join('\\n')+'\\nConfirmen modelo compatible, variantes, precios y disponibilidad.';\n  window.open('https://wa.me/593998576759?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');\n });\n})();\n</script>";

function inyectar(html,phone,products,slugs){
 const items=sugerencias(phone,products,slugs);
 if(!items.length||html.includes('data-ct-vc'))return html;
 const cards=items.map(p=>'<div class="ct-vc-card"><div class="ct-vc-image">'+
  (p.photo?'<img src="'+esc(p.photo)+'" loading="lazy" alt="'+esc(p.name)+'">':'<span class="ct-vc-empty">Foto en preparación</span>')+
  '</div><span class="ct-vc-type">'+esc(p.kind)+'</span><a class="ct-vc-name" href="'+esc(p.href)+'">'+esc(p.name)+'</a>'+
  '<span class="ct-vc-promo">Promo contado '+money(p.promo)+'</span><span class="ct-vc-pvp">PVP '+money(p.pvp)+'</span>'+
  '<span class="ct-vc-note">'+esc(p.warning)+'</span><label class="ct-vc-select">'+
  '<input type="checkbox" data-vc-sku="'+esc(p.sku)+'" data-vc-nombre="'+esc(p.name)+'"> Añadir a consulta</label></div>').join('');
 const section='<section class="ct-vc" data-ct-vc data-ct-sku="'+esc(phone.sku)+'" data-ct-producto="'+esc(phone.name)+'">'+
  '<h2>Completa tu compra</h2><p class="ct-vc-intro">Explora accesorios para consultar junto con tu teléfono.</p>'+
  '<div class="ct-vc-grid">'+cards+'</div><button class="ct-vc-action" data-ct-vc-action type="button" disabled>Consultar accesorios seleccionados</button>'+
  '<p class="ct-vc-disclaimer">Confirmaremos el modelo y variante antes de vender. Precios y existencias sujetos al corte de inventario.</p></section>';
 let out=html.replace('</head>',css+'</head>');
 if(out.includes('<footer'))out=out.replace('<footer',section+'<footer');
 else out=out.replace('</article>',section+'</article>');
 return out.replace('</body>',js+'</body>');
}
module.exports={sugerencias,inyectar};
