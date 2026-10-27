const assert=require('node:assert/strict');
module.exports=async function verificarBusquedaComercial(page,base){
 await page.goto(base+'/');
 const results=[];
 const cables=['CABL110','CABL128','CABL129','CABL146','CABL147'];
 for(const query of ['cable Andowl','Andowl cable','CABLE ANDOWL','cables Andowl']){
  await page.locator('#q').fill(query);
  const visible=await page.locator('#grid article').evaluateAll(cs=>cs.map(c=>c.dataset.sku));
  assert.deepEqual(visible.slice(0,5).sort(),cables,query+' debe priorizar los cinco cables de esa marca');
  assert.equal(await page.locator('#catalogSort option[value="recientes"]').textContent(),'Relevancia y más recientes');
  results.push({consulta:query,primeros:visible.slice(0,5),coincidencias:await page.evaluate(q=>products.filter(p=>matchesSearch(p,q)).length,query)});
 }
 for(const [query,sku] of [['linterna Yemao','LINT001'],['cargador Jiabao','CARG007'],['Q-HD613','CABL128'],['QHD613','CABL128'],['LINT001','LINT001'],['CARG007','CARG007']]){
  await page.locator('#q').fill(query);
  assert(await page.locator('#grid [data-sku="'+sku+'"]').count(),query+' debe encontrar '+sku);
  results.push({consulta:query,encontrado:sku});
 }
 await page.locator('#q').fill('Andowl');
 const found=await page.evaluate(()=>products.filter(p=>matchesSearch(p,'Andowl')).map(p=>p.sku));
 for(const sku of ['ADAP051','TVBO006',...cables,'CAMA010','INVE002','LECT004','TECL019','TIMB001'])assert(found.includes(sku),sku+' debe encontrarse por marca');
 const controls=await page.evaluate(()=>{
  // A brand stored exclusively in technical specs must remain searchable.
  const sample={...products.find(p=>p.sku==='CABL128'),sku:'QAESPECIFICACION',name:'Cable USB-C a HDMI de 2 m',searchTerms:'',specs:{'Marca de referencia':'Andowl'}};
  const specOnly=matchesSearch(sample,'cable Andowl')&&searchRelevance(sample,'cable Andowl')>=120;
  const previousQuery=document.getElementById('q').value,previousSort=sortSelector.value;
  const tests=[];
  for(const query of ['','cable Andowl'])for(const mode of ['nombre','precio-asc','precio-desc','catalogo',...(query?[]:['recientes','fotos'])]){
   document.getElementById('q').value=query;sortSelector.value=mode;
   const list=products.filter(p=>matchesSearch(p,query));
   const expected=list.slice().sort((a,b)=>{
    const available=Number(availabilityFor(b).commercial_eligible)-Number(availabilityFor(a).commercial_eligible);if(available)return available;
    const photo=Number(hasPublishedImage(b))-Number(hasPublishedImage(a));if(photo)return photo;
    if(mode==='nombre')return a.name.localeCompare(b.name,'es',{sensitivity:'base',numeric:true});
    if(mode==='precio-asc')return a.promo-b.promo;
    if(mode==='precio-desc')return b.promo-a.promo;
    if(mode==='catalogo')return 0;
    return Number(noveltyRank(a)===2)-Number(noveltyRank(b)===2)||updatedTime(b)-updatedTime(a)||noveltyRank(a)-noveltyRank(b);
   }).map(p=>p.sku);
   tests.push({consulta:query,modo:mode,igual:JSON.stringify(expected)===JSON.stringify(orderedProducts(list.slice()).map(p=>p.sku))});
  }
  document.getElementById('q').value=previousQuery;sortSelector.value=previousSort;render();return {specOnly,tests};
 });
 assert(controls.specOnly,'marca sólo en especificaciones debe ser buscable y relevante');
 assert(controls.tests.every(t=>t.igual),'ordenamientos manuales y orden sin búsqueda deben conservarse');
 await page.locator('#q').fill('');
 assert.equal(await page.locator('#catalogSort option[value="recientes"]').textContent(),'Nuevos y actualizados');
 return {consultas:results,andowlEncontrados:found,marcaSoloEnEspecificaciones:true,ordenamientosConservados:controls.tests};
};
