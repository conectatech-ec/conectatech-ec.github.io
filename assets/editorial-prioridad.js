/* Últimos cambios reales primero. Conserva la rotación y presentación como respaldo. */
(function(root){
  'use strict';
  const rotation=root.CONECTATECH_ROTACION;
  if(!rotation||typeof rotation.resolver!=='function')return;
  root.CONECTATECH_ROTACION={...rotation,resolver(candidates,config,date){
    const plan=rotation.resolver(candidates,config,date);
    const recent=[...new Map(candidates.filter(p=>p&&Number.isFinite(Date.parse(p.actualizadoEn))).map(p=>[p.sku,p])).values()]
      .sort((a,b)=>Date.parse(b.actualizadoEn)-Date.parse(a.actualizadoEn)).map(p=>p.sku);
    const ordered=[...new Set([...recent,...plan.vitrina,...plan.destacados])];
    const count=plan.vitrina.length;
    return {...plan,vitrina:ordered.slice(0,count),destacados:ordered.slice(count,count+plan.destacados.length)};
  }};
})(window);
