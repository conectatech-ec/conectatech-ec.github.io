#!/usr/bin/env python3
"""Aplica el corte autorizado de 593: importes explícitos, sin recalcular PVP."""
import copy, csv, gzip, hashlib, html as htmlmod, io, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
DATA='datos-593/corte-2026-10-10.json.gz'
REPORT='reportes/sincronizacion-593-2026-10-10.json'
PUBLIC='https://conectatech-ec.github.io'
EXPECTED_DATA='eaaec031bd456f9518e1562174793463a02070b562fb8d25c8e54048cbf2f6ea'
RX=re.compile(r'const products=(\[[\s\S]*?\]);\s*\n')
sha=lambda b:hashlib.sha256(b).hexdigest()
def load(p):return json.loads((ROOT/p).read_text())
def write(p,content):
 p=ROOT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content,encoding='utf-8')
def js(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def out(p,v):write(p,json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def cents(v):return int(Decimal(str(v))*100)
def compact_financial(products):
 return [[p['sku'],int(p['stock']),cents(p['promo']),cents(p['pvp'])] for p in sorted(products,key=lambda p:p['sku'])]
def load_source():
 b=gzip.decompress((ROOT/DATA).read_bytes())
 if sha(b)!=EXPECTED_DATA:raise ValueError('La carga depurada no coincide con el Excel validado')
 x=json.loads(b)
 if x['authorization']!='APLICAR':raise ValueError('Sin autorización')
 if len(x['rows'])!=x['expected']['source'] or len({r[0] for r in x['rows']})!=len(x['rows']):raise ValueError('SKU duplicado o corte incompleto')
 if any(len(r)!=4 or not re.fullmatch(r'[A-Z0-9_-]{3,40}',r[0]) or any(type(v)is not int for v in r[1:]) or r[2]<0 or r[3]<0 for r in x['rows']):raise ValueError('Datos inválidos')
 return x,{r[0]:{'stock':r[1],'promo':r[2]/100,'pvp':r[3]/100} for r in x['rows']}
def patch_page(text,p,old,cut):
 images=re.findall(r'<img\b[^>]*>',text);titles=re.findall(r'<(?:h1|title)\b[^>]*>.*?</(?:h1|title)>',text,re.S)
 def structured(m):
  s=json.loads(m[2])
  if s.get('sku')!=p['sku']:raise ValueError('SKU de ficha distinto')
  s['offers']['price']=f"{p['promo']:.2f}";s['offers']['availability']='https://schema.org/'+('InStock' if p['stock']>0 else 'OutOfStock')
  return m[1]+js(s).replace('<','\\u003c')+m[3]
 text,n=re.subn(r'(<script type="application/ld\+json">)(.*?)(</script>)',structured,text,flags=re.S)
 if n!=1:raise ValueError('Esquema inesperado: '+p['sku'])
 def price(m):return m[1]+'$'+f"{p['promo']:.2f}".replace('.',',' if ',' in m[2] else '.')+m[3]
 text,n=re.subn(r'(<div class="price">)([^<]+)(</div>)',price,text)
 if n!=1:raise ValueError('Precio visible inesperado: '+p['sku'])
 text,n=re.subn(r'PVP\s+\$([0-9.,]+)',lambda m:'PVP $'+f"{p['pvp']:.2f}".replace('.',',' if ',' in m[1] else '.'),text)
 if n<1:raise ValueError('PVP visible ausente: '+p['sku'])
 text=re.sub(r'((?:Stock registrado|Sin stock registrado) al )\d{2}/\d{2}/\d{4}',r'\g<1>'+cut,text)
 if old['stock']>0 and p['stock']<=0:
  if 'class="status ' in text:
   text=text.replace('class="status "','class="status unavailable"').replace('>Stock registrado al ','>Sin stock registrado al ').replace('Consultar y comprar por WhatsApp','Consultar próxima disponibilidad')
  elif 'Temporalmente agotado.' not in text:
   text=text.replace('<h2>Consulta y compra</h2>','<p style="font-weight:bold;color:#9b2c2c">Temporalmente agotado. Consulta próxima disponibilidad.</p><h2>Consulta y compra</h2>')
 elif old['stock']<=0 and p['stock']>0:
  text=text.replace('class="status unavailable"','class="status "').replace('>Sin stock registrado al ','>Stock registrado al ').replace('Consultar próxima disponibilidad','Consultar y comprar por WhatsApp')
  text=text.replace('<p style="font-weight:bold;color:#9b2c2c">Temporalmente agotado. Consulta próxima disponibilidad.</p>','')
 if old['promo']!=p['promo']:
  text=text.replace('USD '+f"{old['promo']:.2f}",'USD '+f"{p['promo']:.2f}")
  for sep in ('.',','):
   a=quote('promo contado $'+f"{old['promo']:.2f}".replace('.',sep),safe='')
   b=quote('promo contado $'+f"{p['promo']:.2f}".replace('.',sep),safe='')
   text=text.replace(a,b)
 if images!=re.findall(r'<img\b[^>]*>',text) or titles!=re.findall(r'<(?:h1|title)\b[^>]*>.*?</(?:h1|title)>',text,re.S):raise ValueError('Cambio visual/título no autorizado')
 return text

def apply():
 x,source=load_source();path=ROOT/'index.html';original=path.read_text();products=json.loads(RX.search(original)[1]);before=copy.deepcopy(products)
 if len(products)!=x['expected']['catalog']:raise ValueError('Cantidad web cambió, revisar el corte antes de aplicar')
 fin=sha(js(compact_financial(products)).encode())
 if (ROOT/REPORT).exists() and load(REPORT).get('source_sha256')==x['source_sha256']:
  if all(all(p[k]==source[p['sku']][k] for k in ('promo','pvp','stock')) for p in products):print('Corte ya aplicado; sin repetir fechas ni cambios');return
  raise ValueError('Este corte ya se aplicó y existen cambios posteriores: no revertir')
 if fin!=x['base_financial_sha256']:raise ValueError('Hay precios/stock concurrentes; no sobrescribir')
 rawpath=ROOT/'datos-593/inventario-publico.csv';rawbytes=rawpath.read_bytes()
 if sha(rawbytes)!=x['base_csv_sha256']:raise ValueError('Fuente 593 cambió concurrentemente')
 rows=list(csv.DictReader(io.StringIO(rawbytes.decode('utf-8-sig'))));headers=list(rows[0]);raw={r['sku']:r for r in rows}
 for c in x['source_changes']:
  if c['sku'] not in raw:raw[c['sku']]={h:'' for h in headers}
  raw[c['sku']].update(c['changes'])
 if set(raw)!=set(source):raise ValueError('Universo 593 incompleto')
 for r in raw.values():
  n=source[r['sku']]
  if Decimal(r['stock'])!=Decimal(n['stock']):raise ValueError('Stock no coincide con el archivo adjunto')
  r['promo_contado']=f"{n['promo']:.2f}";r['pvp_final']=f"{n['pvp']:.2f}"
 stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=headers+['promo_contado','pvp_final'],lineterminator='\n');writer.writeheader();writer.writerows(raw.values());newcsv=stream.getvalue()
 changes=[]
 for p in products:
  if p['sku'] not in source:raise ValueError('Falta SKU: '+p['sku'])
  n=source[p['sku']];old={k:p[k] for k in ('promo','pvp','stock')};fields=[k for k in old if old[k]!=n[k]]
  if fields:changes.append({'sku':p['sku'],'nombre':p['name'],'campos':fields,'antes':old,'despues':n})
  p.update(n)
 actual={'changed':len(changes),'promo':sum('promo'in c['campos'] for c in changes),'pvp':sum('pvp'in c['campos'] for c in changes),'stock':sum('stock'in c['campos'] for c in changes)}
 if any(v!=x['expected'][k] for k,v in actual.items()):raise ValueError('Diferencias distintas de la comparación validada: '+js(actual))
 for a,b in zip(before,products):
  if {k:v for k,v in a.items() if k not in ('promo','pvp','stock')}!={k:v for k,v in b.items() if k not in ('promo','pvp','stock')}:raise ValueError('Cambio fuera de alcance')
 cut='10/10/2026';timestamp=datetime.now(timezone.utc).isoformat();slugs=load('seo-pages.json');seo=load('seo-contenido.json')
 oldmap={p['sku']:p for p in before};newmap={p['sku']:p for p in products}
 for c in changes:
  sku=c['sku'];f=ROOT/'productos'/slugs[sku]/'index.html';f.write_text(patch_page(f.read_text(),newmap[sku],oldmap[sku],cut))
 for sku,s in seo.items():
  if sku in source and 'fechaInventario'in s:s['fechaInventario']=cut
 out('seo-contenido.json',seo);write('datos-593/inventario-publico.csv',newcsv)
 csvsha=sha(newcsv.encode());updated_contracts=0
 for f in (ROOT/'importacion/contratos').glob('*.json'):
  c=json.loads(f.read_text());sku=c.get('sku')
  if sku not in newmap:continue
  n=source[sku];c.update(precio_contado=n['promo'],pvp=n['pvp'],stock=n['stock'],stock_fecha_corte=x['cutoff'])
  c.setdefault('validaciones',{})['base_593']={'archivo':'datos-593/inventario-publico.csv','sha256':csvsha,'fila':raw[sku]}
  c['actualizacion_593']={'fecha_corte':x['cutoff'],'fuente':DATA,'source_sha256':x['source_sha256'],'campos':['precio_contado','pvp','stock'],'nota':'Autorización expresa del propietario para sincronizar este corte. No cambia aprobaciones visuales.'}
  f.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n');updated_contracts+=1
 # Fechar exclusivamente los 222 cambios reales. Preservar registros visuales y sus huellas.
 state=load('importacion/actualizaciones-sku.json');public_js=(ROOT/'assets/catalogo-publicado.js').read_text();pub=json.loads(public_js.split('=',1)[1].strip().removesuffix(';'))
 for sku,e in pub.get('productos',{}).items():
  olde=state['productos'].setdefault(sku,copy.deepcopy(e))
  if e.get('actualizadoEn','')>olde.get('actualizadoEn',''):olde['actualizadoEn']=e['actualizadoEn']
  # Las referencias públicas vigentes prevalecen sobre un registro histórico anterior.
  if 'imagen'in e:olde['imagen']=copy.deepcopy(e['imagen'])
 for c in changes:
  sku=c['sku'];e=state['productos'].setdefault(sku,{});e.setdefault('huella',sha(js({'sku':sku,'finanzas':c['despues']}).encode()))
  e.setdefault('imagen',{'src':oldmap[sku].get('imageUrl',''),'srcset':''});e['actualizadoEn']=timestamp
  e['actualizacion_593']={'fuente':DATA,'fecha_corte':x['cutoff'],'antes':c['antes'],'despues':c['despues'],'estado':'APLICADO_PENDIENTE_VERIFICACION_PUBLICA'}
  pub.setdefault('productos',{})[sku]={k:e[k] for k in ('actualizadoEn','huella','imagen')}
 order=state.get('ordenPredeterminado','fotos')
 if order not in ('fotos','recientes','catalogo','nombre','precio-asc','precio-desc'):raise ValueError('Orden no reconocido')
 state['ordenPredeterminado']=order;pub['ordenPredeterminado']=order;out('importacion/actualizaciones-sku.json',state)
 jstext='window.CONECTATECH_CATALOGO='+js(pub).replace('<','\\u003c')+';\n';write('assets/catalogo-publicado.js',jstext)
 updated=RX.sub(lambda m:'const products='+js(products).replace('<','\\u003c')+';\n',original,count=1)
 updated=re.sub(r'/assets/catalogo-publicado\.js(?:\?[^"\s<>]*)?', '/assets/catalogo-publicado.js?v='+sha(jstext.encode())[:12],updated)
 updated=updated.replace('una actualización del 06-10-2026','una actualización del 10-10-2026').replace('una actualización del 08-10-2026','una actualización del 10-10-2026');write('index.html',updated)
 # El sincronizador futuro debe usar los dos precios explícitos, no la vieja fórmula +15%.
 syncpath=ROOT/'scripts/sincronizar-593.cjs';code=syncpath.read_text()
 replacements={"const nextPromo=base>0?round(base*1.15):current.promo;":"const nextPromo=base>0?Number(raw.promo_contado):current.promo;", "const nextPvp=base>0?round(nextPromo*1.15):current.pvp;":"const nextPvp=base>0?Number(raw.pvp_final):current.pvp;", "const promo=round(base*1.15),pvp=round(promo*1.15);":"const promo=Number(raw.promo_contado),pvp=Number(raw.pvp_final);"}
 for a,b in replacements.items():
  if a not in code:raise ValueError('Sincronizador cambió; revisar patch')
  code=code.replace(a,b)
 code=code.replace("const input=parseCSV(csv);","const input=parseCSV(csv);\nfor(const r of input){if(!r.promo_contado||!r.pvp_final||![Number(r.promo_contado),Number(r.pvp_final)].every(Number.isFinite))throw Error('Faltan precios explícitos 593: no recalcular PVP desde Promo Contado');}")
 # Las altas ajenas al catálogo se preparan en su flujo de publicación, no en este corte.
 code=code.replace('}else if(sellable&&stock>0){','}else if(sellable&&stock>0&&process.env.INCLUIR_NUEVOS===\'SI\'){')
 syncpath.write_text(code)
 reference='# Fuente oficial del catálogo ConectaTech\n\n**Sistema 593 — Inventario exportado el 10-10-2026**.\n\nArchivo: Reporte-Inventario 10-10-2026.xlsx. SHA-256: '+x['source_sha256']+'.\n\n1549 SKU en el corte (1548 productos y 1 servicio). Se sincronizan las 1165 fichas existentes, sin crear duplicados. AUDI092 y CABL172 se detectan con existencias pero quedan fuera de esta publicación de precios; requieren su alta comercial.\n\n## Importes exactos, IVA incluido\n- Promo Contado: columna Q, V. TOTAL.\n- PVP final: columna X, PVP, más el importe de IVA de la columna Y, PVP % IVA. No es un porcentaje adicional: es el importe fiscal exportado.\n- Stock: columna B.\n- Columnas públicas nuevas: promo_contado y pvp_final. Sustituyen las fórmulas históricas. No calcular indiscriminadamente contado × 1,15 ni contado ÷ 0,80.\n- Se respetan incluso diferencias de redondeo de un centavo del reporte.\n- Solo datos comerciales: no subir el Excel completo, costos, márgenes, clientes, RUC ni credenciales.\n- Conservar títulos, imágenes, especificaciones y URLs. Datos de corte, no tiempo real.\n- Registrar primero los SKU con cambios reales de precio o existencias para revisión.\n'
 write('datos-593/REFERENCIA-OFICIAL.md',reference)
 guide='# CONECTATECH — Sincronización autorizada desde 593\n\nFuente vigente: `datos-593/REFERENCIA-OFICIAL.md`.\n\nLa exportación vigente incorpora los importes finales explícitos `promo_contado` y `pvp_final` además de `sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion`. No volver a calcular PVP con la fórmula histórica.\n\nLa solicitud expresa del propietario autorizó el corte 10-10-2026. Se conserva el Excel original fuera del repositorio público. La carga depurada verificable está en `datos-593/corte-2026-10-10.json.gz`. El script de aplicación rechaza fuentes alteradas, SKU duplicados y sobrescrituras de precios concurrentes.\n\nEl workflow de este corte se limita a sus datos y es idempotente. No constituye autorización general para importar otras exportaciones. Las futuras sincronizaciones requieren un nuevo corte validado y autorización, y conservan precios explícitos, fotos, títulos, URLs y registros de revisión. Las altas se procesan aparte.\n'
 write('GUIA-SINCRONIZACION-593.md',guide)
 # Exportar precios sin ejecutar cambios editoriales/fotográficos ajenos a este corte.
 wrapper="const path=require('path');const k=require.resolve('./scripts/aplicar-reglas-medios.cjs');require.cache[k]={id:k,filename:k,loaded:true,exports:()=>{}};require('./scripts/exportar-canales.cjs');"
 subprocess.run(['node','-e',wrapper],cwd=ROOT,check=True)
 nowhtml=path.read_text();nowproducts=json.loads(RX.search(nowhtml)[1])
 if nowproducts!=products:raise ValueError('Otra herramienta alteró el catálogo')
 for p in products:
  f=ROOT/'productos'/slugs[p['sku']]/'index.html';text=f.read_text();schema=json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',text,re.S)[1]);assert cents(schema['offers']['price'])==cents(p['promo'])
  m=re.search(r'PVP\s+\$([0-9.,]+)',text);assert m and cents(m[1].replace(',','.'))==cents(p['pvp']),p['sku']
 report={'fuente':x['source_file'],'source_sha256':x['source_sha256'],'corte':x['cutoff'],'estado':'APLICADO_VALIDADO_LOCAL','fecha_aplicacion':timestamp,'resumen':{**actual,'precios_modificados':sum(any(k in c['campos'] for k in ('promo','pvp')) for c in changes),'sku_catalogo':len(products),'sku_fuente':len(source),'altas_publicadas':0,'contratos_refrescados':updated_contracts},'mapping':x['mapping'],'not_added_to_catalog':x['not_added_to_catalog'],'preservado':['sku','nombre_comercial','imagenes','descripciones','especificaciones','URLs','diseño','tipografía','logo'],'base_csv_sha256':csvsha,'financial_sha256':sha(js(compact_financial(products)).encode()),'productos':changes}
 out(REPORT,report)
 print(json.dumps(report['resumen'],ensure_ascii=False))


def verify_public():
 x,source=load_source();r=load(REPORT);local=(ROOT/'index.html').read_text();lp=json.loads(RX.search(local)[1]);slugs=load('seo-pages.json');q='?corte593='+x['source_sha256'][:12]
 def get(path):
  url=PUBLIC+path
  req=Request(url,headers={'User-Agent':'CONECTATECH-QA-593','Cache-Control':'no-cache'})
  with urlopen(req,timeout=35) as z:return z.status,z.read().decode('utf-8')
 for attempt in range(20):
  try:
   status,public=get('/'+q);pp=json.loads(RX.search(public)[1]);good=compact_financial(pp)==compact_financial(lp)
   if good:break
  except Exception:good=False
  time.sleep(12)
 else:raise ValueError('Pages aún no sirve el nuevo corte; no marcar verificado')
 localimg={p['sku']:p.get('imageUrl') for p in lp};assert localimg=={p['sku']:p.get('imageUrl') for p in pp}
 src=re.search(r'<script src="(/assets/catalogo-publicado\.js[^\"]*)',public)[1]
 _,jst=get(src);pub=json.loads(jst.split('=',1)[1].strip().removesuffix(';'))
 times={p['sku']:pub['productos'].get(p['sku'],{}).get('actualizadoEn','') for p in pp}
 changed={c['sku'] for c in r['productos']};first=sorted([p for p in pp if p['stock']>0],key=lambda p:times[p['sku']],reverse=True)
 assert all(p['sku'] in changed for p in first[:min(24,sum(p['stock']>0 and p['sku']in changed for p in pp))])
 def pagecheck(c):
  sku=c['sku'];status,text=get('/productos/'+slugs[sku]+'/'+q);s=json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',text,re.S)[1]);m=re.search(r'PVP\s+\$([0-9.,]+)',text)
  good=status==200 and s.get('sku')==sku and cents(s['offers']['price'])==cents(source[sku]['promo']) and m and cents(m[1].replace(',','.'))==cents(source[sku]['pvp'])
  if not good:raise ValueError('Ficha pública no coincide: '+sku)
  return {'sku':sku,'http':status,'promo':source[sku]['promo'],'pvp':source[sku]['pvp'],'url':PUBLIC+'/productos/'+slugs[sku]+'/'}
 with ThreadPoolExecutor(max_workers=8) as pool:verified=list(pool.map(pagecheck,r['productos']))
 report={'estado':'PUBLICADO_VERIFICADO','fecha_verificacion':datetime.now(timezone.utc).isoformat(),'source_sha256':x['source_sha256'],'catalogo_verificado':len(pp),'fichas_verificadas':len(verified),'primeros_sku':[p['sku'] for p in first[:12]],'imagenes_catalogo_intactas':True,'resultados':verified}
 out('reportes/sincronizacion-593-2026-10-10-publico.json',report);print(js({k:report[k] for k in ('estado','catalogo_verificado','fichas_verificadas','primeros_sku')}))

if __name__=='__main__':
 if '--verify-public'in sys.argv:verify_public()
 elif '--apply'in sys.argv:apply()
 else:raise SystemExit('Usar --apply o --verify-public')
