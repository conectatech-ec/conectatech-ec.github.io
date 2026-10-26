/* Selección comercial diaria. Pura y determinista: no escribe inventario ni fechas. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CONECTATECH_ROTACION=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=86400000,EPOCH=Date.UTC(2026,0,1)/DAY;
  function hash(value){let n=2166136261;for(let i=0;i<value.length;i++){n^=value.charCodeAt(i);n=Math.imul(n,16777619)}n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);return (n^(n>>>16))>>>0}
  const limit=(n,fallback)=>Math.max(0,Math.min(5,Number.isInteger(n)?n:fallback));
  const band=p=>p.promo<=15?'accesible':p.promo<=60?'intermedio':'superior';
  const group=p=>p.commercialCategory||p.category||'Tecnología';
  let memoKey='',memoDay=EPOCH-1,memoHistory=[],memoPlans=new Map();
  const copy=plan=>({fecha:plan.fecha,vitrina:plan.vitrina.slice(),destacados:plan.destacados.slice()});
  function resolver(candidatos,config,fecha){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(Date.parse(fecha+'T00:00:00Z'))||new Date(fecha+'T00:00:00Z').toISOString().slice(0,10)!==fecha)throw Error('Fecha local inválida');
    const options=config||{},counts=[limit(options.cantidadVitrina,5),limit(options.cantidadDestacados,5)],cooldown=Math.max(0,Math.min(30,Number.isInteger(options.evitarRepetirDias)?options.evitarRepetirDias:7));
    const pool=[...new Map(candidatos.filter(p=>p&&typeof p.sku==='string'&&Number.isFinite(p.promo)&&p.promo>0).map(p=>[p.sku,p])).values()].sort((a,b)=>a.sku<b.sku?-1:a.sku>b.sku?1:0),bySku=new Map(pool.map(p=>[p.sku,p]));
    const pinned=new Set(),pins=[options.fijadosVitrina||[],options.fijadosDestacados||[]].map((list,i)=>{const chosen=[];for(const sku of list){if(chosen.length>=counts[i])break;if(bySku.has(sku)&&!pinned.has(sku)){chosen.push(sku);pinned.add(sku)}}return chosen});
    const end=Date.parse(fecha+'T00:00:00Z')/DAY,key=JSON.stringify([counts,cooldown,pins,options.categoriasApertura||[],pool.map(p=>[p.sku,group(p),p.promo,p.actualizadoEn||''])]);
    if(key!==memoKey||end<EPOCH){memoKey=key;memoDay=Math.min(EPOCH,end)-1;memoHistory=[];memoPlans=new Map()}
    if(memoPlans.has(end))return copy(memoPlans.get(end));
    const history=memoHistory.map(row=>row.slice()),publication=new Map(pool.map(p=>[p.sku,Date.parse(p.actualizadoEn)||0]));let result;
    // Reproduce el mismo historial desde un ancla común. No depende del navegador,
    // almacenamiento local, hora de visita, jobs, ni orden del catálogo recibido.
    for(let day=memoDay+1;day<=end;day++){
      let retained=history.slice(-cooldown),blocked=new Set(retained.flat());
      while(pool.filter(p=>!pinned.has(p.sku)&&!blocked.has(p.sku)).length<Math.min(pool.length-pinned.size,counts[0]+counts[1]-pinned.size)&&retained.length){retained=retained.slice(1);blocked=new Set(retained.flat())}
      const scores=new Map(pool.map(p=>{const age=day*DAY-publication.get(p.sku);return [p.sku,hash(day+':'+p.sku)/4294967296+(age>=0&&age<=21*DAY?.12:0)]})),used=new Set(pinned),allGroups=new Set(),picked=[];
      const opening=(options.categoriasApertura||[]).filter(category=>pool.some(p=>group(p)===category&&!blocked.has(p.sku)&&!pinned.has(p.sku)));
      for(let section=0;section<2;section++){
        const chosen=pins[section].map(s=>bySku.get(s)),groups=new Set(chosen.map(group)),bands=new Set(chosen.map(band));chosen.forEach(p=>allGroups.add(group(p)));
        while(chosen.length<counts[section]){
          let best=null,score=-Infinity;
          for(const p of pool){if(used.has(p.sku)||blocked.has(p.sku))continue;const value=(!chosen.length&&opening.length&&group(p)===opening[(day+section*2)%opening.length]?5:0)+scores.get(p.sku)+(!groups.has(group(p))?2:0)+(!bands.has(band(p))?.5:0)+(!allGroups.has(group(p))?.2:0);if(value>score){score=value;best=p}}
          if(!best)break;chosen.push(best);used.add(best.sku);groups.add(group(best));bands.add(band(best));allGroups.add(group(best));
        }
        picked.push(chosen.map(p=>p.sku));
      }
      result={fecha:new Date(day*DAY).toISOString().slice(0,10),vitrina:picked[0],destacados:picked[1]};memoPlans.set(day,result);history.push(picked.flat());if(history.length>cooldown)history.shift();
    }
    memoDay=end;memoHistory=history;return copy(result);
  }
  return Object.freeze({resolver});
});
