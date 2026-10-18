#!/usr/bin/env python3
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'));from planner import plan
p=argparse.ArgumentParser();p.add_argument('--existing',type=Path,help='Exportación saneada de conjuntos existentes');p.add_argument('--config',type=Path,default=ROOT/'data/conjuntos-config.json');p.add_argument('--output',type=Path,default=ROOT/'data/plan-seco.json');a=p.parse_args()
existing=json.loads(a.existing.read_text()) if a.existing else []
if isinstance(existing,dict):existing=existing.get('data',existing.get('sets',[]))
result=plan(json.loads(a.config.read_text()),existing);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'proposals':len(result['actions']),'changes_executed':0}))
