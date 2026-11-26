"""Exact additive integration of the current receiver; no provider writes."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RECEIVER_BEFORE='699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869'
WORKER_BEFORE='57226559e6ab2a151e2ff9297a6dea0805bd3fbbbf7126716c0a298efa55794e'
def digest(data):return hashlib.sha256(data).hexdigest()
def one(text,old,new):
    if text.count(old)!=1:raise ValueError('PATCH_ANCHOR_MISMATCH')
    return text.replace(old,new,1)
def patch_receiver(raw):
    if digest(raw)!=RECEIVER_BEFORE:raise ValueError('RECEIVER_BASE_CHANGED')
    s=raw.decode()
    s=one(s,"import {seal,unseal} from './messenger-control.mjs';", "import {seal,unseal} from './messenger-control.mjs';\nimport {observerContract,observerReady,dispatchReport,verifyPublished593} from './observer-dispatch.mjs';")
    start=s.index('async function dispatch(env){');end=s.index('\nasync function triggerPending(',start)
    s=s[:start]+'async function dispatch(env,sha){return dispatchReport(env,sha);}\n'+s[end:]
    s=one(s,'await dispatch(box.env);','await dispatch(box.env,sha);')
    s=one(s,"sha);if(!found)return null;","sha);if(!found||found.status==='expired')return null;")
    anchor=" box.sql.exec('INSERT OR IGNORE INTO commercial_receipts(sha,filename,received,status,error) SELECT sha,filename,received,status,error FROM commercial_inbox');"
    s=one(s,anchor,anchor+"\n const columns=new Set(box.sql.exec('PRAGMA table_info(commercial_receipts)').toArray().map(r=>r.name));\n for(const [name,type] of [['published_commit','TEXT'],['published_at','TEXT'],['detected_at','TEXT']])if(!columns.has(name))box.sql.exec('ALTER TABLE commercial_receipts ADD COLUMN '+name+' '+type);")
    s=one(s,'sha256:r.sha,original_name:r.filename,','sha256:r.sha,published_commit:r.published_commit||null,published_at:r.published_at||null,detected_at:r.detected_at||null,original_name:r.filename,')
    s=one(s,'automatic_trigger_configured:!!box.env.COMMERCIAL_ACTIONS_TOKEN,','observer_contract:observerContract,automatic_trigger_configured:observerReady(box.env),')
    anchor="  box.sql.exec('INSERT INTO commercial_receipts(sha,filename,received,status) VALUES(?,?,?,?)',sha,filename,now,'received');"
    s=one(s,anchor,anchor+"\n  const detected=req.headers.get('X-Report-Detected-At');\n  if(detected&&Number.isFinite(Date.parse(detected))&&Date.parse(detected)<=now)box.sql.exec('UPDATE commercial_receipts SET detected_at=? WHERE sha=?',new Date(detected).toISOString(),sha);")
    s=one(s,"'INSERT INTO commercial_receipts(sha,filename,received,status) VALUES(?,?,?,?)',sha,filename,now,'received'", "\"INSERT INTO commercial_receipts(sha,filename,received,status) VALUES(?,?,?,?) ON CONFLICT(sha) DO UPDATE SET received=excluded.received,status=excluded.status,error=NULL,lease=NULL,lease_until=0,attempts=0,last_trigger=0,trigger_state=NULL WHERE commercial_receipts.status='expired'\",sha,filename,now,'received'")
    anchor="  box.sql.exec('UPDATE commercial_receipts SET status=?,cut_date=?,generated_at=?,error=?,lease=NULL,lease_until=0 WHERE sha=?',b.status,b.status==='processed'?v.cut_date:null,b.status==='processed'?v.generated_at:null,error,row.sha);"
    replacement="""  if(b.status==='processed'){
   if(!await verifyPublished593(row.sha,b.published_commit,v))return json({error:'PUBLISHED_COMMIT_REQUIRED'},409);
   // The public verification awaits network: fence the reservation again.
   const fresh=query(box,'SELECT * FROM commercial_receipts WHERE sha=?',row.sha);
   if(!fresh||fresh.status!=='received'||fresh.lease!==b.lease_token||fresh.lease_until<=Date.now())return json({error:'REPORT_LEASE'},409);
   box.sql.exec('UPDATE commercial_receipts SET published_commit=?,published_at=? WHERE sha=?',b.published_commit,new Date().toISOString(),row.sha);
  }
"""+anchor
    s=one(s,anchor,replacement)
    return s.encode()
def patch_worker(raw):
    if digest(raw)!=WORKER_BEFORE:raise ValueError('WORKER_BASE_CHANGED')
    s=raw.decode()
    s=one(s,"import {uploadPage,centralStatus} from './commercial-reception.mjs';","import {uploadPage,centralStatus} from './commercial-reception.mjs';\nimport {handleObserverRequest} from './observer-auth.mjs';")
    s=one(s,"  if(!await authorized(req,env)) return json({error:'Unauthorized'},401);","  const observer=await handleObserverRequest(req,env);if(observer)return observer;\n  if(!await authorized(req,env)) return json({error:'Unauthorized'},401);")
    return s.encode()
if __name__=='__main__':
    target=ROOT/'candidate';target.mkdir(exist_ok=True)
    outputs={'commercial-reception.mjs':patch_receiver((ROOT/'base/commercial-reception-installed.mjs').read_bytes()),
             'worker.mjs':patch_worker((ROOT/'base/worker-installed.mjs').read_bytes()),
             **{n:(ROOT/n).read_bytes() for n in ['observer-auth.mjs','observer-dispatch.mjs']}}
    for name,data in outputs.items():(target/name).write_bytes(data)
    print(json.dumps({'writes_to_provider':0,'modules':{n:digest(d) for n,d in outputs.items()}}))
