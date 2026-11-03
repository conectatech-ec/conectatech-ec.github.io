const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderBanner(response,name) {
 const b=response.banner_comercial;
 if(!b||response.error||!response.disponible) throw Error('no_verified_banner_data');
 const dateLabel=response.fecha_corte_confirmada?'Corte 593 confirmado':'Datos';
 const sourceDate=response.fecha_corte_confirmada||response.fuente_fecha;
 return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(name)} · CONECTATECH</title><style>body{margin:0;background:#f0f5fa;font:20px system-ui;color:#122640}article{max-width:650px;margin:24px auto;padding:28px;background:white;border-radius:24px}img{width:100%;height:340px;object-fit:contain}strong{display:block;font-size:32px;color:#07664b}a{display:inline-block;background:#173e75;color:white;padding:14px;border-radius:12px}small{display:block;margin:16px 0}</style><article><header>CONECTATECH · ${escape(response.sku)}</header><h1>${escape(name)}</h1><img src="${escape(b.foto)}" alt="${escape(name)}"><strong>PROMO CONTADO $${Number(b.precio).toFixed(2)}</strong><p>PVP $${Number(b.pvp).toFixed(2)}</p><p>Disponibilidad referencial: ${response.stock_referencial}</p><small>Retiro en tienda · Contraentrega en Quito · Envío nacional. Cobertura, costo y fecha por confirmar. ${escape(dateLabel)}: ${escape(sourceDate)}</small><a href="${escape(b.url_compra)}">Consultar ficha y opciones de compra</a><small>Solicitud sujeta a confirmación. No constituye reserva de inventario.</small></article></html>`;
}

// Only the existing validated Data Hub and its current bound PUBLIC presentation
// can authorize this preview. Publication/render timestamps never renew a cut.
export function renderValidatedBanner(response,name,source,now=Date.now()) {
 const reject=()=>{throw Error('BANNER_SOURCE_UNAVAILABLE');};
 if(!['validated_central_593','shared_validated_central_593'].includes(source?.source_kind)||source.prices_cross_checked!==true||source.source_error_code)reject();
 const generated=Date.parse(source.fuente_fecha),expires=Date.parse(source.expires_at),cut=source.inventory_cut_date;
 if(!Number.isFinite(now)||!Number.isFinite(generated)||!Number.isFinite(expires)||expires-generated!==86400000||generated>now+300000||expires<now)reject();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(cut||'')||new Date(generated-5*3600000).toISOString().slice(0,10)!==cut||!/^[a-f0-9]{64}$/.test(source.source_sha256||''))reject();
 if(!['verified','unchanged'].includes(source.presentation_state)||source.presentation_error_code||!/^alex-presentation-v1-[a-f0-9]{64}$/.test(source.presentation_version||''))reject();
 const matches=source.productos?.filter(p=>p.sku===response?.sku)||[],p=matches[0];
 if(matches.length!==1||p.price_verified!==true||p.stock<=0||p.presentation_photo!==true||p.presentation_media_state!=='current')reject();
 if(typeof name!=='string'||!name.trim()||name!==p.public_name)reject();
 if(response.error||response.disponible!==true||!Number.isFinite(p.promo)||!Number.isFinite(p.pvp)||p.promo<=0||p.pvp<p.promo||response.precio!==p.promo||response.pvp!==p.pvp)reject();
 if(!/^[a-f0-9]{64}$/.test(p.foto_sha256||'')||response.foto!==p.foto)reject();
 let photo;try{photo=new URL(p.foto);}catch{reject();}
 if(photo.origin!=='https://conectatech-ec.github.io'||!photo.pathname.startsWith('/imagenes/')||photo.search||photo.hash||photo.username||photo.password)reject();
 const banner=response.banner_comercial;
 if(!banner||banner.foto!==p.foto||banner.precio!==p.promo||banner.pvp!==p.pvp||banner.url_compra!==p.url||response.url!==p.url)reject();
 return renderBanner({...response,fecha_corte_confirmada:cut,
  stock_referencial:p.stock_is_availability_marker?'Disponible, sujeto a confirmación':response.stock_referencial},name);
}
