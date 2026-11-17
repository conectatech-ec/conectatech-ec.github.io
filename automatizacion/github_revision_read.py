"""Official Actions token, fixed GET endpoint, original strict revision validator.

No Worker/Cloudflare identity is accepted. No redirects, retries or anonymous
fallback. Diagnostics contain only fixed codes, HTTP status and numeric limits.
"""
import os,socket,ssl,urllib.error,urllib.request
from scoped_content import PUBLIC_REF_URL,NoRedirect,ScopedError,read_latest_revision

class RevisionReadError(RuntimeError):
    def __init__(self,code):self.code=code;super().__init__(code)

def number(headers,name):
    value=headers.get(name) if headers else None
    return int(value) if isinstance(value,str) and value.isdigit() and len(value)<=9 else None

class RevisionOpener:
    def __init__(self,token=None,*,anonymous_probe=False,transport=None):
        if not token and not anonymous_probe:raise RevisionReadError('GITHUB_REVISION_TOKEN_REQUIRED')
        self.token=token;self.transport=transport or urllib.request.build_opener(NoRedirect())
        self.diagnostics={'authentication':'github_actions_token' if token else 'anonymous_probe',
            'http_status':None,'rate_limit':None,'rate_remaining':None,'requests':0}
        self.failure=None
    def status(self,status,headers):
        self.diagnostics.update(http_status=status,rate_limit=number(headers,'X-RateLimit-Limit'),
            rate_remaining=number(headers,'X-RateLimit-Remaining'))
        if status==429 or status==403 and self.diagnostics['rate_remaining']==0:return 'GITHUB_REVISION_RATE_LIMIT'
        if status==401:return 'GITHUB_REVISION_UNAUTHORIZED'
        if status==403:return 'GITHUB_REVISION_FORBIDDEN'
        if status==404:return 'GITHUB_REVISION_REF_NOT_FOUND'
        if 300<=status<400:return 'GITHUB_REVISION_REDIRECT_DENIED'
        if 500<=status<=599:return 'GITHUB_REVISION_SERVICE_UNAVAILABLE'
        return 'GITHUB_REVISION_HTTP_REJECTED'
    def open(self,request,timeout=30):
        if (request.full_url!=PUBLIC_REF_URL or request.get_method()!='GET' or request.data is not None or
            request.get_header('Authorization') or request.get_header('Cookie')):
            self.failure='GITHUB_REVISION_SCOPE_DENIED';raise RevisionReadError(self.failure)
        headers=dict(request.header_items())
        if self.token:headers['Authorization']='Bearer '+self.token
        headers['X-GitHub-Api-Version']='2022-11-28'
        outgoing=urllib.request.Request(PUBLIC_REF_URL,method='GET',headers=headers)
        self.diagnostics['requests']+=1
        try:
            response=self.transport.open(outgoing,timeout=timeout)
            code=self.status(response.status,getattr(response,'headers',{}))
            if response.status!=200:self.failure=code
            return response
        except urllib.error.HTTPError as error:
            self.failure=self.status(error.code,error.headers);raise
        except ScopedError:
            self.failure='GITHUB_REVISION_REDIRECT_DENIED';raise
        except Exception as error:
            reason=error.reason if isinstance(error,urllib.error.URLError) else error
            self.failure=('GITHUB_REVISION_TIMEOUT' if isinstance(reason,(TimeoutError,socket.timeout)) else
                'GITHUB_REVISION_DNS_FAILED' if isinstance(reason,socket.gaierror) else
                'GITHUB_REVISION_TLS_FAILED' if isinstance(reason,ssl.SSLError) else 'GITHUB_REVISION_CONNECTIVITY_FAILED')
            raise

def read_revision(opener):
    try:return read_latest_revision(opener=opener)
    except Exception:
        raise RevisionReadError(opener.failure or 'GITHUB_REVISION_INVALID_RESPONSE') from None

def read_authenticated_revision(*,token=None,diagnostics=None,transport=None):
    # Explicit anonymous probing lives only in the read-only verifier below;
    # installation always requires the official workflow token.
    opener=RevisionOpener(token=token if token is not None else os.environ.get('GITHUB_TOKEN'),transport=transport)
    try:return read_revision(opener)
    finally:
        if diagnostics is not None:diagnostics.update(opener.diagnostics)
