"""Reutiliza el render y motor del PR87 en copias de revisión; no modifica producción."""
import json,re,html,csv,hashlib
from pathlib import Path
root=Path('.');out=root/'revision/calibracion-editorial-8';cfg=json.loads(Path('importacion/editorial/calibracion-8.json').read_text());native=Path('index.html').read_text();rx=r'const products=(\[[\s\S]*?\]);\s*\n';allp=json.loads(re.search(rx,native)[1]);selected=[next(p for p in allp if p['sku']==s) for s in cfg['productos']]
# Reusar exclusivamente el motor ya comprobado; NO copiar la rama87 ni sus20propuestas.
engine=Path('scripts/editorial/tarjetas-pro.js').read_text();css=Path('scripts/editorial/tarjetas-pro.css').read_text();data={'activo':True,'productos':{s:e for s,e in cfg['productos'].items() if e['estado']=='MEJORAR TÍTULO'}}
for name in ['antes','despues']:
 source=re.sub(rx,lambda m:'const products='+json.dumps(selected,ensure_ascii=False,separators=(',',':'))+';\n',native,count=1)
 if name=='despues':
  source=source.replace('<script>','<style>'+css+'</style><script>window.CONECTATECH_TITULOS_PRO_DATOS='+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+';</script><script>'+engine+'</script><script>',1)
  source=source.replace('class="card ct-compact-card" data-sku=', 'class="card ct-compact-card${window.CONECTATECH_TITULOS_PRO.entry(p)?\' ct-pro-card\':\'\'}" data-sku=')
  source=source.replace('<a class="name product-link" href="${esc(productHref(p))}">${esc(p.name)}</a>', '${window.CONECTATECH_TITULOS_PRO.nameHTML(p,productHref(p))||`<a class="name product-link" href="${esc(productHref(p))}">${esc(p.name)}</a>`}')
  source=source.replace('${esc(p.sku)}</div>', '${esc(p.sku)}${window.CONECTATECH_TITULOS_PRO.conditionText(p)?\' · \'+esc(window.CONECTATECH_TITULOS_PRO.conditionText(p)):\'\'}</div>',1)
 source=source.replace('<head>','<head><base href="https://conectatech-ec.github.io/">',1)
 def asset_css(m):return '<style>'+Path(m[1].split('?')[0].lstrip('/')).read_text()+'</style>'
 def asset_script(m):return '<script>'+Path(m[1].split('?')[0].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>'
 source=re.sub(r'<link rel="stylesheet" href="(/assets/[^\"]+)">',asset_css,source);source=re.sub(r'<script src="(/assets/[^\"]+)"\s*></script>',asset_script,source)
 source=source.replace('</head>','<style>.ct-hero,.ct-gift-unified,.trustbar,.ct-discover,.ct-commerce-strip,#destacados{display:none!important}body{scroll-behavior:auto}</style></head>')
 (out/f'catalogo-{name}.html').write_text(source)
rows=[]
for sku,e in cfg['productos'].items():
 p=next(p for p in selected if p['sku']==sku);rows.append({'SKU':sku,'Decisión':e['estado'],'Antes':e['tituloActual'],'Después':e['titulo'],'Subtítulo':e['subtitulo'],'Causa':e['causa'],'Promo contado':p['promo'],'PVP':p['pvp'],'Stock':p['stock']})
with (out/'antes-despues.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
(out/'datos.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
trs=''.join('<tr>'+''.join('<td>'+html.escape(str(r[k]))+'</td>' for k in ['SKU','Decisión','Antes','Después','Subtítulo'])+'</tr>' for r in rows)
(out/'index.html').write_text('''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CONECTATECH · calibración editorial8</title><style>body{font:15px/1.5 Arial;margin:24px;color:#152e4c;background:#f3f6fa}h1{font-size:26px}button,select{padding:9px;margin:8px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}iframe{border:1px solid #d4dfeb;width:100%;height:1100px;background:white}table{border-collapse:collapse;background:white}td,th{padding:10px;border:1px solid #ccd7e2;text-align:left;vertical-align:top}.scroll{overflow:auto}@media(max-width:800px){section{grid-template-columns:1fr}}</style><h1>CONECTATECH · calibración comercial de8SKU</h1><p>5mejoras selectivas y3títulos conservados. Criterio: reconocer el producto y su utilidad; diferenciadores verificados,modelo opcional,subtítulo útil. Sin publicación todavía: única validación solicitada por Dirección.</p><p><a href="comparativa-movil.png">Antes/después móvil</a> · <a href="comparativa-escritorio.png">Antes/después escritorio</a> · <a href="antes-despues.csv">Tabla CSV</a></p><section><div><h2>ANTES · web actual</h2><iframe src="catalogo-antes.html"></iframe></div><div><h2>DESPUÉS · propuesta selectiva</h2><iframe src="catalogo-despues.html"></iframe></div></section><h2>Ocho decisiones editoriales</h2><div class="scroll"><table><tr><th>SKU</th><th>Decisión</th><th>Antes</th><th>Después</th><th>Subtítulo</th></tr>'''+trs+'''</table></div><p>MOUS014 es inalámbrico por respuesta del propietario, aunque su URL593 histórica diga alámbrico. La URL se conserva. Los productos compatibles se identifican como De terceros y mantienen su clasificación completa antes de comprar. Modelos y nombres originales siguen en datos/ficha/búsqueda.</p><p>Lotes posteriores: hasta30SKU explícitos,sólo tras validar este criterio; sin nuevas aprobaciones rutinarias para cambios comprobados. Conservar CORRECTO y bloquear REVISAR IDENTIDAD. Cola compartida: importacion/cola-compartida/fotografia-solicitudes-editorial.json. No se editan fotografías.</p></html>''')
print('Ocho tarjetas nativas preparadas desde main actual; 5propuestas y3conservadas. Sin cambios en index ni fichas.')
