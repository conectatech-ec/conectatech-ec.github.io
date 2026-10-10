#!/usr/bin/env python3
"""Producción por SKU: originales inmutables, revisión de identidad y reglas persistentes."""
import argparse,csv,hashlib,importlib.util,io,json,re,time
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from PIL import Image,ImageOps,ImageEnhance,ImageFilter,ImageDraw,ImageChops
from reglas_sku import rule,compatible
from premium_guard import validate as validate_premium_approval
ROOT=Path(__file__).resolve().parents[1]
_spec=importlib.util.spec_from_file_location('editorial',ROOT/'scripts/importar-productos.py')
editorial=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(editorial)
_contract_spec=importlib.util.spec_from_file_location('contratos',ROOT/'scripts/validar-contrato.py')
contracts=importlib.util.module_from_spec(_contract_spec);_contract_spec.loader.exec_module(contracts)
sha=lambda b:hashlib.sha256(b).hexdigest()
PIPELINE_VERSION=2

def fingerprint(item, r):
    return sha(json.dumps({'version':PIPELINE_VERSION,'entrada':item,'regla':r},sort_keys=True,ensure_ascii=False).encode())

def intact(root, photo):
    try:
        return all(sha(safe(root,v['url'].lstrip('/')).read_bytes())==v['sha256'] for v in photo['versiones'].values())
    except (OSError,KeyError,ValueError):
        return False

def safe(root,path):
    p=(root/path).resolve()
    if not p.is_relative_to(root.resolve()):raise ValueError('Ruta fuera del repositorio')
    return p

def dhash(im):
    pixels=list(im.convert('L').resize((9,8)).get_flattened_data())
    return sum((pixels[y*9+x]>pixels[y*9+x+1])<<(y*8+x) for y in range(8) for x in range(8))

