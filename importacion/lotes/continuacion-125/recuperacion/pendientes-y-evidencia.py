import json,html,csv
from pathlib import Path
W=Path('work/produccion125');R=Path('reportes/continuacion-125');read=lambda p:json.loads(Path(p).read_text());write=lambda p,d:Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
h=read(R/'http-publicacion.json');m=read(R/'qa-publica/movil.json');assert h['publicados']==1 and h['errores']==0 and m['resumen']['verificados']==1
d=read('reportes/continuacion-123/pendientes.json');originalDate=d['fecha'];assert len([x for x in d['productos']if x['sku']=='TECL028'])==1;d['productos']=[x for x in d['productos']if x['sku']!='TECL028'];assert len(d['productos'])==118 and len(d['productosNuevos'])==9
d.update(fecha=h['fecha'],ultimaBusquedaFotosRegistrada=originalDate,totalPrioritario=127,historicos=118,conFotoInsuficiente=15,nota='TECL028 completado y verificado públicamente. Nueve nuevos sin coincidencias permanecen pendientes por instrucción del propietario. Estuches excluidos.');write(R/'pendientes.json',d)
rows=d['productosNuevos']+d['productos']
with(R/'pendientes-codigo-titulo-motivo.csv').open('w',newline='')as f:
 w=csv.DictWriter(f,fieldnames=['sku','titulo','motivo'],extrasaction='ignore');w.writeheader();w.writerows(rows)
table=''.join('<tr><td>'+html.escape(x['sku'])+'</td><td>'+html.escape(x['titulo'])+'</td><td>'+html.escape(x['motivo'])+'</td></tr>'for x in rows)
(R/'pendientes.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pendientes CONECTATECH</title><style>body{font:15px system-ui;margin:20px;color:#14263c}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}table{border-collapse:collapse}</style><h1>127 SKU pendientes · estuches excluidos</h1><p>TECL028 completado y verificado públicamente. 86 sin foto localizada,15 por evidencia insuficiente y26 reservas de herramienta sin reintentar. Nueve nuevos sin coincidencias siguen pendientes.</p><table><tr><th>SKU</th><th>Título</th><th>Pendiente</th></tr>'+table+'</table></html>\n')
research={
 'TELF015':{'estado':'IDENTIDAD_CONTRASTADA_PENDIENTE_IMAGEN','modeloCaja':'KM4','varianteCaja':'Turquoise Green;256GB;4GB físicos','ramExtendidaDeclarada':'4GB','fuente':'https://www.tecno-mobile.com/ae/phones/tech-specs/techspecs/spark-go-2/','referenciaVisualOficial':'https://d13pvy8xd75yde.cloudfront.net/global/sparkgo2/KM4-green.png','pendiente':'Descarga CDN bloqueada403 por política de destinos del entorno; no eludir. Falta cotejo visual completo del cuerpo.','sinCambiosEnFichaComercial':True},
 'MONI002':{'estado':'MODELO_CAJA_IDENTIFICADO_PENDIENTE_VISTA','modeloCaja':'J019','fuenteCajaDrive':'https://drive.google.com/file/d/1LjwE_Qxw5gH5tymfyjtj3grJ3Q7lrQTb/view','fuenteWeb':'https://tienda.digitalserver.com.ec/4901/product/16920','pendiente':'Frontal ybase completos del modelo exacto. No inferir tipo de panel ni hardware por otro monitorONE19 similar.','sinCambiosEnFichaComercial':True}}
for sku,entry in research.items():
 p=Path('importacion/cola-compartida/fotografia-resultados')/(sku+'.json');current=read(p)if p.exists()else{};assert 'investigacion_web_produccion125'not in current;current['investigacion_web_produccion125']=entry;write(p,current)
print('127pendientes,15conreferenciasinsuficientes. Dosnotas de investigación en namespaces independientes;0fichas ajenas editadas.')
