/* Presentación opcional: conserva los objetos de producto y sus datos originales. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CONECTATECH_TITULOS_PRO=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const config=()=>typeof window!=='undefined'?window.CONECTATECH_TITULOS_PRO_DATOS:null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=v=>esc(v).replace(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g,'<span class="ct-pro-token">$&</span>');
  function entry(p,c=config()){
    if(!c?.activo)return null;
    if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('titulos')==='original')return null;
    if((c.excluirPrefijos||[]).some(prefix=>p.sku.startsWith(prefix)))return null;
    const e=c.productos?.[p.sku];return e&&typeof e.titulo==='string'&&e.titulo.trim()&&typeof e.subtitulo==='string'?e:null;
  }
  return {entry,verifiedDate(p){const e=entry(p),v=e?.publicacionVerificada||e?.publicacionAnterior;return v?.estado==='VERIFICADO_HTTP_CHROMIUM'&&v.sha256Informe&&Number.isFinite(Date.parse(v.fecha))?v.fecha:'';},conditionText(p){return entry(p)?.condicionTarjeta||'';},searchText(p){const e=entry(p);return e?[e.nombre593,e.titulo,e.subtitulo,e.marca,e.modelo].join(' '):'';},
    nameHTML(p,href){const e=entry(p);return e?`<a class="name product-link ct-pro-title" href="${esc(href)}" title="${esc(p.name)}">${text(e.titulo)}</a>${e.subtitulo.trim()?`<div class="ct-pro-subtitle">${text(e.subtitulo)}</div>`:''}`:null;}};
});
