import json,hashlib,subprocess
from pathlib import Path
W=Path('work/produccion125');R=Path('reportes/continuacion-125');S='TECL028'
read=lambda p:json.loads(Path(p).read_text())
write=lambda p,d:Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
h=read(R/'http-publicacion.json');m=read(R/'qa-publica/movil.json');p=read(R/'prioridad-publica/resultado.json');c=read(R/'qa-registro-publico/catalogo.json')
assert h['publicados']==1 and h['errores']==h['pendientes']==0
assert m['resumen']['verificados']==1 and c['resumen']['errores']==0
assert c['resumen']['vistas_verificadas']==2 and c['resumen']['sku_solicitados']==5
assert read(W/'prueba-http-inmutable.json')['sha256']==sha(R/'http-publicacion.json')
assert read(W/'registro-servido.json')['registroExactoVerificado']
assert len(p['vistas'])==2 and all(v['enPrimeraPagina'] and v['fechaPrimariaConservada'] and v['tituloModeloImagenVerificados'] and v['ordenRealVerificado']for v in p['vistas'])
assert read('importacion/actualizaciones-sku.json')['productos'][S]['actualizadoEn']==h['fecha']
assert read(R/'pendientes.json')['totalPrioritario']==127
proof={'estado':'PUBLICADO_HTTP_CHROMIUM_CATALOGO_VERIFICADO','SKU':[S],'primerasPortadas':1,'altasCodigo':0,'preciosStockOriginalesURLsConservados':True,'fechaPrimaria':h['fecha'],'sha256HTTP':sha(R/'http-publicacion.json'),'posicionPublica':[{k:v[k]for k in ['ancho','posicionReal','enPrimeraPagina']}for v in p['vistas']],'pendientesPrioritarios':127,'estuchesExcluidos':True,'costoAdicional':0,'PRs':{'recursos':334,'activacion':336,'registro':339},'mergeRegistro':'cd12eb39d3f895e3cb4cd78fee584c346d9edc3b'}
proof['ordenRevisado']='Nuevos y actualizados'
proof['entradaComercialConservada']=[{'ancho':v['ancho'],**v['presentacionInicial']}for v in p['vistas']]
proof['notaCompatibilidadQA']='PR340 cambió la entrada a Recomendados. Ver contexto.json e informe anterior conservado; QA final compara con main vigente y selecciona explícitamente Nuevos y actualizados. Script de producción intacto.'
write(R/'cierre.json',proof)
d=read(R/'registro-fase-publicacion.json');d.update(estado='REGISTRO_PUBLICO_CATALOGO_VERIFICADO',noEsCierreHastaCatalogoPublicoVerificado=False);write(R/'registro-fase-publicacion.json',d)
q=Path('importacion/cola-compartida/fotografia-resultados/TECL028.json');d=read(q);d['produccion_125'].update(estado='PUBLICADO_VERIFICADO',informe_prioridad=str(R/'prioridad-publica/resultado.json'),nota='Primera portada y ficha completa verificadas en móvil y escritorio. Tercero en Nuevos y actualizados. Entrada Recomendados ajena conservada; fecha primaria conservada sin afectar fechas ajenas.');write(q,d)
f=Path('importacion/lotes/continuacion-125/manifiesto-aprobados.json');d=read(f);d.update(estado='PUBLICADO_VERIFICADO',fechaVerificacionPublica=h['fecha']);write(f,d)
d=read(W/'ESTADO.json');d.update(fase='CERRADO_PUBLICADO_VERIFICADO',registroMerge=proof['mergeRegistro'],registroCI=read(W/'ci-registro.json')['id'],posicionPublica=proof['posicionPublica'],siguiente='Conservar maestros y fechas. Pendientes127 requieren material/evidencia; estuchesexcluidos. Ver pendientes.html y fuentes-web.json.');write(W/'ESTADO.json',d)
v=read(R/'revision-visual.json');v.update(estado='APROBADO_VISUAL_Y_PUBLICADO_VERIFICADO',pruebaPublica=str(R/'prioridad-publica/resultado.json'),nota='Captura pública móvil inspeccionada: título/modelo, fotografía, precio y disponibilidad correctos.');write(R/'revision-visual.json',v)
print(json.dumps(proof,ensure_ascii=False))
