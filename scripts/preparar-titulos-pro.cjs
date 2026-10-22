'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'importacion/pilotos/titulos-pro-20.json');
const data=JSON.parse(fs.readFileSync(file));
if(typeof data.activo!=='boolean'||!data.productos||Object.keys(data.productos).length>20)throw Error('El piloto permite hasta20SKU explícitos; no ampliar masivamente.');
for(const [sku,e] of Object.entries(data.productos))if(!/^[A-Z0-9]+$/.test(sku)||!e.titulo||!e.subtitulo||!e.fuentes?.length)throw Error('Ficha piloto incompleta: '+sku);
// La corrección no puede volver a quitar la identidad aprobada del título.
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const seen=new Set();
for(const [sku,e] of Object.entries(data.productos)){
 if(!e.identidadObligatoria?.length||e.identidadObligatoria.some(v=>!norm(e.titulo).includes(norm(v))))throw Error('El título pierde identidad verificada: '+sku);
 if(seen.has(norm(e.titulo)))throw Error('Título duplicado: '+sku);seen.add(norm(e.titulo));
 if(e.estadoEnriquecimiento?.startsWith('PENDIENTE')&&e.titulo!==e.tituloAnterior)throw Error('Sin datos fiables, conservar título actual: '+sku);
 if(e.subtitulo.split('·').some(v=>norm(v).length>=4&&norm(e.titulo).includes(norm(v))))throw Error('Subtítulo repite el título: '+sku);
}
fs.writeFileSync(path.join(root,'assets/titulos-pro-piloto.js'),'window.CONECTATECH_TITULOS_PRO_DATOS='+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
console.log('Piloto preparado: '+Object.keys(data.productos).length+' SKU; activo='+data.activo);
