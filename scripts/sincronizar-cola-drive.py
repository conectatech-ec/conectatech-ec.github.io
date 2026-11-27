#!/usr/bin/env python3
"""Cola incremental desde metadatos Drive/Registro y el corte593 ya validado."""
import argparse, copy, hashlib, importlib.util, json, math, re
from pathlib import Path
from datetime import datetime, timezone
import reglas_sku

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('editorial',ROOT/'scripts/importar-productos.py')
editorial=importlib.util.module_from_spec(spec);spec.loader.exec_module(editorial)

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def valid_sha(value):
    return isinstance(value,str) and re.fullmatch(r'[a-f0-9]{64}',value) is not None

def load_source593(path, root=ROOT, validated_path=None, _allow_extract=True):
    """Lee el contrato publicado existente; no interpreta XLSX ni valida un corte nuevo."""
    path=Path(path).resolve(); source=json.loads(path.read_text()); state=None
    if not isinstance(source,dict):raise ValueError('Fuente593 debe ser un objeto JSON')
    if 'origen_sha256' in source:
        state=source; reference=state.get('referencia')
        if not isinstance(reference,str):raise ValueError('Estado593 sin referencia al corte validado')
        path=(root/reference).resolve()
        if not path.is_relative_to(Path(root).resolve()) or path.suffix!='.json':
            raise ValueError('Referencia593 fuera del repositorio o formato JSON')
        source=json.loads(path.read_text())
    if 'evidencia_checkout' not in source:
        # Extracto saneado de la fase de alta existente, nunca otro lector XLSX.
        if not _allow_extract:raise ValueError('Corte593 sin contrato de identidad validado')
        canonical=load_source593(validated_path or root/'datos-593/estado-ultimo-corte.json',root,_allow_extract=False)
        cut=json.loads(Path(canonical['archivo_corte']).read_text())
        sha=source.get('sha256_original'); products=source.get('productos')
        if (not valid_sha(sha) or not isinstance(products,dict) or not products or
            source.get('archivo')!='Reporte-Inventario.xlsx' or
            not isinstance(source.get('fecha_corte'),str)):
            raise ValueError('Extracto de alta593 sin procedencia saneada')
        relative=path.relative_to(Path(root).resolve()).as_posix() if path.is_relative_to(Path(root).resolve()) else None
        historical=set()
        for approval in cut.get('altas_validadas',[]):
            if (approval.get('sha256_original')==sha and approval.get('fecha')==source['fecha_corte'] and
                relative is not None and approval.get('evidencia')==relative):
                historical.update(approval.get('skus',[]))
        current=sha==canonical['sha256'] and source['fecha_corte']==canonical['fecha_corte']
        identities={}; references={}
        for sku,row in products.items():
            if not re.fullmatch(r'[A-Z]+\d+[A-Z]*',sku) or not isinstance(row,dict):
                raise ValueError('SKU o fila inválidos en extracto de alta593')
            name=row.get('nombre'); line=row.get('fila')
            prices=[row.get('promo_contado'),row.get('pvp_final')]
            if (not isinstance(name,str) or not name.strip() or type(row.get('stock')) is not int or
                any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in prices) or
                any('costo' in key.lower() for key in row)):
                raise ValueError('Extracto de alta593 incompleto o con datos privados')
            if not (sku in historical or (current and type(line) is int and line>=2)):
                raise ValueError('Extracto de alta593 no enlazado al corte validado o altas_validadas')
            identities[sku]=digest({'sku':sku,'nombre':name.strip()})
            references[sku]={'tipo':'extracto_alta','archivo':relative or path.name,
                             'nombre':name.strip(),'fila':line,
                             'alta_registrada':sku in historical}
        return {'sha256':sha,'fecha_corte':source['fecha_corte'],
                'secuencia':canonical['secuencia'] if current else None,
                'identidades':identities,'referencias':references}
    sha=source.get('sha256_original'); date=source.get('fecha_corte')
    evidence=source.get('evidencia_checkout',{}); sequence=source.get('revision_fuente',{}).get('secuencia')
    products=source.get('productos'); identities=evidence.get('identity_signatures')
    if (not valid_sha(sha) or not isinstance(date,str) or
        not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date) or
        not isinstance(products,dict) or not products or not isinstance(identities,dict) or
        evidence.get('schema')!='conectatech.checkout-source-attestation.v1' or
        evidence.get('source_sha256')!=sha or evidence.get('cut_date')!=date or
        not isinstance(sequence,int) or isinstance(sequence,bool) or sequence<1 or
        type(evidence.get('revision_sequence')) is not int or evidence.get('revision_sequence')!=sequence):
        raise ValueError('Fuente593 sin contrato de identidad validado coherente')
    if state and (state.get('origen_sha256')!=sha or state.get('fecha_corte')!=date or
                  type(state.get('revision_fuente',{}).get('secuencia')) is not int or
                  state.get('revision_fuente',{}).get('secuencia')!=sequence):
        raise ValueError('Estado593 y corte validado no coinciden')
    return {'sha256':sha,'fecha_corte':date,'secuencia':sequence,'archivo_corte':str(path),
            'identidades':{sku:identity for sku,identity in identities.items()
                           if sku in products and valid_sha(identity) and re.fullmatch(r'[A-Z]+\d+[A-Z]*',sku)}}

