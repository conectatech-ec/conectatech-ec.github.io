#!/usr/bin/env python3
"""Private input adapter for the ORIGINAL publicacion-stock-593-web workflow.

The existing prepare CLI validates the report; this adapter does not parse XLSX,
change business rules, deploy a Worker or publish a second inventory.
"""
import argparse,base64,hashlib,json,os,re,subprocess,sys,urllib.parse
from datetime import datetime,timezone
from pathlib import Path

CONTRACT='CT593_OBSERVER_V1'
CUT='datos-593/corte-comercial-publico-validado.json'
STATE='datos-593/estado-ultimo-corte.json'
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
SHA=re.compile(r'[a-f0-9]{64}\Z')
def stamp():return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def read(path):return json.loads(Path(path).read_text())
def save(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f:json.dump(data,f)
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,check=False,**kw)
class Entry:
    def __init__(self,repo,work,transport,validator,sha):
        if not SHA.fullmatch(sha):raise ValueError('SOURCE_SHA_REQUIRED')
        self.repo=Path(repo).resolve();self.work=Path(work).resolve();self.transport=Path(transport).resolve()
        self.validator=Path(validator).resolve();self.sha=sha;self.journal=self.work/'reservation.json'
        if self.work.is_relative_to(self.repo):raise ValueError('PRIVATE_WORK_MUST_BE_OUTSIDE_REPO')
    def request(self,path,body=None):
        child=run(['node',str(self.transport),path],input=json.dumps(body) if body else '',timeout=55)
        try:env=json.loads(child.stdout)
        except Exception:raise ValueError('RECEIVER_TRANSPORT') from None
        if child.returncode or env.get('status',0)==0:raise ValueError('RECEIVER_TRANSPORT')
        if env['status']>=400:raise ValueError('RECEIVER_HTTP_'+str(env['status']))
        return base64.b64decode(env['bytes_b64'],validate=True),env.get('filename')
    def call(self,path,body=None):return json.loads(self.request(path,body)[0])
    def output(self,**values):
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'],'a') as f:
                for k,v in values.items():f.write(k+'='+str(v).lower()+'\n')
    def probe(self):
        state=self.call('/commercial/status')
        if state.get('observer_contract')!=CONTRACT:raise ValueError('RECEIVER_CONTRACT_MISMATCH')
        print(json.dumps({'stage':'publisher_probe','at':stamp(),'receiver_contract':CONTRACT,'pending':bool(state.get('pending')),'source_sha256':self.sha,'writes':0}))
    def begin(self):
        if self.journal.exists():raise ValueError('RESERVATION_ALREADY_STARTED')
        started=stamp();state=self.call('/commercial/status')
        if state.get('observer_contract')!=CONTRACT:raise ValueError('RECEIVER_CONTRACT_MISMATCH')
        if not state.get('pending') or state.get('file_sha256')!=self.sha:
            self.output(ready=False);print(json.dumps({'stage':'nothing_pending','at':stamp(),'source_sha256':self.sha}));return
        claim=self.call('/commercial/complete',{'status':'claim','sha256':self.sha})
        if claim.get('sha256')!=self.sha or not re.fullmatch(r'[a-f0-9-]{36}',claim.get('lease_token','')):raise ValueError('RESERVATION_IDENTITY')
        record={**claim,'started_at':started,'received_at':state['received_at'],'stage':'claimed'};save(self.journal,record)
        if read(self.repo/STATE)['origen_sha256']!=self.sha:
            raw,encoded=self.request('/commercial/report?sha256='+self.sha)
            if len(raw)>1000000 or hashlib.sha256(raw).hexdigest()!=self.sha:raise ValueError('SOURCE_INTEGRITY')
            filename=urllib.parse.unquote(encoded or '')
            # The original normalizer performs the definitive date/name check.
            if not re.fullmatch(r'Reporte-Inventario(?: (?:al )?\d{2}-\d{2}-\d{4})?\.xlsx',filename):raise ValueError('REPORT_FILENAME')
            target=self.work/'Reporte-Inventario.xlsx';target.write_bytes(raw);target.chmod(0o600)
            record.update(original_name=filename,downloaded_at=stamp(),bytes=len(raw));save(self.journal,record)
        self.output(ready=True)
        print(json.dumps({'stage':'source_reserved','started_at':started,'finished_at':stamp(),'source_sha256':self.sha,'downloaded':record.get('bytes',0)>0}))
    def prepare(self):
        record=read(self.journal);state=read(self.repo/STATE)
        if state['origen_sha256']==self.sha:
            print(json.dumps({'stage':'already_published','at':stamp(),'source_sha256':self.sha}));return
        if record['sha256']!=self.sha or record['lease_until']<=datetime.now(timezone.utc).timestamp()*1000:raise ValueError('RESERVATION_EXPIRED')
        source=self.work/'Reporte-Inventario.xlsx'
        if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=self.sha:raise ValueError('SOURCE_INTEGRITY')
        start=stamp();candidate=self.work/'candidate.json'
        args=[sys.executable,str(self.repo/'scripts/preparar-revision-comercial-593.py'),'--excel',str(source),'--estado',str(self.repo/STATE),
              '--corte-anterior',str(self.repo/CUT),'--catalogo',str(self.repo/'exportaciones/catalogo-ventas.json'),
              '--base-csv',str(self.repo/'datos-593/inventario-publico.csv'),'--recibido-en',record['received_at'],
              '--nombre-original',record['original_name'],'--validador',str(self.validator/'normalizar_593.py'),'--repo',str(self.repo),'--salida',str(candidate)]
        # Optional original obtained by the existing private transport; never
        # infer missing columns or bypass the original validator's requirement.
        previous=self.work/'previous.xlsx'
        if previous.is_file():args+=['--excel-anterior',str(previous)]
        completed=run(args,timeout=180)
        if completed.returncode:
            record.update(stage='validation_blocked',validation_started_at=start,validation_finished_at=stamp());save(self.journal,record)
            # Never print arbitrary subprocess output: it can contain file data.
            known=re.search(r'ERROR_593 (PREVIOUS_[A-Z_]+|APPROVED_ALTA_[A-Z_]+)',completed.stderr)
            raise ValueError(known.group(1) if known else 'ORIGINAL_VALIDATOR_REJECTED')
        cut=read(candidate)
        if cut.get('sha256_original')!=self.sha or cut.get('revision_fuente',{}).get('anterior_sha256')!=state['origen_sha256']:raise ValueError('PREPARED_SOURCE_MISMATCH')
        (self.repo/CUT).write_bytes(candidate.read_bytes())
        record.update(stage='prepared',validation_started_at=start,validation_finished_at=stamp(),base_sha256=state['origen_sha256']);save(self.journal,record)
        print(json.dumps({'stage':'validated','started_at':start,'finished_at':record['validation_finished_at'],'source_sha256':self.sha,'revision':cut['revision_fuente']['secuencia']}))
    def complete(self):
        record=read(self.journal)
        fetched=run(['git','fetch','origin','main'],cwd=self.repo,timeout=50)
        if fetched.returncode:raise ValueError('PUBLISHED_HEAD_UNAVAILABLE')
        commit=run(['git','rev-parse','origin/main'],cwd=self.repo).stdout.strip()
        state=run(['git','show','origin/main:'+STATE],cwd=self.repo)
        if state.returncode or not re.fullmatch(r'[a-f0-9]{40}',commit):raise ValueError('PUBLISHED_HEAD_UNAVAILABLE')
        data=json.loads(state.stdout)
        if data.get('origen_sha256')!=self.sha:raise ValueError('PUBLISHED_SOURCE_MISMATCH')
        validation={'cut_date':data['fecha_corte'],'generated_at':data['revision_fuente']['generado_en']}
        result=self.call('/commercial/complete',{'status':'processed','sha256':self.sha,'lease_token':record['lease_token'],'published_commit':commit,'validation':validation})
        if result.get('completed') is not True or result.get('raw_file_erased') is not True:raise ValueError('COMPLETION_NOT_VERIFIED')
        receipt=self.call('/commercial/status?sha256='+self.sha)
        if receipt.get('published_commit')!=commit or receipt.get('status')!='processed':raise ValueError('RECEIPT_NOT_VERIFIED')
        record.update(stage='complete',published_commit=commit,completed_at=stamp());save(self.journal,record)
        print(json.dumps({k:record[k] for k in ['stage','sha256','started_at','completed_at','published_commit']}))
    def release(self):
        if not self.journal.is_file():return
        record=read(self.journal)
        if record.get('stage')=='complete':return
        try:self.call('/commercial/complete',{'status':'release','sha256':self.sha,'lease_token':record['lease_token']})
        except ValueError as e:
            if str(e)!='RECEIVER_HTTP_409':raise
        print(json.dumps({'stage':'reservation_released_or_expired','at':stamp(),'source_sha256':self.sha}))
def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['probe','begin','prepare','complete','release'])
    for name in ['repo','work','transport','validator','sha']:p.add_argument('--'+name,required=True)
    a=p.parse_args()
    if os.environ.get('GITHUB_REF')!=BRANCH:raise ValueError('EXISTING_PILOT_BRANCH_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':raise ValueError('FREE_ONLY_REQUIRED')
    entry=Entry(a.repo,a.work,a.transport,a.validator,a.sha)
    getattr(entry,a.action)()
if __name__=='__main__':
    try:main()
    except Exception as e:
        code=str(e) if type(e) is ValueError and re.fullmatch(r'[A-Z0-9_]{1,80}',str(e)) else 'PUBLISHER_INPUT_FAILED'
        print('::error::'+code);raise SystemExit(1)
