import json,hashlib,subprocess,re,copy
from pathlib import Path
W=Path('work/produccion123');R=Path('reportes/continuacion-123');E={'CHIP001','CHIP002','CHIP003','CHIP004'};read=lambda p:json.loads(Path(p).read_text());write=lambda p,x:Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
h=read(R/'http-publicacion.json');m=read(R/'qa-publica/movil.json');assert h['publicados']==4 and h['errores']==h['pendientes']==0;assert m['resumen']['verificados']==4 and not m['errores_herramienta'];assert read(R/'recursos-http.json')['verificados']==12
for s in E:
 x=next(x for x in h['resultados']if x['sku']==s);v=next(x for x in m['resultados']if x['sku']==s);assert x['sha256_ficha']==v['sha256_html']==sha(v['archivo_html']);assert v['estado']=='VERIFICADO'and not v['errores']and all(v['verificaciones'].values());assert v['escritorio']['imagen_cargada']and v['escritorio']['sin_desbordamiento_horizontal']
immutable=W/'prueba-http-inmutable.json'
if immutable.exists():assert read(immutable)['sha256']==sha(R/'http-publicacion.json')
else:write(immutable,{'archivo':str(R/'http-publicacion.json'),'sha256':sha(R/'http-publicacion.json'),'skus':sorted(E)})
assert not(W/'payload-registrado.json').exists(),'Ya preparado; no renovar fechas.'
payloadFile=Path('assets/catalogo-publicado.js');baseline=json.loads(payloadFile.read_text().split('=',1)[1].strip().rstrip(';'));prior=read('importacion/actualizaciones-sku.json');write(W/'registro-anterior.json',prior);write(W/'payload-anterior.json',baseline)
subprocess.run(['python','scripts/registrar-actualizaciones.py','--reporte-http',str(R/'http-publicacion.json'),'--catalogo-anterior',str(R/'catalogo-publico-anterior.json'),'--reporte',str(R/'actualizaciones.json'),'--aplicar'],check=True)
result=read(R/'actualizaciones.json');assert result['resumen']=={'incorporado':4},result
new=read('importacion/actualizaciones-sku.json');assert all(new['productos'][s]==v for s,v in prior['productos'].items()if s not in E);assert all(new['productos'][s]['tipoCambio']=='nuevo'for s in E)
created=json.loads(payloadFile.read_text().split('=',1)[1].strip().rstrip(';'));out=copy.deepcopy(baseline)
for s in E:out['productos'][s]=created['productos'][s]
assert all(out['productos'][s]==v for s,v in baseline['productos'].items()if s not in E)
payloadFile.write_text('window.CONECTATECH_CATALOGO='+json.dumps(out,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+';\n');digest=sha(payloadFile);p=Path('index.html');raw=p.read_text();raw,n=re.subn(r'(/assets/catalogo-publicado\.js\?v=)[a-zA-Z0-9_-]+',lambda m:m[1]+digest[:12],raw);assert n==1;p.write_text(raw);write(W/'payload-registrado.json',{'sku':sorted(E),'registrosAjenosConservados':len(set(baseline['productos'])-E),'sha256':digest,'fechaHTTP':h['fecha']})
rows=[];resources=read(W/'recursos.json')
for s in sorted(E):
 p=Path('importacion/contratos',s+'.json');c=read(p);v=next(x for x in m['resultados']if x['sku']==s);c['validaciones']['movil']=v;c['validaciones']['publicacion_http']={'estado':'VERIFICADO','fecha':h['fecha'],'archivo':str(R/'http-publicacion.json'),'reporte':str(R/'http-publicacion.json'),'sha256':sha(R/'http-publicacion.json'),'sku':s};c['estado_publicacion']='PUBLICADO_VERIFICADO';c['fecha_verificacion']=h['fecha'];write(p,c);rows.append({'sku':s,'estado':'publicado_verificado','tipo':'nuevo','revision_regla':resources[s]['proceso']['revision_regla'],'pendientes':[],'url':c['url_publica']})
 q=Path('importacion/cola-compartida/fotografia-resultados',s+'.json');d=read(q)if q.exists()else{};key='produccion_121';assert key not in d;d[key]={'sku':s,'estado':'PUBLICADO_VERIFICADO','tipo':'PRIMERA_PORTADA_Y_FICHA_COMPLETA','publicacion_real_verificada':True,'fecha_primera_verificacion_publica':h['fecha'],'imagen_actual':c['imagen_principal'],'informe_http':str(R/'http-publicacion.json'),'sha256_informe_http':sha(R/'http-publicacion.json'),'nota':'Conservar maestros y fotos de referencia. No renovar fechas por reverificación. Prioridad pendiente de comprobar en catálogo público.'};write(q,d)
write(R/'resultados-sku.json',{'fecha':h['fecha'],'nuevosSKU':0,'nuevasPortadas':4,'correcciones':0,'productos':rows});subprocess.run(['python','scripts/registrar-resultados-lote.py','--reporte',str(R/'resultados-sku.json')],check=True)
subprocess.run(['python','scripts/registrar-editorial-publicado.py'],check=True,env={**__import__('os').environ,'LOTE_EDITORIAL_VERIFICAR':'123'})
subprocess.run(['python','scripts/preparar-editorial-publicacion.py'],check=True)
active=read('importacion/lote-activo.json');assert active['lote']=='continuacion-123';active['estado']='REGISTRO_TRAS_HTTP_CHROMIUM_PENDIENTE_CATALOGO_PUBLICO';write('importacion/lote-activo.json',active)
write(R/'registro-fase-publicacion.json',{'estado':'REGISTRO_PREPARADO_TRAS_HTTP_CHROMIUM','fichasCompletadasConPrimeraPortada':4,'nuevosSKU':0,'fuenteHTTP':{'archivo':str(R/'http-publicacion.json'),'sha256':sha(R/'http-publicacion.json')},'fechaReal':h['fecha'],'noEsCierreHastaCatalogoPublicoVerificado':True,'registrosFotograficosAjenosConservados':True,'costoAdicional':0})
p=R/'publicados.html';raw=p.read_text();raw,n=re.subn(r'<p id="estado">.*?</p>','<p id="estado">Cuatro fichas publicadas y verificadas por HTTP y Chromium, en móvil y escritorio; doce WebP comprobados por SHA-256. Precios, existencias y URLs conservados. CHIP003 es Tigo con empaque Tuenti declarado. <a href="http-publicacion.json">Prueba HTTP</a> · <a href="qa-publica/movil.json">Chromium</a>.</p>',raw);assert n==1;p.write_text(raw)
print('4 primeras portadas públicas verificadas. Registro real preparado; comprobar prioridad pública antes de cerrar.')
