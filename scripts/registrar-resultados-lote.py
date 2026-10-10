#!/usr/bin/env python3
"""Cierra solo SKU investigados del lote; una fuente nueva vuelve a ponerlos en cola."""
import argparse,json
from pathlib import Path
from datetime import datetime,timezone

def close_lot(state, results, report_path):
    seen=set()
    for item in results:
        sku=item['sku']
        if sku in seen:raise ValueError('SKU repetido en resultados: '+sku)
        seen.add(sku)
        if sku not in state['productos']:raise ValueError('SKU fuera de cola: '+sku)
        if item['estado'] not in ('publicado_verificado','REVISAR','BLOQUEADO','aplicado_local'):
            raise ValueError('Estado sin evidencia: '+sku)
        entry=state['productos'][sku]
        entry['produccion']={'huella_revisada':entry['huella'],'estado':item['estado'],
            'reporte':str(report_path),'fecha':datetime.now(timezone.utc).isoformat(),
            'pendientes':item.get('pendientes',[])}
    return state

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--estado',default='importacion/cola-drive.json');p.add_argument('--reporte',required=True)
    a=p.parse_args();path=Path(a.estado);report=json.loads(Path(a.reporte).read_text())
    state=close_lot(json.loads(path.read_text()),report['productos'],a.reporte)
    temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
    print(json.dumps({'sku_registrados':len(report['productos'])}))

if __name__=='__main__':main()
