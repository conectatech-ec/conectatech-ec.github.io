/* Prioridad de presentación. No modifica inventario, publicaciones ni fichas.
 * Referencia del propietario: importacion/prioridades-comerciales.json. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CONECTATECH_COMERCIAL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const families={Telefonos:'celulares',Tablets:'tablets',Monitores:'pantallas',Discos:'almacenamiento',Flash:'memorias',Tarjetas:'memorias',Relojes:'smartwatch',Audifonos:'audio',Parlantes:'audio',Barras:'audio',Powerbanks:'energia',Cargadores:'energia',Cubos:'energia',Teclados:'computacion',Mouse:'computacion',Microfonos:'creacion',Tripodes:'creacion',Capturadoras:'creacion',Proyectores:'entretenimiento',Alexa:'entretenimiento',Palancas:'entretenimiento'};
  const family=p=>p.categoriaComercial==='Fotografía y Creación de Contenido'?'creacion':p.categoriaComercial==='Cargadores y Energía'?'energia':p.category==='Tv'?(/^TELE/.test(p.sku)?'pantallas':'entretenimiento'):(families[p.category]||'complementos');
  const order=['celulares','tablets','pantallas','almacenamiento','smartwatch','audio','energia','computacion','creacion','entretenimiento','memorias','complementos'];
  const pattern=['celulares','celulares','tablets','pantallas','almacenamiento','smartwatch','audio','celulares','computacion','energia','smartwatch','audio','celulares','tablets','pantallas','almacenamiento','smartwatch','audio','celulares','computacion','energia','smartwatch','audio','celulares'];
  const protagonist=p=>!['memorias','complementos'].includes(family(p));
  function compare(a,b){
    return Number(b.role==='CAPTADOR')-Number(a.role==='CAPTADOR')||Number(b.priority==='ALTA')-Number(a.priority==='ALTA')||(Number(b.stock)||0)-(Number(a.stock)||0)||b.promo-a.promo||a.sku.localeCompare(b.sku,'es',{numeric:true});
  }
  function ordenar(list,eligible,pages=3){
    const queues=new Map(order.map(f=>[f,[]]));
    for(const p of list){if(eligible(p)&&family(p)!=='complementos')queues.get(family(p)).push(p)}
    for(const q of queues.values())q.sort(compare);
    const take=f=>queues.get(f)?.shift(),result=[],quota={};pattern.forEach(f=>quota[f]=(quota[f]||0)+1);
    for(let page=0;page<Math.max(0,Math.min(3,pages));page++){
      const used={};
      for(let slot=0;slot<pattern.length;slot++){
        const f=pattern[slot];let p=take(f)||(f==='almacenamiento'?take('memorias'):null);
        if(!p){
          // Reserva los puestos de las familias todavía presentes. Las familias
          // escasas se completan con otras líneas, sin llenar una página de relojes.
          const remaining={};pattern.slice(slot+1).forEach(g=>remaining[g]=(remaining[g]||0)+1);
          let alternatives=order.filter(g=>queues.get(g).length&&(used[g]||0)+(remaining[g]||0)<(quota[g]||2));
          if(!alternatives.length)alternatives=order.filter(g=>queues.get(g).length).sort((a,b)=>(used[a]||0)/(quota[a]||2)-(used[b]||0)/(quota[b]||2));
          if(alternatives.length)p=take(alternatives[0]);
        }
        if(p){result.push(p);const g=family(p);used[g]=(used[g]||0)+1}
      }
    }
    // Después de la entrada comercial se conserva el orden recibido del resto.
    const used=new Set(result.map(p=>p.sku));return result.concat(list.filter(p=>!used.has(p.sku)));
  }
  return Object.freeze({familia:family,protagonista:protagonist,ordenar});
});
