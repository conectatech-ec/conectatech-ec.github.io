"""Offline contracts for one existing job and the narrow Data Hub integration."""
import ast, contextlib, importlib.util, io, json, os, subprocess, sys, tempfile, types, unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class ScopedIntegration(unittest.TestCase):
    def test_promotion_is_explicit_and_existing_prepare_inspects_without_mutating(self):
        text=(ROOT.parent/'.github/workflows/central-593.yml').read_text()
        self.assertIn("c.get('datahub_scoped_content_enabled') is True",text)
        self.assertIn("if: false && steps.scoped_mode.outputs.authorized == 'true'",text)
        self.assertIn("'automatizacion/activar-cloud.json'",text)
        self.assertLess(text.index('scoped_content_test.py'),text.index('- id: scoped_mode'))
        inspect=(ROOT.parent/'.github/workflows/comercial-cloud.yml').read_text().split('\n  sincronizar_meta:\n',1)[0]
        self.assertIn('run: python automatizacion/scoped_content.py --inspect',inspect)
        self.assertNotIn('scoped_content.py --bootstrap',inspect)
        self.assertNotIn('scoped_content.py --ingest',inspect)
        self.assertIn("steps.config.outputs.activar == 'false' && steps.config.outputs.sincronizar_meta == 'false'",inspect)
    def test_one_job_same_trigger_permissions_and_no_full_deployer(self):
        text=(ROOT.parent/'.github/workflows/central-593.yml').read_text()
        self.assertEqual(text.count('    runs-on:'),1)
        self.assertNotIn('schedule:',text);self.assertNotIn('workflow_dispatch:',text)
        self.assertIn('group: comercial-cloud-piloto',text)
        self.assertIn('  contents: read',text)
        self.assertIn('    timeout-minutes: 10',text)
        self.assertNotIn('run: python automatizacion/deploy_free.py',text)
        self.assertNotIn('scoped_content.py --bootstrap',text)
        self.assertNotIn('run: node automatizacion/central-e2e.mjs',text)
        positions=[text.index(s) for s in ('python automatizacion/tests/sync_593_test.py',
            'python automatizacion/scoped_content.py --install-receiver','python automatizacion/process_pending_593.py',
            'python automatizacion/scoped_content.py --ingest')]
        self.assertEqual(positions,sorted(positions))

    def test_workflow_binds_only_validated_same_job_sha_and_separate_releases(self):
        text=(ROOT.parent/'.github/workflows/central-593.yml').read_text()
        self.assertIn('CENTRAL_EXPECTED_SOURCE_SHA256: ${{ steps.reporte.outputs.validated_source_sha256 }}',text)
        self.assertIn('COMMERCIAL_PROCESSOR_EXPECTED_RELEASE: ${{ steps.receiver.outputs.processor_release }}',text)
        self.assertNotIn('PILOT_DEPLOY_RELEASE:',text)
        self.assertIn("if: false && steps.scoped_mode.outputs.authorized == 'true' && steps.receiver.outputs.ready == 'true'",text)
        self.assertNotIn('automatizacion/central/',text.split('actions/upload-artifact@v4')[1])

    def test_processor_output_is_after_validation_and_never_arms_full_upload(self):
        text=(ROOT/'process_pending_593.py').read_text()
        self.assertNotIn('activar-cloud.json',text)
        self.assertGreater(text.index("output(True,canonical['source']['sha256'])"),text.index("write_bundle(ROOT/'central'"))
        import process_pending_593 as processor
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'GITHUB_OUTPUT':str(Path(folder)/'output')}):
            processor.output(False)
            self.assertNotIn('validated_source_sha256',(Path(folder)/'output').read_text())
            with self.assertRaisesRegex(ValueError,'VALIDATED_SOURCE_SHA_REQUIRED'):processor.output(True)
            processor.output(True,'a'*64)
            self.assertIn('validated_source_sha256='+'a'*64,(Path(folder)/'output').read_text())

    def test_receiver_has_one_render_token_and_no_environment_release_fallback(self):
        text=(ROOT/'commercial-reception.mjs').read_text()
        self.assertEqual(text.count('__COMMERCIAL_PROCESSOR_RELEASE__'),1)
        self.assertEqual(text.count('__COMMERCIAL_PROCESSOR_CODE_SHA256__'),1)
        self.assertIn("const COMMERCIAL_PROCESSOR_RELEASE='__COMMERCIAL_PROCESSOR_RELEASE__';",text)
        self.assertIn('const release=COMMERCIAL_PROCESSOR_RELEASE;',text)
        self.assertNotIn('env.PILOT_RELEASE',text)
        self.assertIn('r.head_sha===release',text)
        self.assertIn('processor_release:COMMERCIAL_PROCESSOR_RELEASE,schema:central.schema',text)

    def test_e2e_uses_safe_catalog_status_for_processor_and_does_not_log_finance(self):
        text=(ROOT/'central-e2e.mjs').read_text()
        self.assertIn('d.processor_release===process.env.EXPECTED_PROCESSOR_RELEASE',text)
        self.assertIn('health.release===process.env.EXPECTED_RELEASE',text)
        self.assertNotIn("await get('/commercial/status')",text)
        self.assertNotIn('text:a.text',text)
        self.assertNotIn('String(e.message)',text)

    def test_rendered_receiver_dispatches_only_exact_processor_revision(self):
        # All HTTP below is a per-process mock; the synthetic XLSX never leaves RAM.
        code=r'''
import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const root=process.argv[2];
const {workbook}=await import(new URL('tests/sync-fixtures.mjs',root).href);
let source=fs.readFileSync(new URL('commercial-reception.mjs',root),'utf8');
source=source.replace("import {seal,unseal} from './messenger-control.mjs';","const seal=async()=> 'synthetic';const unseal=async()=> ''; ");
source=source.replace("import {central,validateCentral} from './central-source.mjs';","const central={schema:'synthetic',source:{sha256:'a'.repeat(64),cut_date:'2026-11-02',generated_at:'2026-11-02T22:48:22Z'},products:[]};const validateCentral=()=>{};");
source=source.replace('__COMMERCIAL_PROCESSOR_RELEASE__','a'.repeat(40));
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(mod.centralStatus().processor_release,'a'.repeat(40));
for(const matched of [false,true]){
 const db=new DatabaseSync(':memory:');const writes=[];
 const box={name:'commercial-source',env:{COMMERCIAL_ACTIONS_TOKEN:'synthetic-only',PILOT_RELEASE:'b'.repeat(40)},state:{storage:{setAlarm:async()=>{}}},sql:{exec(s,...p){const q=db.prepare(s);const rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows};}}};
 mod.commercialInit(box);
 globalThis.fetch=async(url,opts)=>{
  if(opts?.method==='POST'){writes.push(String(url));return Response.json({}, {status:201});}
  if(String(url).includes('/jobs'))return Response.json({jobs:[{id:777,name:'ingresar'}]});
  assert.equal(new URL(url).searchParams.get('head_sha'),'a'.repeat(40));
  const laterUnrelated=Array.from({length:8},(_,i)=>({id:900+i,head_branch:'automatizacion/piloto-cloud-3sku-20261015',head_sha:'d'.repeat(40),path:'.github/workflows/central-593.yml'}));
  assert.ok(laterUnrelated.length>5); // Server-side head_sha excludes these newer unrelated runs.
  const allRuns=[...laterUnrelated,{id:333,head_branch:'automatizacion/piloto-cloud-3sku-20261015',head_sha:(matched?'a':'b').repeat(40),path:'.github/workflows/central-593.yml'}];
  return Response.json({workflow_runs:allRuns.filter(run=>run.head_sha===new URL(url).searchParams.get('head_sha')).slice(0,5)});
 };
 const response=await mod.commercialFetch('/commercial/report',new Request('https://inbox/commercial/report',{method:'POST',headers:{'X-Report-Filename':'Reporte-Inventario.xlsx'},body:workbook('scoped')}),box);
 const result=await response.json();assert.equal(result.trigger,matched?'triggered':'bootstrap_workflow_required');
 assert.equal(writes.length,matched?1:0);if(matched)assert.ok(writes[0].endsWith('/actions/jobs/777/rerun'));
 db.close();
}
'''
        run=subprocess.run(['node','--input-type=module','-',ROOT.as_uri()+'/'],input=code,text=True,capture_output=True)
        self.assertTrue(run.returncode==0,'SYNTHETIC_RENDER_DISPATCH_FAILED')

    def test_datahub_log_omits_internal_private_signature_but_retains_receipt_contract(self):
        import data_hub_593 as hub
        now=datetime.now(timezone.utc)
        data={'source':{'sha256':'a'*64,'cut_date':now.date().isoformat(),'generated_at':now.isoformat()},
            'normalized_at':now.isoformat(),'expires_at':(now+timedelta(hours=24)).isoformat(),
            'products':[{'sku':'TEST001','source_name':'SYNTHETIC_PRIVATE_MARKER','variant_gb':[],
                'prices':{'currency':'USD','promo_cash_cents':100,'pvp_card_cents':120},
                'availability':'in_stock','blocked_reasons':[]}]}
        def request(path):return io.BytesIO(json.dumps({'current':True,'source_sha256':'a'*64} if path.endswith('/status') else data).encode())
        with tempfile.TemporaryDirectory() as folder,patch.dict(sys.modules,{'process_pending_593':types.SimpleNamespace(request=request)}):
            out=Path(folder);(out/'current.json').write_text(json.dumps(data));(out/'changes.json').write_text('{"changed_sku":[]}')
            captured=io.StringIO()
            with contextlib.redirect_stdout(captured):hub.verify_alex(out)
            result=json.loads(captured.getvalue())
            self.assertTrue(result['receipt_verified']);self.assertFalse(result['commercial_signature_logged'])
            self.assertNotIn('receipt',result);self.assertNotIn('SYNTHETIC_PRIVATE_MARKER',captured.getvalue())
            self.assertNotIn(hub.signature(data),captured.getvalue())
            internal=json.loads((out/'hub.json').read_text())
            self.assertEqual(internal['channels']['alex_messenger']['receipt']['commercial_signature'],hub.signature(data))

if __name__=='__main__':unittest.main()
