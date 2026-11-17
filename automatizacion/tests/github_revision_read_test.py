"""Only remote revision authentication, validation and safe diagnostics."""
import io,json,os,socket,sys,unittest,urllib.error,urllib.request
from pathlib import Path
from unittest.mock import Mock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import github_revision_read as r
import scoped_content as original

SHA='a'*40
SECRET='synthetic-official-token-not-real'
class Reply:
    def __init__(self,body=None,status=200):
        self.raw=json.dumps(body if body is not None else {'object':{'type':'commit','sha':SHA}}).encode()
        self.status=status;self.headers={'X-RateLimit-Limit':'5000','X-RateLimit-Remaining':'4999'};self.sizes=[]
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,n):self.sizes.append(n);return self.raw[:n]

class RemoteRevision(unittest.TestCase):
    def test_authentication_is_exact_fixed_get_and_original_validator_still_bounds_body(self):
        reply=Reply();transport=Mock();transport.open.return_value=reply;diagnostics={}
        self.assertEqual(r.read_authenticated_revision(token=SECRET,diagnostics=diagnostics,transport=transport),SHA)
        request=transport.open.call_args.args[0]
        self.assertEqual(request.full_url,original.PUBLIC_REF_URL);self.assertEqual(request.get_method(),'GET');self.assertIsNone(request.data)
        self.assertEqual(request.get_header('Authorization'),'Bearer '+SECRET)
        self.assertEqual(request.get_header('Cache-control'),'no-cache');self.assertEqual(request.get_header('Pragma'),'no-cache')
        self.assertEqual(reply.sizes,[16385]);self.assertEqual(diagnostics['http_status'],200)
        self.assertEqual(diagnostics['authentication'],'github_actions_token');self.assertNotIn(SECRET,json.dumps(diagnostics))

    def test_missing_token_fails_before_network_without_anonymous_fallback(self):
        transport=Mock()
        with patch.dict(os.environ,{},clear=True),self.assertRaisesRegex(r.RevisionReadError,'TOKEN_REQUIRED'):
            r.read_authenticated_revision(transport=transport)
        transport.open.assert_not_called()

    def test_credentials_cannot_follow_another_url_method_body_or_existing_auth(self):
        transport=Mock();opener=r.RevisionOpener(SECRET,transport=transport)
        requests=[urllib.request.Request('https://example.invalid/'),urllib.request.Request(original.PUBLIC_REF_URL,method='POST'),
            urllib.request.Request(original.PUBLIC_REF_URL,data=b'{}'),urllib.request.Request(original.PUBLIC_REF_URL,headers={'Authorization':'foreign'})]
        for request in requests:
            with self.assertRaisesRegex(r.RevisionReadError,'SCOPE_DENIED'):opener.open(request)
        transport.open.assert_not_called()

    def test_invalid_sha_type_duplicate_json_and_oversize_fail_original_validation(self):
        replies=[Reply({'object':{'type':'tag','sha':SHA}}),Reply({'object':{'type':'commit','sha':'A'*40}}),Reply({})]
        duplicate=Reply();duplicate.raw=b'{"object":{},"object":{}}';replies.append(duplicate)
        oversized=Reply();oversized.raw=b'x'*16385;replies.append(oversized)
        for reply in replies:
            transport=Mock();transport.open.return_value=reply
            with self.assertRaisesRegex(r.RevisionReadError,'INVALID_RESPONSE'):
                r.read_authenticated_revision(token=SECRET,transport=transport)

    def test_remote_revision_cannot_be_substituted_with_expected_local_revision(self):
        transport=Mock();transport.open.return_value=Reply()
        actual=r.read_authenticated_revision(token=SECRET,transport=transport)
        self.assertNotEqual(actual,'b'*40)
        with self.assertRaisesRegex(original.ScopedError,'REVISION_NOT_CURRENT'):
            original.require_latest_revision('b'*40,lambda:actual)

    def test_http_error_types_and_rate_limit_are_preserved_without_response_or_token(self):
        for status,headers,code in [(403,{'X-RateLimit-Remaining':'0'},'RATE_LIMIT'),(403,{},'FORBIDDEN'),
            (401,{},'UNAUTHORIZED'),(404,{},'REF_NOT_FOUND'),(429,{},'RATE_LIMIT'),(502,{},'SERVICE_UNAVAILABLE')]:
            transport=Mock();transport.open.side_effect=urllib.error.HTTPError(original.PUBLIC_REF_URL,status,SECRET,headers,io.BytesIO(SECRET.encode()))
            info={}
            with self.assertRaisesRegex(r.RevisionReadError,code) as caught:
                r.read_authenticated_revision(token=SECRET,diagnostics=info,transport=transport)
            self.assertNotIn(SECRET,str(caught.exception));self.assertNotIn(SECRET,json.dumps(info))
            self.assertEqual(info['http_status'],status);self.assertEqual(info['requests'],1)

    def test_connectivity_dns_timeout_and_tls_have_fixed_diagnostics_and_no_retry(self):
        for error,code in [(urllib.error.URLError(socket.gaierror(1,SECRET)),'DNS_FAILED'),
            (urllib.error.URLError(TimeoutError(SECRET)),'TIMEOUT'),(RuntimeError(SECRET),'CONNECTIVITY_FAILED')]:
            transport=Mock();transport.open.side_effect=error
            with self.assertRaisesRegex(r.RevisionReadError,code) as caught:r.read_authenticated_revision(token=SECRET,transport=transport)
            self.assertNotIn(SECRET,str(caught.exception));transport.open.assert_called_once()

    def test_redirect_is_denied_without_sending_token_to_new_host(self):
        transport=Mock();transport.open.side_effect=original.ScopedError('CF_REDIRECT_DENIED')
        with self.assertRaisesRegex(r.RevisionReadError,'REDIRECT_DENIED'):r.read_authenticated_revision(token=SECRET,transport=transport)
        transport.open.assert_called_once()

    def test_original_scoped_file_and_checkout_artifacts_are_unchanged(self):
        import install_checkout as install
        install.approved_artifacts()
        old=json.loads((install.ROOT.parent/'.github/checkout-install-once.json').read_text())
        self.assertIs(old['enabled'],False);self.assertEqual(old['closed_after_run'],'44146619274')

    def test_read_job_skips_writes_uses_only_official_contents_read_and_no_worker_credentials(self):
        root=Path(__file__).resolve().parents[2];workflow=(root/'.github/workflows/central-593.yml').read_text()
        read=workflow.split('  verificar_revision_github_lectura:',1)[1]
        old=workflow.split('  ingresar:',1)[1].split('steps:',1)[0]
        self.assertIn("!contains(github.event.head_commit.message, '[checkout-revision-read]')",old)
        self.assertIn('contents: read',workflow);self.assertNotIn('contents: write',workflow)
        self.assertIn('GITHUB_TOKEN: ${{ github.token }}',read);self.assertIn('environment: conectatech-piloto-gratis',read)
        for denied in ['CLOUDFLARE','PILOT_TOKEN','--install','--ingest','--bootstrap']:
            self.assertNotIn(denied,read)
        self.assertIn("!contains(github.event.head_commit.message, '[checkout-install-388]')",read)

if __name__=='__main__':unittest.main()
