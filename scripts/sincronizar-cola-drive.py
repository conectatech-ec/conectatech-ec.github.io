#!/usr/bin/env python3
"""Cola incremental por SKU desde snapshots completos de Drive y Registro (solo lectura)."""
import argparse, hashlib, importlib.util, json, re
from pathlib import Path
from datetime import datetime, timezone
import reglas_sku

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('editorial',ROOT/'scripts/importar-productos.py')
editorial=importlib.util.module_from_spec(spec);spec.loader.exec_module(editorial)

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def refresh_rule_revisions(state, registry):
    """Compara revisiones, sin repetir lectura visual ni investigación del catálogo."""
    changed=[]
    for sku,entry in state['productos'].items():
        revision=registry.get('productos',{}).get(sku,{}).get('revision')
        entry['revision_regla']=revision
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

def synchronize(files, rows, catalog, aliases, previous):
    known={p['sku'] for p in catalog};groups={};errors=[];seen=set();by_id={};by_name={}
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
        match=re.fullmatch(r'([A-Za-z]+\d+)(?:_\d{8}_\d{6}|-0[1-4])?\.(?:jpe?g|png|webp)',name,re.I)
        if not match:
            errors.append({'archivo':name,'id':fid,'motivo':'Nombre sin SKU exacto reconocido'});continue
        raw=match[1].upper();sku=aliases.get(raw,raw)
        if sku not in known:
            errors.append({'archivo':name,'sku':raw,'id':fid,'motivo':'SKU no tiene ficha en el catálogo; contrastar 593 sin crear duplicados'});continue
        entries=by_id.get(fid) or by_name.get(name,[])
        conflicts=[e for e in entries if e['sku']!=sku]
        item={'id':fid,'nombre':name,'url':f.get('url',f'https://drive.google.com/file/d/{fid}/view'),
              'modificado':f.get('modificado',f.get('modifiedTime')),'bytes':f.get('bytes',f.get('size')),
              'sha256':f.get('sha256'),'registro':entries,'vista':'por identificar'}
        group=groups.setdefault(sku,{'fotos':[],'incidencias':[]})
        group['fotos'].append(item)
        if conflicts:group['incidencias'].append('SKU de Registro no coincide con nombre: '+name)
        if not entries:group['incidencias'].append('Fotografía sin fila de Registro: '+name)
    changed=[];unchanged=[];result={};duplicates={}
    old=previous.get('productos',{})
    for sku,group in sorted(groups.items()):
        group['fotos'].sort(key=lambda f:f['id'])
        types=sorted({e['tipo'] for f in group['fotos'] for e in f['registro'] if e['tipo']})
        identity_types=set('generico' if 'aaa' in t.lower() or 'genérico' in t.lower() else 'original' if t.strip().lower() in ('original','caja original') else 'sin_clasificar' for t in types)
        if len(identity_types-{'sin_clasificar'})>1:group['incidencias'].append('Clasificaciones comerciales contradictorias')
        fp=digest(group);prior=old.get(sku,{})
        entry={**group,'huella':fp,'clasificacion_registro':types,'presentacion':'sin caja',
               'autenticidad':prior.get('autenticidad','por verificar'),
               'estado':'BLOQUEADO' if group['incidencias'] else 'REVISAR'}
        if prior.get('huella')==fp:
            entry=prior;unchanged.append(sku)
        else:
            changed.append(sku)
            if prior:entry['revision_anterior']={'huella':prior.get('huella'),'estado':prior.get('estado')}
        result[sku]=entry
        for f in group['fotos']:
            if f.get('sha256'):duplicates.setdefault(f['sha256'],[]).append({'sku':sku,'id':f['id']})
    # Una ausencia en un snapshot no borra material ni productos.
    absent=sorted(set(old)-set(groups))
    for sku in absent:result[sku]={**old[sku],'ausente_en_snapshot':True}
    return {'version':1,'productos':result,'cambios':changed,'sin_cambios':unchanged,
            'ausentes_en_snapshot':absent,'errores':errors,
            'duplicados_exactos':[v for v in duplicates.values() if len(v)>1],
            'resumen':{'fotografias':len(seen),'sku_vinculados':len(groups),'nuevos_o_modificados':len(changed),
                       'sin_cambios':len(unchanged),'errores':len(errors)}}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--inventario',required=True);p.add_argument('--registro',required=True)
    p.add_argument('--estado',default='importacion/cola-drive.json');p.add_argument('--limite',type=int,default=10)
    p.add_argument('--lote',default='importacion/lotes/siguiente.json');a=p.parse_args()
    if a.limite not in (10,20,30,50,100):p.error('Lotes vigentes: 10, 20, 30, 50 o 100')
    state=Path(a.estado);previous=json.loads(state.read_text()) if state.exists() else {}
    result=synchronize(json.loads(Path(a.inventario).read_text()),json.loads(Path(a.registro).read_text()),
        editorial.read_catalog(ROOT)[1],json.loads((ROOT/'importacion/alias-sku.json').read_text()),previous)
    registry=reglas_sku.load(ROOT)
    refresh_rule_revisions(result,registry)
    # Los cambios fuera del primer lote no desaparecen al guardar el snapshot.
    # Un SKU ya investigado con la misma huella no se repite hasta nueva evidencia.
    waiting=[sku for sku,entry in result['productos'].items() if needs_work(entry)]
    waiting.sort(key=lambda sku:(not sku.startswith('TELF'),sku))
    candidates=waiting[:a.limite]
    result['por_procesar']=waiting
    result['resumen']['cola_pendiente']=len(waiting)
    policy=registry.get('politica_general',{}).get('autenticidad_registro',{})
    if policy.get('confirmado_por_propietario') and candidates:
        eligible=[sku for sku in candidates if not result['productos'][sku]['incidencias']]
        updates,issues=reglas_sku.registration_rules(json.loads(Path(a.registro).read_text()),eligible,
            json.loads((ROOT/'importacion/alias-sku.json').read_text()),policy)
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
