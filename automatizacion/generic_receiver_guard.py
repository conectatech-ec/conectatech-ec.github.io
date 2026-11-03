"""Preserve the live Data Hub receiver during an unrelated generic deployment.

Only authenticated GET content/v2 via the existing scoped client. All module
bodies remain in caller memory. A fixed error never includes private contents.
"""

TARGET='commercial-reception.mjs'

def preserve_live_receiver(files, client, expected_source=None):
    from scoped_content import same_bundle,bundled_source,same_json
    try:
        captured=client.get_bundle()
        live=[part for part in captured.parts if part.name==TARGET]
        if len(live)!=1 or sum(item[0]==TARGET for item in files)!=1:
            raise ValueError()
        part=live[0]
        if not isinstance(part.body,bytes) or not part.body or not isinstance(part.content_type,str) or not part.content_type:
            raise ValueError()
        # HTTP propagation must not let an older body replace a newer CF module.
        if expected_source is not None and not same_json(bundled_source(captured),expected_source):
            raise ValueError()
        selected=[(name,part.content_type,part.body) if name==TARGET else (name,ctype,body)
                  for name,ctype,body in files]
    except Exception:
        raise RuntimeError('LIVE_RECEIVER_CAPTURE_FAILED; values withheld') from None

    def verify_unchanged():
        try:
            # This fences a concurrent Data Hub bootstrap or ANY other module edit.
            if not same_bundle(captured,client.get_bundle()):raise ValueError()
        except Exception:
            raise RuntimeError('LIVE_BUNDLE_CHANGED_BEFORE_UPLOAD; values withheld') from None
    return selected,verify_unchanged
