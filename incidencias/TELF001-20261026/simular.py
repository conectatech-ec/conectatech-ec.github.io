#!/usr/bin/env python3
"""Offline TELF001 routing simulation. Does not connect to Meta or alter production."""
import argparse,csv,hashlib,io,json
from pathlib import Path
SKU='TELF001';LABEL='ct-web:celulares-y-smartphones';URL='https://conectatech-ec.github.io/productos/telf001-telefono-zte-a56-pro-128gb/'
def simulate(raw):
 rows=list(csv.DictReader(io.StringIO(raw)));targets=[r for r in rows if r.get('id')==SKU]
 if len(targets)!=1:raise ValueError('TELF001 ausente o duplicado: detener')
 before=targets[0]
 if before.get('price')!='139.90 USD' or before.get('link')!=URL or before.get('availability')!='in stock':raise ValueError('La fuente cambió o no coincide con el corte autorizado: reauditar')
 if before.get('custom_label_0') not in ('',LABEL):raise ValueError('Etiqueta concurrente desconocida: no sobrescribir')
 after={**before,'custom_label_0':LABEL};candidate=[after if r.get('id')==SKU else dict(r) for r in rows]
 changes=[{'sku':a['id'],'fields':[k for k in a if a[k]!=b[k]]} for a,b in zip(rows,candidate) if a!=b]
 others_before=[r for r in rows if r['id']!=SKU];others_after=[r for r in candidate if r['id']!=SKU]
 canonical=lambda r:hashlib.sha256(json.dumps(r,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 result={'sku':SKU,'applied':False,'only_simulation':True,'catalog_id':'1036301566100990','target_collection_id':'29304551402566106','before_collection_match':before['custom_label_0']==LABEL and before['availability']=='in stock','after_collection_match':True,'row_count_before':len(rows),'row_count_after':len(candidate),'changes':changes,'non_target_rows_unchanged':canonical(others_before)==canonical(others_after),'other_target_fields_unchanged':all(before[k]==after[k] for k in before if k!='custom_label_0'),'source_feed_sha256':hashlib.sha256(raw.encode()).hexdigest(),'proposed_item_fields':{'custom_label_0':LABEL},'requires_meta_item_id_lookup':True,'required_before_live_change':['Verificar vínculo de WhatsApp con el catálogo maestro para el número afectado','Leer la identidad Meta existente de retailer_id TELF001 y su estado de elegibilidad/visibilidad','Confirmar la revisión de imagen y aprobación comercial del SKU; no falsear comercialVerificado','Autorizar una excepción de enrutamiento por SKU o completar aprobación editorial real','Resolver persistencia ante la siguiente importación; la fuente actual vuelve a dejar vacía la etiqueta'],'live_visibility_verified':False}
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('feed',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();result=simulate(a.feed.read_text());a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'changes':result['changes'],'non_target_rows_unchanged':result['non_target_rows_unchanged'],'before_collection_match':result['before_collection_match'],'after_collection_match':True,'applied':False}))