def source_fingerprint(group, identity=None):
    """El contenido conocido prevalece sobre renombres y metadatos de transporte."""
    photos=[]
    for photo in group.get('fotos',[]):
        content={'sha256':photo['sha256']} if valid_sha(photo.get('sha256')) else {
            key:photo.get(key) for key in ('id','nombre','modificado','bytes')}
        content['principal']=photo.get('vista')=='PRINCIPAL elegida por propietario'
        content['registro']=sorted({(r.get('sku',''),r.get('tipo','')) for r in photo.get('registro',[])})
        photos.append(content)
    # Dos IDs del mismo contenido no ordenan una segunda producción.
    photos=sorted({json.dumps(p,sort_keys=True,ensure_ascii=False) for p in photos})
    conflicts=[issue for issue in group.get('incidencias',[])
               if not issue.startswith('Fotografía sin fila de Registro: ')]
    return digest({'fotos':photos,'incidencias':sorted(set(conflicts)),
                   'identidad_593':identity})

def refresh_rule_revisions(state, registry, root=ROOT):
    """Compara revisiones, sin repetir lectura visual ni investigación del catálogo."""
    changed=[]
    for sku,entry in state['productos'].items():
        revision=registry.get('productos',{}).get(sku,{}).get('revision')
        entry['revision_regla']=revision
        configured=registry.get('productos',{}).get(sku,{})
        entry['presentacion']='con caja' if (configured.get('presentacion')=='con caja' and reglas_sku.sealed_authorized(root,sku))else'sin caja'
        production=entry.get('produccion',{})
        if production and production.get('revision_regla_revisada')!=revision:
            changed.append(sku)
    state['cambios_reglas']=changed
    state['resumen']['reglas_con_revision_pendiente']=len(changed)

def needs_work(entry):
    production=entry.get('produccion',{})
    return not entry.get('ausente_en_snapshot') and (
        production.get('huella_revisada')!=entry.get('huella') or
        production.get('revision_regla_revisada')!=entry.get('revision_regla') or
        production.get('estado')=='aplicado_local')

def pending_order(state):
    """Altas con evidencia pendiente y cambios actuales antes del archivo histórico."""
    changed=set(state.get('cambios',[]))
    def priority(sku):
        entry=state['productos'][sku]; production=entry.get('produccion',{})
        new_evidence=(production.get('huella_revisada')!=entry.get('huella') or
                      production.get('revision_regla_revisada')!=entry.get('revision_regla'))
        rank=0 if entry.get('tipo_trabajo')=='alta' and new_evidence else 1 if sku in changed else 2
        return rank,not sku.startswith('TELF'),sku
    return sorted((sku for sku,entry in state['productos'].items() if needs_work(entry)),key=priority)

