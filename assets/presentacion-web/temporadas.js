/* Calendario de presentación: sólo ambientación, nunca descuentos o condiciones. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CONECTATECH_TEMPORADAS=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function fechaLocal(value=new Date(),zona='America/Guayaquil'){
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
  }
  function blackFriday(year){
    const d=new Date(Date.UTC(year,10,30));
    d.setUTCDate(30-(d.getUTCDay()-5+7)%7);
    return d.toISOString().slice(0,10);
  }
  function resolver(config,value=new Date(),vistaPrevia){
    const fecha=fechaLocal(value,config.zonaHoraria),temas=config.temas||{};
    let id=vistaPrevia||config.tema||'automatico';
    if(id==='automatico'){
      const md=fecha.slice(5);
      id=(config.calendario||[]).find(r=>r.desde<=r.hasta?md>=r.desde&&md<=r.hasta:md>=r.desde||md<=r.hasta)?.tema||'identidad';
      if(config.blackFridayAutomatico){
        const start=blackFriday(Number(fecha.slice(0,4))),end=new Date(start+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+2);
        if(fecha>=start&&fecha<=end.toISOString().slice(0,10))id='black-friday';
      }
    }
    if(!temas[id])id='identidad';
    return {id,fecha,...temas[id]};
  }
  return {fechaLocal,blackFriday,resolver};
});
