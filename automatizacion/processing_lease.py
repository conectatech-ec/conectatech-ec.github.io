"""Private runner-only fencing state; never under the artifact/source directory."""
import json, os, tempfile, re
from pathlib import Path


def location():
    run = re.sub(r'[^a-zA-Z0-9_-]', '_', os.environ.get('GITHUB_RUN_ID', 'local'))
    attempt = re.sub(r'[^a-zA-Z0-9_-]', '_', os.environ.get('GITHUB_RUN_ATTEMPT', '1'))
    return Path(os.environ.get('RUNNER_TEMP', tempfile.gettempdir())) / ('conectatech-593-lease-'+run+'-'+attempt+'.json')


def save(sha, lease):
    data = {'sha256': sha, 'lease_token': lease}
    path = location()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(data, stream)
    return data


def finish(request, status, *, validation=None, error_code=None):
    path = location()
    if not path.exists():
        return
    data = json.loads(path.read_text())
    payload = {**data, 'status': status}
    if validation is not None:
        payload['validation'] = {k: validation[k] for k in ('cut_date', 'generated_at')}
    if error_code:
        payload['error_code'] = error_code
    with request('/commercial/complete', payload) as response:
        result = json.load(response)
    path.unlink(missing_ok=True)
    return result


if __name__ == '__main__':
    import sys
    from process_pending_593 import request
    if sys.argv[1:] != ['--release']:
        raise SystemExit('Only --release is supported')
    finish(request, 'release')
