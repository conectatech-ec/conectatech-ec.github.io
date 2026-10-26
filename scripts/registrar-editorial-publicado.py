"""Fecha únicamente cambios editoriales ya comprobados en web pública."""
import json,hashlib,re,os
from pathlib import Path
cfgPath=Path('importacion/editorial/publicados.json');cfg=json.loads(cfgPath.read_text());lote=os.environ.get('LOTE_EDITORIAL_VERIFICAR',cfg['loteActual']);assert re.fullmatch(r'[0-9]{3}(?:r[0-9]+)?',lote);reportPath=Path('reportes/editorial-selectivo/lote-'+lote+'/publicacion-http-chromium.json');raw=reportPath.read_bytes();report=json.loads(raw);manifestPath=Path('importacion/editorial/lotes/lote-'+lote+'.json');manifest=json.loads(manifestPath.read_text())
assert report['estado']=='VERIFICADO_HTTP_CHROMIUM' and report['base']=='https://conectatech-ec.github.io'
assert sorted(report['skus'])==sorted(manifest['skus']) and not report['errores']
assert report['objetosOriginales1170Identicos'] and report['busquedaPorTituloNuevoOriginal593Modelo']
fichas=report.get('fichasVerificadas',report.get('fichasSinCambios',[]));assert len(fichas)==len(manifest['skus']) and all(e['http']==200 for e in fichas)
updated=[]
for sku in manifest['skus']:
 e=cfg['productos'][sku];assert not sku.startswith(('TELF','TABL'))
 content={k:e[k] for k in ['titulo','subtitulo','condicionTarjeta']};fingerprint=hashlib.sha256(json.dumps(content,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if e.get('publicacionVerificada',{}):
  assert e['publicacionVerificada']['huellaTitulo']==fingerprint,'Cambio diferente requiere nueva publicación verificada: '+sku
  continue
 e['publicacionVerificada']={'estado':'VERIFICADO_HTTP_CHROMIUM','fecha':report['fecha'],'informe':str(reportPath),'sha256Informe':hashlib.sha256(raw).hexdigest(),'huellaTitulo':fingerprint};updated.append(sku)
cfgPath.write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n');manifest['estado']='PUBLICADO_VERIFICADO';manifest['fechaVerificacionPublica']=report['fecha'];manifestPath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Fechas verificadas nuevas:',len(updated),'; una reverificación no renueva fechas.')
