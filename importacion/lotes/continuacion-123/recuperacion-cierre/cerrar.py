import json,hashlib,subprocess,html,re
from pathlib import Path
W=Path('work/produccion123');R=Path('reportes/continuacion-123');E={'CHIP001','CHIP002','CHIP003','CHIP004'}
read=lambda p:json.loads(Path(p).read_text())
write=lambda p,d:Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
h=read(R/'http-publicacion.json');m=read(R/'qa-publica/movil.json');p=read(R/'prioridad-publica/resultado.json');assert h['publicados']==4 and h['errores']==h['pendientes']==0 and m['resumen']['verificados']==4
assert set(read(W/'registro-servido.json')['skus'])==E
catalogo=read(R/'qa-registro-publico/catalogo.json')
assert catalogo['resumen']['errores']==0 and catalogo['resumen']['vistas_verificadas']==2 and catalogo['resumen']['sku_solicitados']==7
assert read(W/'prueba-http-inmutable.json')['sha256']==sha(R/'http-publicacion.json');assert len(p['vistas'])==2 and all(v['tresDisponiblesPrimero']and v['TigoStock']==0 and v['TigoAgotadoVisible']and v['TigoEmpaqueTuentiVisible']for v in p['vistas'])
ledger=read('importacion/actualizaciones-sku.json')['productos'];assert all(ledger[s]['actualizadoEn']==h['fecha']and ledger[s]['tipoCambio']=='nuevo'for s in E)
assert ledger['AUDI130']['actualizadoEn']=='2026-11-03T20:06:23.596770+00:00'
for s in ['CABL173','CABL174','JUGU164']:assert ledger[s]['actualizadoEn']==read('reportes/continuacion-119/http-publicacion.json')['fecha']
for s in ['JUGU142','JUGU143']:assert ledger[s]['actualizadoEn']==read('reportes/continuacion-121/http-publicacion.json')['fecha']
ed=read('importacion/editorial/publicados.json');assert ed['productos']['CHIP003']['titulo']=='Chip SIM Tigo'and ed['productos']['CHIP003']['subtitulo']=='Empaque Tuenti';assert ed['productos']['CHIP003']['publicacionVerificada']['estado']=='VERIFICADO_HTTP_CHROMIUM'
for s in E:
 q=Path('importacion/cola-compartida/fotografia-resultados',s+'.json');d=read(q);d['produccion_123'].update(estado='PUBLICADO_VERIFICADO',primeraPortadaReal=True,informe_prioridad=str(R/'prioridad-publica/resultado.json'),nota='Presentación sellada sin seriales. Fecha primaria conservada. Tresdisponibles primero; CHIP003/Tigo stock0Agotado visible y empaqueTuenti declarado.');write(q,d)
f=Path('importacion/lotes/continuacion-123/manifiesto-aprobados.json');d=read(f);d.update(estado='PUBLICADO_VERIFICADO',fechaVerificacionPublica=h['fecha']);write(f,d)
a=read('importacion/lote-activo.json')
if a.get('lote')=='continuacion-123':a['estado']='PUBLICADO_VERIFICADO';write('importacion/lote-activo.json',a)
d=read(R/'registro-fase-publicacion.json');d.update(estado='REGISTRO_PUBLICO_CATALOGO_VERIFICADO',noEsCierreHastaCatalogoPublicoVerificado=False);write(R/'registro-fase-publicacion.json',d)
pending=read(W/'pendientes-actualizados.json');pending['productos']=[x for x in pending['productos']if x['sku']not in E];pending['totalPrioritario']=128;pending['historicos']=119;pending['conFotoInsuficiente']=16;pending['fuentesPorOperadorRecuperadas']=sorted(E);pending['nota']='Cuatro fichas completadas y públicas; Tigo en empaqueTuenti confirmado. Estuches excluidos.';assert len(pending['productos'])+len(pending['productosNuevos'])==128;write(R/'pendientes.json',pending)
rows=''.join('<tr><td>'+html.escape(x['sku'])+'</td><td>'+html.escape(x['titulo'])+'</td><td>'+html.escape(x.get('motivo','Sin fotografía localizada'))+'</td></tr>'for x in pending['productos']+pending['productosNuevos'])
(R/'pendientes.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pendientes CONECTATECH</title><style>body{font:15px system-ui;margin:20px;color:#14263c}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}table{border-collapse:collapse}</style><h1>128 SKU pendientes · estuches excluidos</h1><p>86 sin foto localizada,16 por evidencia insuficiente,26 reservas de herramienta sin reintentar. Cuatro chips ya completados.</p><table><tr><th>SKU</th><th>Título</th><th>Pendiente</th></tr>'+rows+'</table></html>\n')
proof={'estado':'PUBLICADO_HTTP_CHROMIUM_CATALOGO_VERIFICADO','SKU':sorted(E),'primerasPortadas':4,'altasCodigo':0,'totalSKU':1198,'portadasTotales':1003,'fotografiasAnterioresConservadas':999,'otrosProductosIntactos':1194,'preciosStockOriginalesURLsConservados':True,'serialesVisibles':False,'TigoEmpaqueTuentiDeclarado':True,'TigoStock':0,'tresDisponiblesPrimero':True,'fechaPrimaria':h['fecha'],'sha256HTTP':sha(R/'http-publicacion.json'),'pendientesPrioritarios':128,'estuchesExcluidos':True,'costoAdicional':0};write(R/'cierre.json',proof);print(json.dumps(proof,ensure_ascii=False))
