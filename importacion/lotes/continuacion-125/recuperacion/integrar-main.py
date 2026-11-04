import subprocess,json,re
from pathlib import Path
g=lambda *x:subprocess.check_output(['git',*x]).decode()
rx=r'const products=(\[[\s\S]*?\]);\s*\n';S='TECL028';W=Path('work/produccion125')
assert not g('diff','--name-only').strip(),'Hay cambios locales sin guardar; no integrar.'
own=json.loads(re.search(rx,g('show','HEAD:index.html'))[1]);own=next(x for x in own if x['sku']==S)
baseline=json.loads(re.search(rx,(W/'baseline-index.html').read_text())[1]);baseline=next(x for x in baseline if x['sku']==S)
main=g('rev-parse','origin/main').strip();raw=g('show',main+':index.html');products=json.loads(re.search(rx,raw)[1]);current=next(x for x in products if x['sku']==S);assert current==baseline,'TECL028 cambió en main; revisar antes de integrar.'
p=subprocess.run(['git','merge','--no-commit',main],text=True,capture_output=True)
conflicts=set(g('diff','--name-only','--diff-filter=U').splitlines())
if conflicts:
 if conflicts!={'index.html'}:
  subprocess.run(['git','merge','--abort'],check=True);raise SystemExit('Conflictos fuera del bloque de catálogo: '+str(conflicts))
 for key in ['imageUrl','specs','searchTerms']:current[key]=own[key]
 Path('index.html').write_text(re.sub(rx,lambda _:'const products='+json.dumps(products,ensure_ascii=False,separators=(',',':'))+';\n',raw,count=1));subprocess.run(['git','add','--','index.html'],check=True)
elif p.returncode:
 raise SystemExit(p.stderr)
merged=Path('index.html').read_text();actual=json.loads(re.search(rx,merged)[1]);before=json.loads(re.search(rx,raw)[1]);a={x['sku']:x for x in actual};b={x['sku']:x for x in before};assert len(a)==len(b)==1198 and all(a[s]==b[s]for s in b if s!=S)
assert {k for k in set(a[S])|set(b[S])if a[S].get(k)!=b[S].get(k)}=={'imageUrl','specs','searchTerms'}
assert re.sub(rx,'const products=[];\n',merged)==re.sub(rx,'const products=[];\n',raw)
report={'main':main,'otros1197ProductosExactos':True,'soloDeltaTECL028':True,'HTMLFueraDeProductosIgualMain':True,'conflictoResuelto':sorted(conflicts),'nota':'Se conserva toda publicación fotográfica/editorial ajena y se aplica sólo el delta propio.'};(W/'integracion-main.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
merge_head=Path(g('rev-parse','--git-path','MERGE_HEAD').strip())
if merge_head.exists():subprocess.run(['git','commit','-m','Integrar main conservando publicaciones paralelas y sólo el delta TECL028'],check=True)
print(json.dumps(report,ensure_ascii=False))