def process(root, sku, item, r):
    if item.get('modelo_revisado') is not True:raise ValueError('Modelo/variante sin revisión')
    if item.get('revision_regla')!=r['revision']:raise ValueError('Revisar foto contra la regla vigente')
    if item.get('calidad_revisada') is not True:raise ValueError('Foco, texto y color pendientes de revisión visual')
    if item.get('sin_datos_privados') is not True:raise ValueError('Revisar IMEI/serie y datos privados')
    if not item.get('fuente'):raise ValueError('Fuente de imagen no documentada')
    slot=item['posicion']
    if slot not in (1,2,3,4):raise ValueError('Posición debe ser 1–4')
    if not compatible(r,item,slot==1):raise ValueError('La fotografía contradice la presentación: '+r['presentacion'])
    if item.get('fondo_aprobado') is not True:raise ValueError('Fondo distractor: requiere recorte o edición revisados')
    data=safe(root,item['archivo']).read_bytes()
    if len(data)>20*1024*1024:raise ValueError('Imagen mayor de 20 MB')
    if sha(data)!=item['sha256']:raise ValueError('El original cambió; repetir revisión')
    with Image.open(io.BytesIO(data)) as src:
        if src.format not in ('PNG','JPEG','WEBP') or getattr(src,'n_frames',1)!=1:raise ValueError('Formato no válido')
        if src.width*src.height>40_000_000:raise ValueError('Más de 40 megapíxeles')
        original_size=list(src.size);ext={'PNG':'.png','JPEG':'.jpg','WEBP':'.webp'}[src.format]
        im=ImageOps.exif_transpose(src).convert('RGBA')
    polygon=item.get('silueta_revisada')
    if polygon:
        if len(polygon)<3 or any(len(pt)!=2 or any(not isinstance(v,int) for v in pt) or not(0<=pt[0]<im.width and 0<=pt[1]<im.height) for pt in polygon):raise ValueError('Silueta fuera de imagen')
        mask=Image.new('L',im.size,0);ImageDraw.Draw(mask).polygon([tuple(pt) for pt in polygon],fill=255)
        im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
    crop=item.get('recorte')
    if crop:
        if len(crop)!=4 or any(not isinstance(v,int) for v in crop):raise ValueError('Recorte inválido')
        x,y,x2,y2=crop
        if not(0<=x<x2<=im.width and 0<=y<y2<=im.height):raise ValueError('Recorte fuera de imagen')
        im=im.crop(crop)
    if min(im.size)<500 or max(im.size)<1000:raise ValueError('Resolución útil insuficiente; no se amplía')
    # Nunca se agranda el producto. El lienzo uniforme no simula detalle.
    im.thumbnail((1008,1008),Image.Resampling.LANCZOS)
    bg=Image.new('RGB',(1200,1200),'white');bg.paste(im,((1200-im.width)//2,(1200-im.height)//2),im)
    # Solo ajustes medidos y explícitos. Identidad y texto no se reconstruyen.
    params=item.get('ajustes',{})
    if set(params)-{'brillo','contraste','nitidez'}:raise ValueError('Ajuste no admitido')
    for k,enhancer in [('brillo',ImageEnhance.Brightness),('contraste',ImageEnhance.Contrast),('nitidez',ImageEnhance.Sharpness)]:
        v=params.get(k,1.0)
        if not isinstance(v,(int,float)) or not 0.95<=v<=1.08:raise ValueError('Corrección fuera de límites')
        if v!=1:bg=enhancer(bg).enhance(v)
    outputs={};versions={}
    for size in (1200,600,300):
        target=bg if size==1200 else bg.resize((size,size),Image.Resampling.LANCZOS)
        buf=io.BytesIO();target.save(buf,'WEBP',quality=90,method=6)
        stem=f'{sku}-{slot:02d}'+('' if size==1200 else f'-{size}')
        rel=f'imagenes/{sku.lower()}/{stem}.webp';payload=buf.getvalue();outputs[rel]=payload
        versions[str(size)]={'url':'/'+rel,'sha256':sha(payload),'bytes':len(payload),'ancho':size,'alto':size}
    original=f'imagenes/{sku.lower()}/original-{sha(data)[:16]}{ext}'
    outputs[original]=data
    result={'posicion':slot,'contiene_caja':item['contiene_caja'],'referencia_fabricante':item.get('referencia_fabricante',False),'referencia_distribuidor':item.get('referencia_distribuidor',False),
            'fuente':item['fuente'],'original':'/'+original,'sha256_original':sha(data),'resolucion_original':original_size,
            'resolucion_util':list(im.size),'versiones':versions,'revision_regla':r['revision'],
            'revision_visual':item.get('nota_revision',''),'recorte':crop,'silueta_revisada':polygon,'ajustes':params,'dhash':f'{dhash(bg):016x}',
            'huella_proceso':fingerprint(item,r),'version_proceso':PIPELINE_VERSION}
    if item.get('revision_marcas'):
        result['revision_marcas']=item['revision_marcas']
    return result,outputs

def run(args):
    start=time.perf_counter();root=Path(args.root).resolve();html,products=editorial.read_catalog(root)
    finance=editorial.financial(products);by={p['sku']:p for p in products};aliases=json.loads((root/'importacion/alias-sku.json').read_text())
    seo=json.loads((root/'seo-contenido.json').read_text());slugs=json.loads((root/'seo-pages.json').read_text())
    manifest=json.loads(safe(root,args.manifiesto).read_text());skus=manifest['skus'];sources=manifest['imagenes']
    if args.aplicar:validate_premium_approval(root,manifest)
    contract_mode=manifest.get('version',1)>=3
    contract_context=contracts.context(root) if contract_mode else None
    sku_counts=Counter(aliases.get(raw,raw) for raw in skus)
    registry_path=root/'importacion/medios.json';media=json.loads(registry_path.read_text()) if registry_path.exists() else {}
    report={'fecha':datetime.now(timezone.utc).isoformat(),'lote':args.manifiesto,'modo':'aplicar' if args.aplicar else 'simular',
            'productos':[],'errores':[],'publicados':[],'duplicados':[],'similares':[]}
    writes={};seen=set();hashes={};changed_photos=set();reused=0
    for existing_sku,entry in media.items():
        for photo in entry.get('imagenes',[]):hashes.setdefault(photo['sha256_original'],set()).add(existing_sku)
    # Preflight de duplicados cruzados antes de aplicar cualquier SKU.
    for raw,items in sources.items():
        sku=aliases.get(raw,raw)
        for i in items:
            if i.get('sha256'):hashes.setdefault(i['sha256'],set()).add(sku)
    for raw in skus:
        sku=aliases.get(raw,raw)
        if sku not in by or sku in seen or (contract_mode and sku_counts[sku]>1):
            report['errores'].append({'sku':raw,'motivo':'SKU desconocido o duplicado'});continue
        seen.add(sku);p=by[sku];r=rule(sku,root);issues=[];rowwrites={};slots=set()
        old=media.get(sku)
        photos=[i for i in (old or {}).get('imagenes',[]) if old.get('revision_regla')==r['revision'] and compatible(r,i,i['posicion']==1) and intact(root,i)]
        approval=manifest.get('aprobaciones',{}).get(sku,{})
        historic_hashes={i.get('sha256_original') for i in (old or {}).get('imagenes',[])}
        new_sources=any(i.get('sha256') not in historic_hashes for i in sources.get(sku,sources.get(raw,[])))
        blocked=(manifest.get('version',1)>=2 or new_sources) and not (approval.get('estado')=='APROBADO' and approval.get('identidad_verificada') is True and approval.get('uso_comercial_permitido') is True and approval.get('ficha_verificada') is True)
        if blocked:issues.append('Publicación bloqueada: identidad, ficha o permiso de uso pendientes')
        candidates=sources.get(sku,sources.get(raw,[]))
        contract=None;contract_errors=[]
        if contract_mode:
            try:
                contract=contracts.load_contract(root,manifest,sku)
                contract_errors=contracts.validate(root,contract,sku,r,candidates,contract_context,manifest.get('categorias_comerciales'),require_mobile=False)
            except (ValueError,OSError,KeyError,TypeError) as exc:
                contract_errors=[{'codigo':'contrato','motivo':str(exc)}]
            if contract_errors:
                blocked=True;issues.extend('Contrato ['+e['codigo']+']: '+e['motivo'] for e in contract_errors)
        previous_photos=list(photos)
        for item in candidates:
            try:
                if item.get('posicion') in slots:raise ValueError('Posición duplicada')
                slots.add(item.get('posicion'))
                duplicates=hashes.get(item.get('sha256'),set())-{sku}
                if duplicates:
                    report['duplicados'].append({'sku':sku,'otros':sorted(duplicates),'sha256':item['sha256']})
                    raise ValueError('Original asignado a otro SKU; revisar coincidencia')
                cached=next((i for i in photos if i['posicion']==item.get('posicion') and i.get('huella_proceso')==fingerprint(item,r)),None)
                if cached and sha(safe(root,item['archivo']).read_bytes())==item['sha256']:
                    photo=cached;out={};reused+=1
                else:
                    photo,out=process(root,sku,item,r)
                    changed_photos.add((sku,photo['posicion']))
                if not blocked:
                    photos=[i for i in photos if i['posicion']!=photo['posicion']]+[photo];rowwrites.update(out)
                elif getattr(args,'borradores',None):
                    for rel,data in out.items():
                        editorial.atomic_write(safe(root,args.borradores)/rel,data)
            except (ValueError,OSError,KeyError,TypeError) as exc:issues.append(str(exc))
        if contract_mode and not blocked:
            contract_errors.extend(contracts.validate_images(root,contract,photos,rowwrites))
            issues.extend('Contrato ['+e['codigo']+']: '+e['motivo'] for e in contract_errors)
            if issues:
                blocked=True
                if getattr(args,'borradores',None):
                    for rel,data in rowwrites.items():editorial.atomic_write(safe(root,args.borradores)/rel,data)
                photos=previous_photos;rowwrites={}
        photos.sort(key=lambda i:i['posicion'])
        cover=next((i for i in photos if i['posicion']==1),None)
        if not candidates:issues.append(manifest.get('pendientes',{}).get(sku,'Sin fotografía original vinculada y revisada'))
        # No sostener imágenes antiguas que contradigan una nueva excepción.
        if old and old.get('revision_regla')!=r['revision']:
            seo.get(sku,{}).pop('banner',None)
            if sku in seo:seo[sku].pop('galeria',None);seo[sku].pop('imagenProfesional',None)
            p['imageUrl']=''
            if sku in seo:seo[sku]['imagen']='';seo[sku]['imagenPendiente']=True
        if cover and not (contract_mode and blocked):
            writes.update(rowwrites);entry={'revision_regla':r['revision'],'regla':r,'imagenes':photos}
            # Mantener solo banners revisados contra exactamente las mismas reglas y fuentes.
            if old and old.get('revision_regla')==r['revision'] and old.get('imagenes')==photos and old.get('banner'):entry['banner']=old['banner']
            media[sku]=entry
            p['imageUrl']=cover['versiones']['1200']['url']
            if sku in seo:
                seo[sku].update(imagen=p['imageUrl'],imagenProfesional=cover,galeria=photos,reglaSKU=r,imagenPendiente=False)
        elif not cover and (not (contract_mode and blocked) or (old and old.get('revision_regla')!=r['revision'])) and (candidates or (old and old.get('revision_regla')!=r['revision']) or (not old and r['presentacion']=='sin caja')):
            p['imageUrl']=''
            if sku in seo:
                seo[sku].update(imagen='',imagenPendiente=True,reglaSKU=r)
                for key in ('imagenProfesional','galeria','banner'):seo[sku].pop(key,None)
            media[sku]={'revision_regla':r['revision'],'regla':r,'imagenes':[]}
        report['productos'].append({'sku':sku,'solicitado':raw,'nombre_comercial':p['name'],
            'originales':[{'archivo':x.get('archivo'),'sha256':x.get('sha256')} for x in candidates],
            'imagen_profesional':cover['versiones'] if cover else None,'autenticidad':r['autenticidad'],
            'presentacion':r['presentacion'],'precio_contado':p['promo'],'pvp':p['pvp'],
            'url':'https://conectatech-ec.github.io/productos/'+slugs[sku]+'/',
            'estado':'preparado' if cover and not blocked and not issues else 'pendiente','pendientes':issues,
            'control_calidad':approval.get('estado','REVISAR' if issues else 'APROBADO'),
            'requiere_verificacion':r['autenticidad']=='por verificar',
            **({'contrato':{'version':3,'estado':'REVISAR' if blocked or issues else 'APROBADO_LOCAL','errores':contract_errors,
                          'validaciones_posteriores':['prepublicacion: captura móvil del HTML generado','publicacion: HTTP de Pages y hashes']}} if contract_mode else {})})
    # Perceptuales son avisos, nunca una decisión automática de identidad.
    allphotos=[(s,i) for s,m in media.items() for i in m.get('imagenes',[])]
    for n,(s,a) in enumerate(allphotos):
        for t,b in allphotos[:n]:
            if (s,a['posicion']) not in changed_photos and (t,b['posicion']) not in changed_photos:continue
            if s!=t and (int(a['dhash'],16)^int(b['dhash'],16)).bit_count()<=3:report['similares'].append({'sku':s,'similar_a':t})
    if editorial.financial(products)!=finance:raise ValueError('Precios/existencias alterados')
    # En v3 un SKU desconocido/duplicado no impide aplicar otros SKU con contrato válido.
    if args.aplicar and (contract_mode or not report['errores']):
        for rel,data in writes.items():editorial.atomic_write(safe(root,rel),data)
        editorial.atomic_write(registry_path,editorial.encode(media));editorial.atomic_write(root/'seo-contenido.json',editorial.encode(seo))
        replacement='const products='+json.dumps(products,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+';\n'
        editorial.atomic_write(root/'index.html',editorial.PATTERN.sub(lambda _:replacement,html,count=1).encode())
        for row in report['productos']:
            if row['estado']=='preparado':row['estado']='aplicado_local'
    report['duracion_segundos']=round(time.perf_counter()-start,3)
    report['precios_stock_conservados']=True
    report['resumen']={'total':len(report['productos']),'imagenes_listas':sum(bool(x['imagen_profesional']) for x in report['productos']),
        'pendientes':sum(x['estado']=='pendiente' for x in report['productos']),'errores':len(report['errores']),
        'por_verificar_autenticidad':sum(x['requiere_verificacion'] for x in report['productos']),
        'imagenes_reutilizadas':reused,'imagenes_procesadas':len(changed_photos)}
    editorial.atomic_write(safe(root,args.reporte),editorial.encode(report));print(json.dumps(report['resumen'],ensure_ascii=False))
    return int(bool(report['errores']))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',default=str(ROOT))
    parser.add_argument('--manifiesto',required=True);parser.add_argument('--aplicar',action='store_true')
    parser.add_argument('--reporte',default='reportes/procesamiento-imagenes.json')
    parser.add_argument('--borradores',help='Directorio privado local para versiones preparadas de SKU bloqueados; nunca actualiza el catálogo con ellas')
    raise SystemExit(run(parser.parse_args()))