def synchronize(files, rows, catalog, aliases, previous, source593=None, delta=False):
    known={p['sku'] for p in catalog};groups={};errors=[];seen=set();by_id={};by_name={}
    old=previous.get('productos',{}); old_files={}
    for sku,entry in old.items():
        for photo in entry.get('fotos',[]):old_files[photo['id']]=(sku,photo)
    for n,row in enumerate(rows[1:],2):
        row=(row+['']*6)[:6];date,raw,name,url,kind,old_presentation=row
        sku=aliases.get(str(raw).strip().upper(),str(raw).strip().upper())
        entry={'sku':sku,'tipo':kind,'presentacion_historica':old_presentation,'fila':n}
        match=re.search(r'(?:/d/|[?&]id=)([\w-]+)',str(url))
        if match:by_id.setdefault(match[1],[]).append(entry)
        by_name.setdefault(str(name),[]).append(entry)
    for f in files:
        fid=f.get('id');name=f.get('nombre',f.get('name',''))
        if not fid or fid in seen:
            errors.append({'archivo':name,'motivo':'ID de Drive ausente o repetido'});continue
        seen.add(fid)
        # SKU exacto; el sufijo de fecha no crea un SKU ni una vista inventada.
        match=re.fullmatch(r'([A-Za-z]+\d+[A-Za-z]*)(?:_\d{8}_\d{6}(?:_\d{1,6}_[a-f0-9]{8,64})?|-0[1-4]|\s*(?:-\s*)?PRINCIPAL)?\.(?:jpe?g|png|webp)',name,re.I)
        if not match:
            errors.append({'archivo':name,'id':fid,'motivo':'Nombre sin SKU exacto reconocido'});continue
        raw=match[1].upper();sku=aliases.get(raw,raw)
        if sku not in known and source593 is None:
            errors.append({'archivo':name,'sku':raw,'id':fid,'motivo':'SKU no tiene ficha en el catálogo; contrastar 593 sin crear duplicados'});continue
        prior_sku,prior_photo=old_files.get(fid,(None,{}))
        if prior_sku and prior_sku!=sku:
            errors.append({'archivo':name,'id':fid,'motivo':'ID de Drive ya vinculado a otro SKU; revisar identidad'});continue
        entries=by_id.get(fid) or by_name.get(name,[])
        conflicts=[e for e in entries if e['sku']!=sku]
        sha=f.get('sha256')
        if sha is not None and not valid_sha(sha):
            errors.append({'archivo':name,'id':fid,'motivo':'SHA256 de fotografía inválido'});continue
        modified=f.get('modificado',f.get('modifiedTime')); size=f.get('bytes',f.get('size'))
        if sha is None and modified is not None and size is not None and (
            prior_photo.get('modificado')==modified and str(prior_photo.get('bytes'))==str(size)):
            sha=prior_photo.get('sha256')
        item={'id':fid,'nombre':name,'url':f.get('url',f'https://drive.google.com/file/d/{fid}/view'),
              'modificado':modified,'bytes':size,
              'sha256':sha,'registro':entries,'vista':'PRINCIPAL elegida por propietario' if re.search(r'PRINCIPAL',name,re.I) else 'por identificar'}
        group=groups.setdefault(sku,{'fotos':[],'incidencias':[]})
        if delta and not group['fotos']:
            group['fotos']=copy.deepcopy(old.get(sku,{}).get('fotos',[]))
        group['fotos']=[photo for photo in group['fotos'] if photo['id']!=fid]
        group['fotos'].append(item)
        if conflicts:group['incidencias'].append('SKU de Registro no coincide con nombre: '+name)
        if not entries:group['incidencias'].append('Fotografía sin fila de Registro: '+name)
    changed=[];unchanged=[];result={}
    for sku,group in sorted(groups.items()):
        group['fotos'].sort(key=lambda f:f['id'])
        # En modo delta también se vuelven a comprobar las fuentes conservadas.
        for photo in group['fotos']:
            photo['registro']=by_id.get(photo['id']) or by_name.get(photo['nombre'],[])
            if not photo.get('registro'):group['incidencias'].append('Fotografía sin fila de Registro: '+photo['nombre'])
            if any(e['sku']!=sku for e in photo.get('registro',[])):
                group['incidencias'].append('SKU de Registro no coincide con nombre: '+photo['nombre'])
        group['incidencias']=sorted(set(group['incidencias']))
        types=sorted({e['tipo'] for f in group['fotos'] for e in f['registro'] if e['tipo']})
        identity_types=set('generico' if 'aaa' in t.lower() or 'genérico' in t.lower() else 'original' if t.strip().lower() in ('original','caja original') else 'sin_clasificar' for t in types)
        if len(identity_types-{'sin_clasificar'})>1:group['incidencias'].append('Clasificaciones comerciales contradictorias')
        prior=old.get(sku,{}); identity=(source593 or {}).get('identidades',{}).get(sku)
        if source593 is None:identity=prior.get('fuente_593',{}).get('identidad_sha256')
        prior_identity=prior.get('fuente_593',{}).get('identidad_sha256')
        # Añadir procedencia a una ficha existente no constituye cambio de producto.
        comparison_identity=None if prior and sku in known and prior_identity is None else identity
        fp=source_fingerprint(group,comparison_identity)
        same_sources=bool(prior) and source_fingerprint(prior,prior_identity)==fp
        # Compatibilidad con huellas/cierres históricos; no encolar todo al migrar.
        if same_sources:fp=prior.get('huella',fp)
        entry={**copy.deepcopy(prior),**group,'huella':fp,'clasificacion_registro':types,'presentacion':'sin caja',
               'autenticidad':prior.get('autenticidad','por verificar'),
               'tipo_trabajo':'actualizacion' if sku in known else 'alta',
               'estado':'BLOQUEADO' if any(not issue.startswith('Fotografía sin fila de Registro: ')
                                          for issue in group['incidencias']) else 'REVISAR'}
        entry['pendientes_593']=['Identidad pendiente en el corte593 validado'] if sku not in known and not identity else []
        entry.pop('ausente_en_snapshot',None)
        if source593 is not None:
            entry['fuente_593']={k:source593[k] for k in ('sha256','fecha_corte','secuencia')}
            entry['fuente_593']['identidad_sha256']=identity
            if sku in source593.get('referencias',{}):
                entry['fuente_593']['evidencia']=source593['referencias'][sku]
        if same_sources:
            entry['estado']=prior.get('estado',entry['estado']);unchanged.append(sku)
        else:
            changed.append(sku)
            if prior:
                entry['revision_anterior']={'huella':prior.get('huella'),'estado':prior.get('estado')}
                history=entry.setdefault('historial_fuentes',[])
                history.append({key:copy.deepcopy(prior[key]) for key in ('huella','estado','fotos','produccion','fuente_593') if key in prior})
        result[sku]=entry
    # Una ausencia en un snapshot no borra material ni productos.
    absent=[] if delta else sorted(set(old)-set(groups))
    for sku in old:
        if sku in groups:continue
        result[sku]=copy.deepcopy(old[sku])
        if not delta:result[sku]['ausente_en_snapshot']=True
    # Conserva el orden persistente: un delta de cuatro SKU no reescribe toda
    # la cola pública por iteración no determinista de sets.
    result={sku:result[sku] for sku in list(old)+[s for s in result if s not in old]}
    # El índice de duplicados cubre también las fotos omitidas de un delta.
    duplicates={}
    for sku,entry in result.items():
        for photo in entry.get('fotos',[]):
            if valid_sha(photo.get('sha256')):
                duplicates.setdefault(photo['sha256'],[]).append({'sku':sku,'id':photo['id']})
    state={'version':1,'productos':result,'cambios':changed,'sin_cambios':unchanged,
            'ausentes_en_snapshot':absent,'errores':errors,
            'duplicados_exactos':[v for v in duplicates.values() if len(v)>1],
            'resumen':{'fotografias':len(seen),'sku_vinculados':len(groups),'nuevos_o_modificados':len(changed),
                       'sin_cambios':len(unchanged),'errores':len(errors)}}
    if 'fuentes_empresariales' in previous:
        state['fuentes_empresariales']=copy.deepcopy(previous['fuentes_empresariales'])
    return state

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--inventario',required=True)
    p.add_argument('--registro',help='Snapshot legado opcional; las fotos empresariales no lo requieren')
    p.add_argument('--estado',default='importacion/cola-drive.json');p.add_argument('--limite',type=int,default=10)
    p.add_argument('--fuente-593',help='Estado publicado con referencia al corte o corte593 ya validado; no XLSX')
    p.add_argument('--corte-593',help='Estado/corte validado contra el que enlazar un extracto saneado de altas')
    p.add_argument('--delta',action='store_true',help='Metadatos parciales: conservar fotos y SKU no incluidos')
    p.add_argument('--lote',default='importacion/lotes/siguiente.json');a=p.parse_args()
    if a.limite not in (10,20,30,50,100):p.error('Lotes vigentes: 10, 20, 30, 50 o 100')
    state=Path(a.estado);previous=json.loads(state.read_text()) if state.exists() else {}
    if a.corte_593 and not a.fuente_593:p.error('--corte-593 requiere --fuente-593')
    try:source593=load_source593(a.fuente_593,ROOT,a.corte_593) if a.fuente_593 else None
    except (ValueError,OSError,TypeError) as error:p.error(str(error))
    rows=json.loads(Path(a.registro).read_text()) if a.registro else []
    result=synchronize(json.loads(Path(a.inventario).read_text()),rows,
        editorial.read_catalog(ROOT)[1],json.loads((ROOT/'importacion/alias-sku.json').read_text()),previous,source593,a.delta)
    registry=reglas_sku.load(ROOT)
    refresh_rule_revisions(result,registry)
    # Los cambios fuera del primer lote no desaparecen al guardar el snapshot.
    # Un SKU ya investigado con la misma huella no se repite hasta nueva evidencia.
    waiting=pending_order(result)
    candidates=waiting[:a.limite]
    result['por_procesar']=waiting
    result['resumen']['cola_pendiente']=len(waiting)
    policy=registry.get('politica_general',{}).get('autenticidad_registro',{})
    # La compatibilidad de Registro nunca autoriza reclasificar pendientes ajenos
    # a esta consulta, ni aplicar el modo por defecto sin filas explícitas.
    consulted=set(result['cambios'])|set(result['sin_cambios'])
    aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text())
    registered={aliases.get(str(row[1]).strip().upper(),str(row[1]).strip().upper())
                for row in rows[1:] if len(row)>1}
    eligible=[sku for sku in candidates if sku in consulted and sku in registered
              and not result['productos'][sku]['incidencias']]
    if a.registro and len(rows)>1 and policy.get('confirmado_por_propietario') and eligible:
        updates,issues=reglas_sku.registration_rules(rows,eligible,
            aliases,policy,ROOT)
        changes=reglas_sku.apply_rows(updates,apply=True,root=ROOT)
        # El lote investigará la revisión resultante de la clasificación del Registro.
        if changes:
            latest=reglas_sku.load(ROOT)
            for sku in eligible:
                result['productos'][sku]['revision_regla']=latest['productos'][sku]['revision']
        for item in updates:
            entry=result['productos'][item['sku']]
            entry['autenticidad']=item['autenticidad'];entry['evidencia_autenticidad']=item['evidencia_autenticidad']
        for issue in issues:
            entry=result['productos'][issue['sku']];entry['estado']='BLOQUEADO'
            entry['incidencias'].append(issue['motivo'])
        result['resumen']['reglas_autenticidad_actualizadas']=len(changes)
        result['resumen']['autenticidad_requiere_revision']=len(issues)
    result['consultado']=datetime.now(timezone.utc).isoformat()
    editorial.atomic_write(state,editorial.encode(result))
    editorial.atomic_write(Path(a.lote),editorial.encode({'version':3,'skus':candidates,
        'imagenes':{},'aprobaciones':{},'contratos':{},'nota':'Autenticidad según política del propietario y Registro; identidad, variante, fotografía y publicación requieren sus controles independientes.'}))
    print(json.dumps(result['resumen'],ensure_ascii=False))

if __name__=='__main__':main()
