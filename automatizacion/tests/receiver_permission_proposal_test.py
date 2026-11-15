"""New inactive-permission contracts only. No transport, installer or old suite execution."""
import hashlib,json,os,subprocess,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as scoped

class ProposedPermission(unittest.TestCase):
    def env(self):
        return {'GITHUB_REF':scoped.BRANCH,'GITHUB_SHA':'d'*40,'GITHUB_WORKFLOW_SHA':'d'*40,
            'GITHUB_WORKFLOW_REF':'conectatech-ec/conectatech-ec.github.io/.github/workflows/central-593.yml@'+scoped.BRANCH,
            'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1','CF_FREE_ONLY_CONFIRMED':'true',
            'CENTRAL_RECEIVER_INSTALL_AUTHORIZATION':scoped.RECEIVER_INSTALL_AUTHORIZATION}
    def config(self):return {'activar':False,'datahub_scoped_content_enabled':False,'sincronizar_meta_verify_token':False,'costo_maximo_usd':0}
    def test_permission_disabled_by_default_before_all_external_access(self):
        self.assertIs(scoped.RECEIVER_INSTALL_PERMISSION_ENABLED,False)
        with patch.dict(os.environ,self.env(),clear=True),patch.object(scoped.subprocess,'check_output') as history,patch.object(scoped,'read_latest_config') as config,patch.object(scoped,'CFClient') as api:
            with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_INSTALLATION_DISABLED'):scoped.require_receiver_installation()
            history.assert_not_called();config.assert_not_called();api.assert_not_called()
    def test_future_parent_is_separate_from_artifacts_under_test_only_enablement(self):
        self.assertNotEqual(scoped.RECEIVER_INSTALL_PARENT,scoped.APPROVED_RECEIVER_RELEASE)
        with patch.object(scoped,'RECEIVER_INSTALL_PERMISSION_ENABLED',True),patch.dict(os.environ,self.env(),clear=True),patch.object(scoped.subprocess,'check_output',side_effect=['d'*40,scoped.RECEIVER_INSTALL_PARENT]),patch.object(scoped,'read_latest_config',return_value=self.config()),patch.object(scoped,'require_latest_revision') as revision:
            scoped.require_receiver_installation();revision.assert_called_once_with('d'*40)
        self.assertIs(scoped.RECEIVER_INSTALL_PERMISSION_ENABLED,False)
    def test_old_identifier_and_attempt_two_cannot_be_reused_even_if_enabled(self):
        for edit in ({'CENTRAL_RECEIVER_INSTALL_AUTHORIZATION':scoped.CONSUMED_RECEIVER_INSTALL_AUTHORIZATION},{'GITHUB_RUN_ATTEMPT':'2'}):
            with patch.object(scoped,'RECEIVER_INSTALL_PERMISSION_ENABLED',True),patch.dict(os.environ,{**self.env(),**edit},clear=True),patch.object(scoped.subprocess,'check_output') as history:
                with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_INSTALLATION_NOT_AUTHORIZED'):scoped.require_receiver_installation()
                history.assert_not_called()
    def test_wrong_parent_and_armed_commercial_flags_or_cost_fail(self):
        for parent,config in [(scoped.APPROVED_RECEIVER_RELEASE,self.config()),(scoped.RECEIVER_INSTALL_PARENT,{**self.config(),'activar':True}),(scoped.RECEIVER_INSTALL_PARENT,{**self.config(),'datahub_scoped_content_enabled':True}),(scoped.RECEIVER_INSTALL_PARENT,{**self.config(),'costo_maximo_usd':1})]:
            with patch.object(scoped,'RECEIVER_INSTALL_PERMISSION_ENABLED',True),patch.dict(os.environ,self.env(),clear=True),patch.object(scoped.subprocess,'check_output',side_effect=['d'*40,parent]),patch.object(scoped,'read_latest_config',return_value=config),patch.object(scoped,'require_latest_revision'):
                with self.assertRaises(scoped.ScopedError):scoped.require_receiver_installation()
    def test_both_public_identities_are_reconciled_and_only_stamps_differ(self):
        references=[(scoped.APPROVED_RECEIVER_RELEASE,scoped.APPROVED_RECEIVER_CODE,scoped.APPROVED_RECEIVER_BODY),
            (scoped.RECEIVER_INSTALL_PARENT,'4def4c9a1c494610726bcee73d1735ab389d82000bd40d788c04496a58bb2aad','6077f9d354542373712b6e3bbe87f3c39eea88fd391e049a21f53ba383a2f688')]
        templates=[]
        for ref,code,module in references:
            digest=hashlib.sha256();template=None
            for name in scoped.CRITICAL_FILES:
                value=subprocess.check_output(['git','show',ref+':'+name],cwd=scoped.ROOT.parent)
                digest.update(name.encode()+b'\0'+len(value).to_bytes(8,'big')+value)
                if name=='automatizacion/commercial-reception.mjs':template=value
            self.assertEqual(digest.hexdigest(),code)
            self.assertEqual(hashlib.sha256(template).hexdigest(),scoped.REVIEWED_RECEIVER_SHA256)
            body=template.replace(scoped.PLACEHOLDER.encode(),ref.encode()).replace(scoped.CODE_PLACEHOLDER.encode(),code.encode())
            self.assertEqual(hashlib.sha256(body).hexdigest(),module);templates.append(template)
        self.assertEqual(templates[0],templates[1])
    def test_live_workflow_stays_read_only_without_permission_identifier(self):
        text=(scoped.ROOT.parent/'.github/workflows/central-593.yml').read_text()
        self.assertIn('run: python automatizacion/scoped_content.py --plan-receiver',text)
        self.assertNotIn('scoped_content.py --install-receiver',text)
        self.assertNotIn('CENTRAL_RECEIVER_INSTALL_AUTHORIZATION:',text)
        config=json.loads((scoped.ROOT/'activar-cloud.json').read_text())
        self.assertIs(config['activar'],False);self.assertIs(config['datahub_scoped_content_enabled'],False)

if __name__=='__main__':unittest.main()
