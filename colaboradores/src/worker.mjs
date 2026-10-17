const encoder = new TextEncoder();
const states = ['NUEVA CONSULTA','CONTACTADO','INTERESADO','RESERVA PENDIENTE','VENTA CONFIRMADA','CANCELADA'];
const channels = ['Marketplace','Facebook','Instagram','Web'];
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8'}});
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
const parsePart = part => JSON.parse(new TextDecoder().decode(decode(part)));
async function hmac(secret, text) {
  if (!secret || encoder.encode(secret).length<32) fail(503,'Falta configurar secreto seguro');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(await crypto.subtle.sign('HMAC',key,encoder.encode(text)));
}
async function checkHmac(secret,text,signature) {
  if (!secret || encoder.encode(secret).length<32) fail(503,'Integración no configurada');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  try { return await crypto.subtle.verify('HMAC',key,decode(signature),encoder.encode(text)); } catch {return false;}
}
let jwksCache;
export async function verifyAccess(request, env) {
  if(!/^[a-z0-9-]+$/.test(env.ACCESS_TEAM||'') || !env.ACCESS_AUD) fail(503,'Configurar Cloudflare Access');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token || token.length>16000) fail(401,'Inicia sesión con Cloudflare Access');
  try {
    const [head,body,signature,extra]=token.split('.');
    const header=parsePart(head), claims=parsePart(body);
    const issuer=`https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
    const now=Math.floor(Date.now()/1000);
    if(extra || header.alg!=='RS256' || claims.iss!==issuer || !claims.sub || !Number.isFinite(claims.exp) || claims.exp<=now || !Number.isFinite(claims.iat) || claims.iat>now+30 || claims.iat<now-86400 || (claims.nbf && claims.nbf>now+30) || !(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD)) fail(401,'Sesión inválida');
    if(!jwksCache || jwksCache.issuer!==issuer || jwksCache.expires<Date.now() || !jwksCache.keys.some(k=>k.kid===header.kid)) {
      const response=await fetch(`${issuer}/cdn-cgi/access/certs`);
      if(!response.ok) fail(503,'No se pudo verificar la sesión');
      jwksCache={issuer,keys:(await response.json()).keys,expires:Date.now()+300000};
    }
    const jwk=jwksCache.keys.find(k=>k.kid===header.kid && k.kty==='RSA');
    if(!jwk) fail(401,'Firma desconocida');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(signature),encoder.encode(`${head}.${body}`))) fail(401,'Firma inválida');
    return claims.sub;
  } catch(error) {if(error.status) throw error; fail(401,'Sesión inválida');}
}
export function createApp({verifyIdentity=verifyAccess, now=()=>Math.floor(Date.now()/1000)}={}) {
 return {
 async fetch(request,env) {
  try {
    const response=await route(request,env);
    const headers=new Headers(response.headers);
    for(const [key,value] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' https://conectatech-ec.github.io; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000'})) headers.set(key,value);
    return new Response(response.body,{status:response.status,headers});
  } catch(error) {const response=json({error:error.status?error.message:'Error interno'},error.status||500);response.headers.set('Cache-Control','no-store'); return response;}
 },
 async scheduled(_event,env) {
   if(!env.DB || env.DEPLOYMENT_ENABLED!=='true') return;
   const days=Number(env.RETENTION_DAYS);
   if(!Number.isInteger(days)||days<1||days>90) throw Error('Retención inválida');
   const cutoff=now()-days*86400;
   await env.DB.batch([
    env.DB.prepare('DELETE FROM commissions WHERE opportunity_id IN (SELECT id FROM opportunities WHERE updated < ?)').bind(cutoff),
    env.DB.prepare('DELETE FROM opportunities WHERE updated < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM referrals WHERE expires < ? AND id NOT IN (SELECT referral_id FROM opportunities WHERE referral_id IS NOT NULL)').bind(now()),
    env.DB.prepare('DELETE FROM audit WHERE created < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(now())]);
 }
 };
 async function route(req,env) {
  if(env.DEPLOYMENT_ENABLED!=='true'||!env.DB) fail(503,'Piloto pendiente de configuración; no desplegado');
  const url=new URL(req.url), path=url.pathname, db=env.DB;
  if(env.PUBLIC_ORIGIN!==url.origin || !url.origin.startsWith('https://')) fail(503,'Origen no configurado');
  const one=(sql,...args)=>db.prepare(sql).bind(...args).first();
  const all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
  const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
  const audit=(actor,entity,action,detail={})=>db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,entity,action,JSON.stringify(detail),now());
  const body=async()=>{if(!req.headers.get('content-type')?.startsWith('application/json')) fail(415,'Requiere JSON');const raw=await req.text();if(raw.length>8192)fail(413,'Solicitud demasiado grande');try{return JSON.parse(raw);}catch{fail(400,'JSON inválido');}};
  const text=(value,max=120)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f]/.test(value))fail(400,'Campo inválido');return value.trim();};
  const product=async sku=>{const p=await one('SELECT * FROM products WHERE sku=?',sku);if(!p||!p.available||p.verified_until<=now())fail(409,'Producto sin inventario vigente autorizado');return {...JSON.parse(p.data),sku:p.sku,promo:p.promo,pvp:p.pvp,inventory_digest:p.inventory_digest};};
  const publicProduct=p=>({sku:p.sku,nombre:p.nombre,marca:p.marca,modelo:p.modelo,categoria:p.categoria,descripcion:p.descripcion,caracteristicas:p.caracteristicas,beneficios:p.beneficios,imagen:p.imagen,banner:p.banner,url:p.url,promo:p.promo,pvp:p.pvp,entrega:p.entrega,garantia:p.garantia});
  const referral=async token=>{
    if(typeof token!=='string'||token.length>500)fail(400,'Referencia inválida');
    const [id,expires,signature,extra]=token.split('.');
    if(extra||!/^\d+$/.test(expires)||Number(expires)<=now()||!await checkHmac(env.REFERRAL_SECRET,`${id}.${expires}`,signature||''))fail(400,'Referencia inválida o vencida');
    const r=await one('SELECT r.* FROM referrals r JOIN members m ON m.id=r.member_id JOIN assignments a ON a.member_id=r.member_id AND a.sku=r.sku WHERE r.id=? AND r.expires=? AND m.active=1',id,Number(expires));
    if(!r) fail(400,'Referencia revocada');
    return r;
  };
  const mutation=()=>{if(req.headers.get('Origin')!==url.origin || req.headers.get('Sec-Fetch-Site')==='cross-site')fail(403,'Origen no autorizado');};
  // Public product landing. No automatic opportunity or sale is recorded for a visit.
  if(['/style.css','/reference.js'].includes(path) && req.method==='GET') return env.ASSETS.fetch(req);
  if(path==='/r' && req.method==='GET') return env.ASSETS.fetch(new Request(`${url.origin}/ref.html`,req));
  if(path==='/api/reference' && req.method==='GET') {const r=await referral(url.searchParams.get('t'));return json({producto:publicProduct(await product(r.sku)),atribucion:'Referencia verificada; no constituye venta'});}
  if(path==='/api/interest' && req.method==='POST') {
    mutation(); const data=await body(); if(data.consent!==true)fail(400,'Se requiere consentimiento');
    const r=await referral(data.token);await product(r.sku);
    const day=Math.floor(now()/86400), ip=req.headers.get('CF-Connecting-IP');
    if(!ip)fail(503,'Servicio requiere perímetro Cloudflare');
    const bucket=await hmac(env.REFERRAL_SECRET,`rate:${day}:${ip}`);
    await run('INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',bucket,now()+86400);
    if((await one('SELECT count FROM rate_limits WHERE key=?',bucket)).count>10)fail(429,'Límite diario de solicitudes');
    const id=crypto.randomUUID();
    const result=await run('INSERT OR IGNORE INTO opportunities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,r.member_id,r.sku,'Solicitud web',`ref:${r.id}:${bucket}`,'NUEVA CONSULTA',r.id,`enlace:${r.channel}`,null,null,now(),now());
    const existing=await one('SELECT id FROM opportunities WHERE dedupe=?',`ref:${r.id}:${bucket}`);
    if(result.meta.changes)await audit('PUBLICO',existing.id,'CONSENTIMIENTO_Y_CONSULTA',{referral:r.id}).run();
    return json({id:existing.id,estado:'NUEVA CONSULTA',mensaje:'Consulta registrada. Guarda este código para comunicarlo al asesor. No es una reserva ni una venta.'},201);
  }
  if(path==='/api/alex/resolve' && req.method==='POST') {
    // Contract only: never sends messages or writes to the existing Alex Worker.
    if(env.ALEX_ENABLED!=='true')fail(503,'Alex pendiente de permisos oficiales');
    const raw=await req.text();if(raw.length>8192)fail(413,'Solicitud demasiado grande');
    const timestamp=req.headers.get('X-Alex-Time')||'';
    if(!/^\d+$/.test(timestamp)||Math.abs(now()-Number(timestamp))>60||!await checkHmac(env.ALEX_SECRET,`${timestamp}.${raw}`,req.headers.get('X-Alex-Signature')||''))fail(401,'Firma de servicio inválida');
    let data;try{data=JSON.parse(raw);}catch{fail(400,'JSON inválido');}
    const r=await referral(data.reference);
    return json({reference:r.id,colaborador:r.member_id,producto:publicProduct(await product(r.sku)),canalReferencia:r.channel,canalLlegadaVerificado:false,ventaConfirmada:false,handoffHumano:true});
  }
  // Every private route and asset verifies both the Access JWT and current allowlist.
  const subject=await verifyIdentity(req,env);
  const member=await one('SELECT * FROM members WHERE subject=? AND active=1',subject);
  if(!member)fail(403,'Acceso revocado o cuenta no autorizada');
  const admin=()=>{if(member.role!=='ADMINISTRADOR')fail(403,'Requiere administrador');};
  const scope=(column='opportunities.member_id')=>member.role==='COLABORADOR'?{sql:` AND ${column}=?`,args:[member.id]}:member.role==='SUPERVISOR'?{sql:` AND EXISTS (SELECT 1 FROM supervision s WHERE s.supervisor_id=? AND s.member_id=${column})`,args:[member.id]}:{sql:'',args:[]};
  const assigned=async sku=>{if(member.role!=='ADMINISTRADOR'&&!await one('SELECT 1 FROM assignments WHERE member_id=? AND sku=?',member.id,sku))fail(403,'Producto no asignado');return product(sku);};
  if(!['GET','HEAD'].includes(req.method))mutation();
  if(path==='/api/me'&&req.method==='GET')return json({id:member.id,role:member.role});
  if(path==='/api/products'&&req.method==='GET') {
    const rows=await all('SELECT p.* FROM products p WHERE p.available=1 AND p.verified_until>?'+(member.role!=='ADMINISTRADOR'?' AND EXISTS (SELECT 1 FROM assignments a WHERE a.sku=p.sku AND a.member_id=?)':''),now(),...(member.role!=='ADMINISTRADOR'?[member.id]:[]));
    return json(rows.map(p=>publicProduct({...JSON.parse(p.data),sku:p.sku,promo:p.promo,pvp:p.pvp})));
  }
  if(path==='/api/material'&&req.method==='POST') {
    const data=await body(), p=await assigned(text(data.sku)), channel=text(data.channel,20);
    if(!channels.includes(channel))fail(400,'Canal no admitido');
    const id=crypto.randomUUID(), expires=now()+604800;
    const token=`${id}.${expires}.${await hmac(env.REFERRAL_SECRET,`${id}.${expires}`)}`;
    const link=`${url.origin}/r?t=${encodeURIComponent(token)}`;
    const publication=crypto.randomUUID();
    await db.batch([db.prepare('INSERT INTO referrals VALUES (?,?,?,?,?,?)').bind(id,member.id,p.sku,channel,expires,now()),db.prepare('INSERT INTO publications VALUES (?,?,?,?,?,?,?)').bind(publication,member.id,p.sku,channel,'PREPARADO',p.inventory_digest,now()),audit(member.id,publication,'PREPARADO',{sku:p.sku,channel})]);
    const copy=[p.nombre,p.modelo?`Modelo: ${p.modelo}`:'',`Contado: $${p.promo.toFixed(2)}`,p.descripcion,...(p.beneficios||[]).map(b=>`${b.titulo}: ${b.descripcion}`),p.garantia?`Garantía: ${p.garantia}`:'','Quito, Ecuador.',p.entrega||'Entrega: consultar opciones vigentes.',`Consulta el producto: ${link}`].filter(Boolean).join('\n');
    return json({copy,link,imagen:p.imagen,banner:p.banner||null,publication,expires,estado:'PREPARADO'});
  }
  if(path==='/api/opportunities'&&req.method==='GET'){const s=scope();return json(await all('SELECT * FROM opportunities WHERE 1=1'+s.sql+' ORDER BY updated DESC LIMIT 200',...s.args));}
  if(path==='/api/opportunities'&&req.method==='POST') {
    const data=await body(),p=await assigned(text(data.sku)),alias=text(data.alias,60),key=text(data.idempotencyKey,80);
    // Origin is declared by the collaborator, never claimed to be verified attribution.
    const id=crypto.randomUUID();
    await db.batch([db.prepare('INSERT OR IGNORE INTO opportunities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,member.id,p.sku,alias,`${member.id}:${key}`,'NUEVA CONSULTA',null,'declarado por colaborador',null,null,now(),now()),db.prepare("INSERT INTO audit SELECT ?,?,?,?,'{}',? WHERE EXISTS (SELECT 1 FROM opportunities WHERE id=?)").bind(crypto.randomUUID(),member.id,id,'REGISTRO_MANUAL',now(),id)]);
    return json(await one("SELECT * FROM opportunities WHERE member_id=? AND (dedupe=? OR (sku=? AND lower(alias)=lower(?) AND source='declarado por colaborador' AND state NOT IN ('CANCELADA','VENTA CONFIRMADA'))) ORDER BY created DESC LIMIT 1",member.id,`${member.id}:${key}`,p.sku,alias),201);
  }
  if(path.startsWith('/api/opportunities/')&&req.method==='PATCH') {
    const id=path.split('/').pop(),s=scope();const o=await one('SELECT * FROM opportunities WHERE id=?'+s.sql,id,...s.args);if(!o)fail(404,'Oportunidad no encontrada');
    const data=await body(),state=data.state;
    if(!states.includes(state))fail(400,'Estado inválido');
    if(['VENTA CONFIRMADA','CANCELADA'].includes(o.state))fail(409,'Oportunidad finalizada');
    if(state!=='CANCELADA'&&states.indexOf(state)!==states.indexOf(o.state)+1)fail(409,'Transición inválida');
    let reference=null,amount=null;
    if(state==='VENTA CONFIRMADA') {admin();reference=text(data.saleReference);amount=data.amount;if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>1000000)fail(400,'Importe inválido');}
    try {
     const changes=[db.prepare('UPDATE opportunities SET state=?, sale_reference=?, sale_amount=?, updated=? WHERE id=? AND state=?').bind(state,reference,amount,now(),id,o.state),db.prepare('INSERT INTO audit SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),member.id,id,state,JSON.stringify({saleReference:reference}),now())];
     if(state==='VENTA CONFIRMADA')changes.push(db.prepare("INSERT INTO commissions SELECT ?,id,NULL,NULL,'SIN_POLITICA',? FROM opportunities WHERE id=? AND sale_reference=? AND state='VENTA CONFIRMADA' AND changes()=1").bind(crypto.randomUUID(),now(),id,reference));
     const [update]=await db.batch(changes);
     if(!update.meta.changes)fail(409,'La oportunidad cambió; recarga');
    } catch(error){if(error.status)throw error;fail(409,'Confirmación duplicada o conflicto');}
    return json({id,state});
  }
  if(path==='/api/publications'&&req.method==='GET'){const s=scope('publications.member_id');return json(await all('SELECT * FROM publications WHERE 1=1'+s.sql+' ORDER BY updated DESC LIMIT 200',...s.args));}
  if(path.startsWith('/api/publications/')&&req.method==='PATCH') {
    admin();const id=path.split('/').pop(),data=await body(),p=await one('SELECT * FROM publications WHERE id=?',id);if(!p)fail(404,'Publicación no encontrada');
    if(data.state!=='APROBADO'||p.state!=='PREPARADO')fail(409,'Publicación automática inactiva; solo se permite aprobar material');
    const current=await product(p.sku);if(current.inventory_digest!==p.inventory_digest)fail(409,'Material desactualizado: vuelve a prepararlo');
    await db.batch([db.prepare('UPDATE publications SET state=?, updated=? WHERE id=? AND state=?').bind('APROBADO',now(),id,'PREPARADO'),audit(member.id,id,'APROBADO')]);return json({id,state:'APROBADO',publicado:false});
  }
  if(path==='/api/reports'&&req.method==='GET') {
    const s=scope();return json({resumen:await all("SELECT member_id, COUNT(*) consultas, SUM(CASE WHEN state='RESERVA PENDIENTE' THEN 1 ELSE 0 END) reservas, SUM(CASE WHEN state='VENTA CONFIRMADA' THEN 1 ELSE 0 END) ventas_confirmadas, COALESCE(SUM(CASE WHEN state='VENTA CONFIRMADA' THEN sale_amount ELSE 0 END),0) importe_vendido FROM opportunities WHERE 1=1"+s.sql+' GROUP BY member_id',...s.args),comisiones:await all('SELECT c.state, COALESCE(SUM(c.amount),0) importe FROM commissions c JOIN opportunities o ON o.id=c.opportunity_id WHERE 1=1'+scope('o.member_id').sql+' GROUP BY c.state',...s.args),politicaComisiones:'SIN_POLITICA'});
  }
  if(path.startsWith('/api/members/')&&req.method==='PATCH') {
    admin();const id=path.split('/').pop(),data=await body();if(id===member.id)fail(409,'No puedes revocar tu propia cuenta');if(typeof data.active!=='boolean')fail(400,'Valor inválido');
    await db.batch([db.prepare('UPDATE members SET active=? WHERE id=?').bind(data.active?1:0,id),audit(member.id,id,'ACCESO',{active:data.active})]);return json({id,active:data.active});
  }
  if(path.startsWith('/api/opportunities/')&&req.method==='DELETE') {
    admin();const id=path.split('/').pop();await db.batch([db.prepare('DELETE FROM commissions WHERE opportunity_id=?').bind(id),db.prepare('DELETE FROM opportunities WHERE id=?').bind(id),audit(member.id,id,'ELIMINADO')]);return json({deleted:true});
  }
  if(path.startsWith('/api/'))fail(404,'Ruta no encontrada');
  if(!['GET','HEAD'].includes(req.method))fail(405,'Método no admitido');
  return env.ASSETS.fetch(req);
 }
}
export default createApp();
