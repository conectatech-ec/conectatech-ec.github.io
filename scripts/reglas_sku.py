"""Registro persistente: identidad comercial y presentación son independientes."""
import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = {'original verificado', 'genérico/compatible', 'por verificar'}
PRESENT = {'con caja', 'sin caja', 'selección automática'}
DEFAULT = {'autenticidad': 'por verificar', 'presentacion': 'selección automática',
           'instrucciones': '', 'evidencia_autenticidad': '', 'revision': 0}

def load(root=ROOT):
    return json.loads((root/'importacion/reglas-sku.json').read_text())

def rule(sku, root=ROOT):
    registry = load(root)
    value = {**DEFAULT, **registry['productos'].get(sku, {})}
    if value['autenticidad'] not in AUTH or value['presentacion'] not in PRESENT:
        raise ValueError('Regla inválida: '+sku)
    return value

def compatible(rule, photo, cover=False):
    presentation = rule['presentacion']
    if presentation == 'sin caja' and photo.get('contiene_caja') is not False:
        return False
    if cover and presentation == 'con caja' and photo.get('contiene_caja') is not True:
        return False
    return True

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--csv', required=True)
    p.add_argument('--aplicar', action='store_true')
    a=p.parse_args(); db=load(); aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text())
    rows=list(csv.DictReader(open(a.csv,encoding='utf-8-sig',newline='')))
    allowed={'sku','autenticidad','presentacion','instrucciones','evidencia_autenticidad'}
    seen=set(); changes=[]
    for row in rows:
        if set(row)!=allowed: raise ValueError('Usar las cinco columnas de reglas-ejemplo.csv')
        sku=row['sku'].strip().upper();sku=aliases.get(sku,sku)
        if sku not in db['productos'] or sku in seen: raise ValueError('SKU desconocido o duplicado: '+sku)
        seen.add(sku);old=db['productos'][sku];new=dict(old)
        for k in allowed-{'sku'}:
            # Vacío conserva la regla anterior. Para borrar instrucciones usar [BORRAR].
            if row[k].strip(): new[k]='' if row[k].strip()=='[BORRAR]' else row[k].strip()
        if new['autenticidad'] not in AUTH or new['presentacion'] not in PRESENT: raise ValueError('Valores inválidos: '+sku)
        if new['autenticidad']=='original verificado' and not new['evidencia_autenticidad']:
            raise ValueError('Original verificado requiere evidencia explícita; un logotipo no es evidencia')
        if new != old:
            new['revision']=old.get('revision',0)+1
            changes.append({'sku':sku,'antes':old,'despues':new})
            db['productos'][sku]=new
    if a.aplicar and changes:
        db['historial'].append({'fecha':datetime.now(timezone.utc).isoformat(),'cambios':changes})
        (ROOT/'importacion/reglas-sku.json').write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'modo':'aplicar' if a.aplicar else 'simular','cambios':len(changes)},ensure_ascii=False))

if __name__=='__main__': main()
