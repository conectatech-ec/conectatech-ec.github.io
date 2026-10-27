/* Mejora incremental de la portada existente. No escribe ni modifica productos. */
(function(){
  'use strict';
  const config=window.CONECTATECH_PRESENTACION,calendar=window.CONECTATECH_TEMPORADAS;
  if(!config||!calendar||typeof products==='undefined')return;
  if(window.CONECTATECH_PRESENTACION_ESTADO?.version===3)return;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const preview=location.pathname.startsWith('/revision/presentacion-web-v2/');
  const requested=preview?new URLSearchParams(location.search).get('temporada'):null;
  const state={version:3,tema:null,productos:[],pausado:false};
  window.CONECTATECH_PRESENTACION_ESTADO=state;
  const mark=()=>`<svg class="pw-brand-art" viewBox="330 70 920 130" role="img" aria-label="CONECTATECH, rótulo original aprobado"><image href="${escape(config.marca)}" width="1881" height="291"/></svg>`;
  const brand=document.querySelector('header .brand');
  if(brand&&!brand.querySelector('.pw-brand-art')){
    const original=document.createElement('span');original.className='pw-sr-only';
    while(brand.firstChild)original.appendChild(brand.firstChild);
    brand.appendChild(original);brand.insertAdjacentHTML('beforeend',mark());
    brand.insertAdjacentHTML('beforeend','<span class="pw-brand-values" aria-hidden="true">TECNOLOGÍA <i>·</i> CONECTIVIDAD <i>·</i> INNOVACIÓN</span>');
  }
  const footerBrand=document.querySelector('footer>b');
  if(footerBrand)footerBrand.innerHTML=mark();
  const brandRow=document.querySelector('header .brandrow');
  if(brandRow)brandRow.insertAdjacentHTML('beforeend','<img class="pw-logo-season" src="/assets/presentacion-web/halloween-calabaza-corona.webp?v=7" alt="" aria-hidden="true" width="160" height="160" decoding="async">');
  const presentationHeader=document.querySelector('header');
  const syncHeaderOffset=()=>{if(presentationHeader)document.documentElement.style.setProperty('--pw-header-height',Math.ceil(presentationHeader.getBoundingClientRect().height)+'px')};
  if(presentationHeader&&typeof ResizeObserver!=='undefined')new ResizeObserver(syncHeaderOffset).observe(presentationHeader);
  else window.addEventListener('resize',syncHeaderOffset,{passive:true});
  document.addEventListener('conectatech:temporada',syncHeaderOffset);
  function applyTheme(){
    const theme=calendar.resolver(config,new Date(),requested);state.tema=theme.id;
    document.body.dataset.ctTemporada=theme.id;
    document.documentElement.style.setProperty('--pw-season',theme.acento);
    document.documentElement.style.setProperty('--pw-season-secondary',theme.secundario);
    document.querySelectorAll('[data-pw-season-name]').forEach(el=>el.textContent=theme.nombre);
    document.dispatchEvent(new CustomEvent('conectatech:temporada',{detail:theme}));
  }
  const hero=document.querySelector('.ct-hero'),showcase=hero?.querySelector('.ct-hero-showcase');
  if(hero){
    hero.classList.add('pw-hero');
    hero.insertAdjacentHTML('afterbegin','<div class="pw-season-decoration" aria-hidden="true"><img class="pw-luna-iluminada" src="/assets/presentacion-web/halloween-luna-luminosa.svg?v=6" alt="" aria-hidden="true" width="220" height="220" decoding="async"><span class="pw-moon"></span><svg class="pw-bats" viewBox="0 0 160 70"><path d="M0 19Q18 11 26 2L31 11L36 2Q45 12 62 19Q46 17 38 30L31 25L24 30Q17 17 0 19M89 46Q107 36 116 27L121 36L126 27Q135 38 155 46Q137 43 128 57L121 51L113 57Q105 43 89 46"/></svg><svg class="pw-web" viewBox="0 0 110 110"><path d="M0 0L110 12M0 0L90 50M0 0L50 90M0 0L12 110M28 3Q27 14 23 13Q16 27 13 23Q8 34 3 28M53 6Q49 26 44 24Q33 47 25 44Q16 66 6 53M79 9Q72 38 64 35Q48 68 36 64Q23 95 9 79M103 11Q95 50 85 47Q65 90 48 85Q31 120 11 103" fill="none" stroke="currentColor" stroke-width="1"/></svg><span class="pw-stars">✦ · ✧</span></div>');
  }
  const rejectedImages=new Set(),bySku=new Map(products.map(p=>[p.sku,p]));
  const imageSource=p=>window.CONECTATECH_CATALOGO?.productos?.[p.sku]?.imagen?.src||p.imageUrl||'';
  const eligible=p=>Boolean(p&&!rejectedImages.has(p.sku)&&window.CONECTATECH_AVAILABILITY.forProduct(p).commercial_eligible&&imageSource(p).startsWith('/imagenes/')&&seoPages[p.sku]&&Number.isFinite(p.promo)&&p.promo>0&&Number.isFinite(p.pvp)&&p.pvp>0);
  let cleanupShowcase=()=>{},selectionKey='';
  function renderShowcase(selected){
    cleanupShowcase();cleanupShowcase=()=>{};
    if(!showcase)return;
    showcase.hidden=!selected.length;showcase.style.display=selected.length?'':'none';hero?.classList.toggle('pw-no-products',!selected.length);
    if(!selected.length){showcase.innerHTML='';state.productos=[];return}
    const controller=new AbortController(),on=(el,event,handler,options={})=>el.addEventListener(event,handler,{...options,signal:controller.signal});
    state.productos=selected.map(p=>p.sku);showcase.classList.add('pw-showcase');
    const titles=p=>{
      const e=window.CONECTATECH_TITULOS_PRO?.entry(p),condition=window.CONECTATECH_TITULOS_PRO?.conditionText(p)||'';
      return `<a class="pw-slide-title" href="${escape(productHref(p))}">${escape(e?.titulo||p.name)}</a>${e?.subtitulo?`<p class="pw-slide-subtitle">${escape(e.subtitulo)}</p>`:''}${condition?`<p class="pw-slide-condition">${escape(condition)}</p>`:''}`;
    };
    showcase.innerHTML=`<div class="pw-showcase-heading"><span>SELECCIÓN CONECTATECH</span><span class="pw-slide-counter" aria-hidden="true">01 / ${String(selected.length).padStart(2,'0')}</span></div><div class="pw-carousel" role="region" aria-roledescription="carrusel" aria-label="Productos seleccionados CONECTATECH">${selected.map((p,i)=>`<article class="pw-slide${i===0?' is-active':''}" data-sku="${escape(p.sku)}" aria-roledescription="diapositiva" aria-label="${i+1} de ${selected.length}" aria-hidden="${i!==0}"${i?' inert':''}><a class="pw-slide-photo" href="${escape(productHref(p))}" aria-label="Ver ${escape(p.name)}">${productImage(p,true)}</a><div class="pw-slide-copy">${statusHTML(availabilityFor(p))}${titles(p)}<div class="pw-slide-commerce"><div class="pw-slide-prices"><span>PROMO CONTADO</span><strong>${money(p.promo)}</strong><small>PVP ${money(p.pvp)}</small></div><div class="pw-slide-actions"><a class="pw-slide-buy" href="${escape(availabilityContact(p))}" target="_blank" rel="noopener" aria-label="Comprar ${escape(p.name)} por WhatsApp">Comprar por WhatsApp</a><a class="pw-slide-link" href="${escape(productHref(p))}">Ver ficha del producto <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 12L12 4M4 4H12V12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></a></div></div></div></article>`).join('')}</div><div class="pw-carousel-controls"><button type="button" data-pw-prev aria-label="Producto anterior">←</button><div class="pw-carousel-dots">${selected.map((p,i)=>`<button type="button" data-pw-slide="${i}" aria-label="Mostrar ${escape(p.name)}" aria-pressed="${i===0}"><span></span></button>`).join('')}</div><button type="button" data-pw-next aria-label="Producto siguiente">→</button><button type="button" data-pw-play aria-pressed="false" aria-label="Pausar transición automática">Ⅱ</button></div><span class="pw-sr-only" role="status" data-pw-announcement></span>`;
    showcase.querySelector('.pw-carousel').insertAdjacentHTML('beforeend','<svg class="pw-tech-effect" viewBox="0 0 600 285" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 40V3H93M507 3H597V40M597 245V282H507M93 282H3V245"/><path class="pw-tech-trace" d="M12 279H588"/></svg>');
    const slides=[...showcase.querySelectorAll('.pw-slide')],dots=[...showcase.querySelectorAll('[data-pw-slide]')],reduce=matchMedia('(prefers-reduced-motion: reduce)');
    showcase.querySelectorAll('.pw-slide-photo img').forEach(im=>{im.loading='eager';im.decoding='async'});
    let current=0,timer,techTimer,manualPause=reduce.matches,hover=false,focus=false,transitioning=false,touchStart=null;
    function schedule(){
      clearTimeout(timer);if(controller.signal.aborted)return;state.pausado=manualPause||hover||focus||document.hidden||slides.length<2;
      if(!state.pausado)timer=setTimeout(()=>go(current+1,false),Math.max(2400,Number(config.intervaloMs)||3000));
    }
    async function go(n,manual){
      if(transitioning||slides.length<2)return;
      n=(n+slides.length)%slides.length;if(n===current){schedule();return}
      transitioning=true;
      const next=slides[n],image=next.querySelector('img');
      if(image){try{await image.decode()}catch(_){if(!image.naturalWidth){transitioning=false;schedule();return}}}
      if(controller.signal.aborted)return;
      slides[current].classList.remove('is-active');slides[current].setAttribute('aria-hidden','true');slides[current].inert=true;
      current=n;next.classList.add('is-active');next.setAttribute('aria-hidden','false');next.inert=false;
      clearTimeout(techTimer);showcase.classList.remove('pw-tech-flash');
      if(config.efectoTecnologico!==false&&!reduce.matches)techTimer=setTimeout(()=>{if(!reduce.matches&&!document.hidden)showcase.classList.add('pw-tech-flash')},420);
      dots.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===current)));
      showcase.querySelector('.pw-slide-counter').textContent=`${String(current+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
      if(manual)showcase.querySelector('[data-pw-announcement]').textContent=`Producto ${current+1} de ${slides.length}: ${next.querySelector('.pw-slide-title').textContent}`;
      transitioning=false;schedule();
    }
    const play=showcase.querySelector('[data-pw-play]');
    function playLabel(){play.textContent=manualPause?'▶':'Ⅱ';play.setAttribute('aria-pressed',String(manualPause));play.setAttribute('aria-label',manualPause?'Reanudar transición automática':'Pausar transición automática')}
    showcase.querySelector('[data-pw-prev]').onclick=()=>go(current-1,true);
    showcase.querySelector('[data-pw-next]').onclick=()=>go(current+1,true);
    dots.forEach(b=>b.onclick=()=>go(Number(b.dataset.pwSlide),true));
    play.onclick=()=>{manualPause=!manualPause;focus=false;playLabel();schedule()};
    on(showcase,'pointerenter',e=>{if(e.pointerType!=='touch'){hover=true;schedule()}});
    on(showcase,'pointerleave',()=>{hover=false;schedule()});
    on(showcase,'focusin',e=>{focus=e.target!==play;schedule()});
    on(showcase,'focusout',()=>{setTimeout(()=>{focus=showcase.contains(document.activeElement)&&document.activeElement!==play;schedule()},0)});
    on(showcase,'keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(current+(e.key==='ArrowRight'?1:-1),true)}});
    on(showcase,'pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest('.pw-slide')){manualPause=true;playLabel();schedule()}});
    on(showcase,'touchstart',e=>{touchStart={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY}},{passive:true});
    on(showcase,'touchend',e=>{if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))go(current+(dx<0?1:-1),true)},{passive:true});
    on(document,'visibilitychange',schedule);
    on(reduce,'change',e=>{if(e.matches){manualPause=true;clearTimeout(techTimer);showcase.classList.remove('pw-tech-flash')}playLabel();schedule()});
    const carousel=showcase.querySelector('.pw-carousel');let sizeFrame;
    function fitCarousel(){
      if(controller.signal.aborted)return;
      const slide=slides[0],style=getComputedStyle(slide),stacked=matchMedia('(max-width:600px)').matches,padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2;
      const copyHeight=Math.max(...slides.map(el=>el.querySelector('.pw-slide-copy').getBoundingClientRect().height));
      const photoHeight=stacked?slide.querySelector('.pw-slide-photo').getBoundingClientRect().height:0;
      carousel.style.minHeight=Math.ceil(copyHeight+padding+photoHeight+(stacked?parseFloat(style.rowGap):0))+'px';
    }
    const resize=()=>{cancelAnimationFrame(sizeFrame);sizeFrame=requestAnimationFrame(fitCarousel)};
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(showcase);on(window,'resize',resize);document.fonts?.ready.then(resize);resize();
    cleanupShowcase=()=>{clearTimeout(timer);clearTimeout(techTimer);cancelAnimationFrame(sizeFrame);observer?.disconnect();controller.abort();showcase.classList.remove('pw-tech-flash')};
    playLabel();schedule();
  }
  const featured=document.querySelector('#featured'),featuredSection=featured?.closest('.featured');
  if(featuredSection){
    featuredSection.classList.add('pw-daily-featured');
    const title=featuredSection.querySelector('h2');
    if(title){title.textContent='Destacados de hoy';const heading=document.createElement('div');heading.className='pw-featured-heading';title.before(heading);heading.innerHTML='<div><span class="pw-kicker">DESCUBRE ALGO NUEVO CADA DÍA</span></div><a href="#catalogo">Explorar el catálogo <span aria-hidden="true">→</span></a>';heading.firstChild.appendChild(title);heading.insertAdjacentHTML('beforeend','<p>Una selección para encontrar tu próximo favorito.</p>')}
  }
  function renderFeaturedSelection(items){
    if(!featured)return;
    featuredSection.hidden=!items.length;
    featured.innerHTML=items.map(p=>`<article class="featured-card pw-featured-card" data-sku="${escape(p.sku)}"><a class="product-img product-link" href="${escape(productHref(p))}" aria-label="Ver ${escape(p.name)}">${productImage(p)}</a><div class="pw-featured-content"><div class="cat">${escape(p.commercialCategory||p.category)}</div>${window.CONECTATECH_TITULOS_PRO?.nameHTML(p,productHref(p))||`<a class="name product-link" href="${escape(productHref(p))}">${escape(p.name)}</a>`}${statusHTML(availabilityFor(p))}<div class="pw-featured-commerce"><div class="promo-badge">PROMO CONTADO</div><div class="promo">${money(p.promo)}</div><div class="pvp">PVP ${money(p.pvp)}</div><a class="wa" href="${escape(availabilityContact(p))}" target="_blank" rel="noopener" aria-label="Consultar ${escape(p.name)} por WhatsApp">Consultar por WhatsApp</a><a class="pw-featured-detail" href="${escape(productHref(p))}">Ver ficha <span aria-hidden="true">→</span></a></div></div></article>`).join('');
  }
  function refreshSelection(){
    const date=calendar.fechaLocal(new Date(),config.zonaHoraria),candidates=products.filter(eligible).map(p=>({sku:p.sku,commercialCategory:p.commercialCategory||p.category,promo:p.promo,pvp:p.pvp,imagen:imageSource(p),actualizadoEn:updatedAt(p)}));
    const key=JSON.stringify([date,config.rotacionDiaria,candidates]);if(key===selectionKey)return;selectionKey=key;
    const automatic=config.rotacionDiaria?.activa!==false&&window.CONECTATECH_ROTACION;
    const plan=automatic?window.CONECTATECH_ROTACION.resolver(candidates,config.rotacionDiaria,date):{fecha:date,vitrina:[...new Set(config.productosPortada||[])].filter(s=>eligible(bySku.get(s))),destacados:[]};
    const selected=plan.vitrina.map(s=>bySku.get(s)).filter(eligible),extra=automatic?plan.destacados.map(s=>bySku.get(s)).filter(eligible):products.filter(p=>eligible(p)&&!plan.vitrina.includes(p.sku)).slice(0,5);
    state.fechaSeleccion=date;state.destacados=extra.map(p=>p.sku);renderShowcase(selected);renderFeaturedSelection(extra);
    document.dispatchEvent(new CustomEvent('conectatech:seleccion-diaria',{detail:{fecha:date,vitrina:state.productos.slice(),destacados:state.destacados.slice()}}));
  }
  const replaceBrokenImage=e=>{const card=e.target.closest?.('[data-sku]');if(card&&!rejectedImages.has(card.dataset.sku)){rejectedImages.add(card.dataset.sku);refreshSelection()}};
  showcase?.addEventListener('error',replaceBrokenImage,true);featured?.addEventListener('error',replaceBrokenImage,true);
  state.revalidar=refreshSelection;
  refreshSelection();
  // Agrupa los nodos existentes sin recrear fichas, controles ni sus listeners.
  const catalogHeading=document.getElementById('catalogo'),catalogEnd=document.getElementById('empty');
  if(catalogHeading&&catalogEnd&&catalogHeading.parentNode===catalogEnd.parentNode&&!catalogHeading.closest('.pw-catalog-frame')){
    const frame=document.createElement('section');frame.className='pw-catalog-frame';frame.setAttribute('aria-labelledby','catalogo');catalogHeading.before(frame);
    let node=catalogHeading;while(node){const next=node.nextSibling;frame.appendChild(node);if(node===catalogEnd)break;node=next}
  }
  const campaign=document.querySelector('.ct-gift-campaign');
  if(campaign&&config.banner){
    const conditions=campaign.querySelector('details')?.cloneNode(true),contact=campaign.querySelector('.ct-gift-unified-footer>a')?.cloneNode(true);
    const locationCopy=campaign.querySelector('.ct-gift-unified-footer>div>p')?.textContent||'';
    campaign.className='ct-gift-campaign pw-campaign pw-campaign--compact';
    campaign.innerHTML=`<div class="pw-campaign-heading"><h2 id="ct-gift-title"><span class="pw-campaign-lead">En esta temporada</span><span class="pw-campaign-message">tu compra tiene <strong>un regalo.</strong></span></h2><span class="pw-store-label">PROMOCIÓN EN TIENDA</span></div><div class="pw-campaign-content"><button type="button" class="pw-banner-open" aria-label="Ampliar el banner original de regalos"><img src="${escape(config.banner)}" alt="Banner original CONECTATECH: llévate un regalo por tu compra, con llavero animado, trípode selfie o audífonos tipo AirPods. Aplican condiciones." width="1016" height="720" loading="lazy"><span>Ampliar promoción ↗</span></button><div class="pw-campaign-footer"><div class="pw-campaign-info"><p class="pw-campaign-address">${escape(locationCopy)}</p><div data-pw-conditions></div></div><div data-pw-contact></div></div></div>`;
    if(conditions)campaign.querySelector('[data-pw-conditions]').appendChild(conditions);
    if(contact)campaign.querySelector('[data-pw-contact]').appendChild(contact);
    const dialog=document.createElement('dialog');dialog.className='pw-banner-dialog';dialog.innerHTML=`<form method="dialog"><button aria-label="Cerrar banner ampliado">Cerrar ×</button></form><img src="${escape(config.banner)}" alt="Banner original completo de la promoción CONECTATECH" width="1016" height="720">`;
    document.body.appendChild(dialog);
    campaign.querySelector('.pw-banner-open').onclick=()=>dialog.showModal();
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  }
  // El enlace de confianza tiene su propio destino; la vitrina conserva un ancla propia.
  const trustbar=document.querySelector('.trustbar'),contactLink=document.querySelector('header .ct-nav-wa');
  if(trustbar&&!document.querySelector('.pw-why')){
    if(hero?.id==='beneficios')hero.id='vitrina';
    const why=document.createElement('section');why.className='pw-why';why.id='beneficios';why.tabIndex=-1;why.setAttribute('aria-labelledby','pw-why-title');
    trustbar.before(why);
    why.innerHTML='<div class="pw-why-intro"><span class="pw-kicker">CONECTATECH · CERCA DE TI</span><h2 id="pw-why-title">¿Por qué<br><strong>elegirnos?</strong></h2><p>Tecnología para ti.<br>Atención de persona a persona.</p><div class="pw-why-actions"></div></div>';
    if(contactLink){const contact=contactLink.cloneNode(false);contact.className='pw-why-contact';contact.textContent='Habla con nuestro equipo';why.querySelector('.pw-why-actions').appendChild(contact)}
    const icons=[
      '<path d="M4 10V21H20V10M3 10L5 3H19L21 10M8 21V15H13V21M3 10Q6 14 9 10Q12 14 15 10Q18 14 21 10"/>',
      '<path d="M6 3H18V22L15 20L12 22L9 20L6 22ZM9 8H15M9 12H15M9 16H12"/>',
      '<path d="M12 2L21 6V12Q21 18 12 22Q3 18 3 12V6ZM8 12L11 15L16 9"/>',
      '<path d="M2 6H15V18H2ZM15 10H19L22 14V18H15M6 6V3H12M7 21A2 2 0 1 0 7 17A2 2 0 1 0 7 21M18 21A2 2 0 1 0 18 17A2 2 0 1 0 18 21"/>'
    ];
    const descriptions=['Visítanos y consulta los productos con nuestro equipo.','Compra con factura y consulta los detalles de tu compra.','Consulta las condiciones aplicables a cada producto.','Confirma cobertura y disponibilidad para coordinar tu entrega.'];
    [...trustbar.querySelectorAll('.trustitem')].forEach((item,i)=>{
      const label=item.textContent.trim().replace(/^[^\p{L}]+/u,'');
      item.replaceChildren();item.insertAdjacentHTML('beforeend',`<span class="pw-why-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[i]||icons[0]}</svg></span><h3>${escape(label)}</h3><p>${escape(descriptions[i]||'Consulta los detalles con nuestro equipo.')}</p>`);
    });
    why.appendChild(trustbar);
    if(location.hash==='#beneficios')document.fonts.ready.then(()=>{if(location.hash==='#beneficios')requestAnimationFrame(()=>{syncHeaderOffset();why.scrollIntoView({behavior:'instant',block:'start'})})});
  }
  applyTheme();
  // Revalida al volver a la pestaña y al cambiar de fecha; no necesita servicios ni tareas.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyTheme();refreshSelection()}});
  setInterval(()=>{applyTheme();refreshSelection()},60000);
  let midnightTimer;
  function nextMidnight(){clearTimeout(midnightTimer);const now=new Date(),local=calendar.fechaLocal(now,config.zonaHoraria);let low=now.getTime(),high=low+26*60*60*1000;while(high-low>500){const mid=Math.floor((low+high)/2);if(calendar.fechaLocal(new Date(mid),config.zonaHoraria)===local)low=mid;else high=mid}midnightTimer=setTimeout(()=>{applyTheme();refreshSelection();nextMidnight()},Math.max(1000,high-now.getTime()+100))}
  nextMidnight();
})();
