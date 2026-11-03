/* Pure read-only contract. No clocks, network, writes, rendering or relabelling. */
const BannersVigencia = (() => {
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  const sku=v=>typeof v==='string'&&/^[A-Z0-9_-]{3,40}$/.test(v);
  function date(v){
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
    const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;
  }
  function cents(v){
    if(typeof v!=='string'&&typeof v!=='number')return null;
    if(typeof v==='number'&&!Number.isFinite(v))return null;
    const match=/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(v));
    if(!match)return null;
    const n=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
    return Number.isSafeInteger(n)&&n>=0?n:null;
  }
  const integer=v=>Number.isSafeInteger(v)&&v>=0;
  function cut(status,prices){
    if(!status||!prices||!date(status.fecha_corte)||!sha(status.origen_sha256)||
      prices.fecha_corte!==status.fecha_corte||prices.sha256_original!==status.origen_sha256||
      !prices.productos||typeof prices.productos!=='object'||Array.isArray(prices.productos))return false;
    const entries=Object.entries(prices.productos);
    if(!entries.length||entries.length>5000||
      (prices.cantidad_sku_web!==undefined&&prices.cantidad_sku_web!==entries.length))return false;
    return entries.every(([id,p])=>sku(id)&&p&&integer(p.stock)&&integer(p.promo_centavos)&&integer(p.pvp_centavos));
  }
  function product(p,status,prices,requireAvailable){
    if(!p||!sku(p.sku)||!cut(status,prices)||!own(prices.productos,p.sku))return false;
    const expected=prices.productos[p.sku];
    return p.fecha_datos===status.fecha_corte&&p.fuente_593_sha256===status.origen_sha256&&
      cents(p.precio_contado)===expected.promo_centavos&&cents(p.pvp)===expected.pvp_centavos&&
      expected.promo_centavos>0&&expected.pvp_centavos>0&&(!requireAvailable||expected.stock>0);
  }
  function stamp(record,checksum,status){
    return !!(record&&sha(checksum)&&record.estado_publicacion==='VERIFICADO'&&record.estado_aprobacion==='APROBADO'&&
      record.fecha_corte===status.fecha_corte&&record.sha256_fuente===status.origen_sha256&&
      record.checksum_archivo===checksum&&record.checksum_descargado===checksum);
  }
  function banner(p,status,prices){
    return product(p,status,prices,true)&&p.fecha_datos_banner===status.fecha_corte&&
      stamp(p.publicacion_drive,p.banner_sha256,status);
  }
  function sameSet(a,b){
    if(!Array.isArray(a)||!Array.isArray(b)||!a.length||a.length!==b.length)return false;
    const x=new Set(a),y=new Set(b);
    return x.size===a.length&&y.size===b.length&&a.every(id=>sku(id)&&y.has(id));
  }
  function pdf(c,a,products,status,prices){
    if(!c||!a||!['APROBADO','APROBADO_DRIVE_VERIFICADO','APROBADO_VERIFICADO_DRIVE'].includes(c.estado)||!Array.isArray(products)||!cut(status,prices)||
      c.fecha_datos!==status.fecha_corte||c.fuente_593_sha256!==status.origen_sha256)return false;
    const record=c.publicacion_drive&&c.publicacion_drive[a.version];
    if(!stamp(record,a.sha256,status)||!sameSet(c.sku,record.SKU))return false;
    const match=typeof a.url==='string'&&a.url.match(/\/d\/([A-Za-z0-9_-]+)/);
    if(!match||record.id_drive!==match[1])return false;
    return c.sku.every(id=>{
      const matches=products.filter(p=>p&&p.sku===id);
      return matches.length===1&&product(matches[0],status,prices,false);
    });
  }
  return Object.freeze({date,cents,cut,product,stamp,banner,pdf});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BannersVigencia;
