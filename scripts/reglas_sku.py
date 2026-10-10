"""Registro persistente: identidad comercial y presentación son independientes."""
import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH = {'original verificado', 'genérico/compatible', 'por verificar'}
PRESENT = {'con caja', 'sin caja', 'selección automática'}
DEFAULT = {'autenticidad': 'por verificar', 'presentacion': 'sin caja',
           'instrucciones': '', 'evidencia_autenticidad': '', 'revision': 0}

def load(root=ROOT):
    return json.loads((root/'importacion/reglas-sku.json').read_text())

def rule(sku, root=ROOT):
    registry = load(root)
    value = {**DEFAULT, **registry['productos'].get(sku, {})}
    if registry.get('politica_general', {}).get('presentacion_obligatoria') == 'sin caja':
        value['presentacion'] = 'sin caja'
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

def registration_rules(rows, skus, aliases, policy):
    """Clasificación comercial explícita del propietario; no aprueba fotos ni variantes."""
    if not policy.get('confirmado_por_propietario'):
        raise ValueError('Falta confirmación del propietario para usar Registro como evidencia')
    mapping={str(k).strip().casefold():v for k,v in policy['valores_tipo'].items()}
    wanted={aliases.get(s.upper(),s.upper()) for s in skus}
    grouped={s:[] for s in wanted};issues=[];updates=[]
    for number,row in enumerate(rows[1:],2):
        row=(row+['']*6)[:6];sku=aliases.get(str(row[1]).strip().upper(),str(row[1]).strip().upper())
        if sku not in wanted:continue
        filename=re.fullmatch(r'([A-Za-z]+\d+)(?:_\d{8}_\d{6}|-0[1-4])?\.(?:jpe?g|png|webp)',str(row[2]),re.I)
        mismatch=filename is None or aliases.get(filename[1].upper(),filename[1].upper())!=sku
        grouped[sku].append((number,str(row[4]).strip(),mismatch))
    for sku,entries in sorted(grouped.items()):
        kinds={mapping.get(kind.casefold()) for _,kind,_ in entries}
        if not entries or None in kinds or len(kinds)!=1 or any(e[2] for e in entries):
            issues.append({'sku':sku,'motivo':'Registro ausente, Tipo sin clasificar, clasificaciones contradictorias o SKU/archivo discordantes'});continue
        evidence=(f"Confirmación comercial del propietario ({policy['fecha_confirmacion']}): "
                  f"{policy['documento_url']} — {policy['pestana']}, columna Tipo, "
                  f"filas {','.join(str(e[0]) for e in entries)}; "
                  f"valores: {', '.join(sorted({e[1] for e in entries}))}. "
                  'No acredita licencia de fotografías externas ni resuelve variantes.')
        updates.append({'sku':sku,'autenticidad':next(iter(kinds)),
                        'presentacion':'','instrucciones':'','evidencia_autenticidad':evidence})
    return updates,issues

def apply_rows(rows, apply=False, root=ROOT):
    db=load(root);aliases=json.loads((root/'importacion/alias-sku.json').read_text())
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
        if db.get('politica_general', {}).get('presentacion_obligatoria') == 'sin caja' and new['presentacion'] != 'sin caja':
            raise ValueError('La política comercial vigente exige SIN CAJA: '+sku)
        if new['autenticidad']=='original verificado' and not new['evidencia_autenticidad']:
            raise ValueError('Original verificado requiere evidencia explícita; un logotipo no es evidencia')
        if new != old:
            new['revision']=old.get('revision',0)+1
            changes.append({'sku':sku,'antes':old,'despues':new})
            db['productos'][sku]=new
    if apply and changes:
        db.setdefault('historial',[]).append({'fecha':datetime.now(timezone.utc).isoformat(),'cambios':changes})
        path=root/'importacion/reglas-sku.json';temp=path.with_suffix('.json.tmp')
        temp.write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
    return changes

def main():
    p=argparse.ArgumentParser(description=__doc__)
    source=p.add_mutually_exclusive_group(required=True)
    source.add_argument('--csv');source.add_argument('--registro',help='Snapshot JSON de Registro A:F, con cabecera')
    p.add_argument('--sku',nargs='+',help='SKU del lote; obligatorio con --registro')
    p.add_argument('--aplicar',action='store_true');a=p.parse_args();issues=[]
    if a.registro:
        if not a.sku:p.error('--registro requiere --sku para limitar el lote')
        db=load();aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text())
        rows,issues=registration_rules(json.loads(Path(a.registro).read_text()),a.sku,aliases,
            db.get('politica_general',{}).get('autenticidad_registro',{}))
    else:
        with open(a.csv,encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
    changes=apply_rows(rows,a.aplicar)
    print(json.dumps({'modo':'aplicar' if a.aplicar else 'simular','cambios':len(changes),'requieren_revision':issues},ensure_ascii=False))

if __name__=='__main__': main()
