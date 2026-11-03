"""Excepciones por SKU para sorpresas selladas; el resto conserva SIN CAJA."""
import hashlib,json,re
from pathlib import Path

def authorization(root,sku):
    root=Path(root).resolve()
    try:
        data=json.loads((root/'importacion/excepciones-presentacion-sellada.json').read_text())
        row=data['productos'].get(sku,{})
        if data.get('version')!=1 or row.get('aprobado_por_propietario')is not True or row.get('tipo')!='UNIDAD_SORPRESA_SELLADA':return None
        proof=data['evidencia'];rel=proof['archivo'];digest=proof['sha256']
        if not isinstance(rel,str)or not rel.startswith('reportes/')or not rel.endswith('.json')or not re.fullmatch('[a-f0-9]{64}',str(digest)):return None
        file=(root/rel).resolve()
        if not file.is_relative_to(root):return None
        raw=file.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=digest:return None
        source=json.loads(raw);claim=source.get('excepciones_presentacion_sellada',{}).get(sku,{})
        if source.get('origen')!='CONFIRMACION_PROPIETARIO_CHAT'or any(claim.get(k)is not True for k in ['autorizada','mostrar_empaque','unidad_sellada']):return None
        return {'archivo':rel,'sha256':digest}
    except (OSError,ValueError,KeyError,TypeError,AttributeError):return None

def authorized(root,sku):return authorization(root,sku)is not None

def box_photo_allowed(root,sku,photo,rule,contract):
    proof=authorization(root,sku);unit=contract.get('unidad_venta',{})
    if not isinstance(unit,dict):return False
    return bool(proof and rule.get('presentacion')=='con caja'and photo.get('contiene_caja')is True
        and unit.get('verificada')is True and unit.get('sellada')is True
        and type(unit.get('cantidad'))is int and unit['cantidad']==1 and unit.get('fuente')==proof['archivo'])
