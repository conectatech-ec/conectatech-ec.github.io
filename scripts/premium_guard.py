"""Owner policy gate: preserve pending masters and validate new commercial batches."""
import argparse
import hashlib
import json
from pathlib import Path


def validate_commercial(root, manifest, policy, premium):
    if not policy.get('autorizacion_propietario', {}).get('evidencia'):
        raise ValueError('Estrategia comercial sin instrucción documentada del propietario.')
    skus = manifest.get('skus', [])
    if manifest.get('version') != 3 or not skus or len(skus) > policy.get('tamano_maximo_lote', 30) or len(set(skus)) != len(skus):
        raise ValueError('La estrategia comercial requiere contrato v3, selección única y tamaño permitido.')
    pending = {r.get('sha256_maestro'): r for r in premium.get('productos', {}).values()}
    for sku in skus:
        checks = manifest.get('aprobaciones', {}).get(sku, {})
        if (checks.get('estado') != 'APROBADO' or any(checks.get(k) is not True for k in
                ['identidad_verificada', 'ficha_verificada', 'uso_comercial_permitido'])):
            raise ValueError(f'{sku}: identidad, ficha o derechos pendientes; conservar en revisión.')
        images = manifest.get('imagenes', {}).get(sku, [])
        if not images or sum(im.get('posicion') == 1 for im in images) != 1:
            raise ValueError(f'{sku}: falta una portada única revisada.')
        for im in images:
            digest = im.get('sha256')
            source = (root / im.get('archivo', '')).resolve()
            if not digest or not source.is_relative_to(root) or not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != digest:
                raise ValueError(f'{sku}: bytes del maestro distintos de los revisados.')
            if digest in pending:
                old = pending[digest]
                approval = old.get('aprobacion_visual', {})
                if (old.get('fidelidad_resuelta') is not True or approval.get('aprobado_por_propietario') is not True or
                        not approval.get('fecha') or not approval.get('evidencia') or approval.get('sha256') != digest):
                    raise ValueError(f'{sku}: propuesta premium anterior pendiente; no convertirla en aprobada por el cambio de estrategia.')
    # The existing v3 processor and prepublication contract validate source rights,
    # SKU identity, commercial data, visual evidence and actual output files.


def validate(root, manifest):
    root = Path(root).resolve()
    path = root / 'importacion/premium-activo.json'
    strategy = root / 'importacion/estrategia-comercial.json'
    if strategy.is_file():
        policy = json.loads(strategy.read_text())
        if policy.get('estado') == 'ACTIVA' and policy.get('modo') == 'FUENTES_AUTENTICAS_Y_RETOQUE_COMERCIAL':
            validate_commercial(root, manifest, policy, json.loads(path.read_text()) if path.is_file() else {})
            return
    if not path.exists():
        return  # Historical/import test repositories without the premium policy.
    state = json.loads(path.read_text())
    if state.get('estado') != 'APROBADO_PARA_APLICAR':
        raise ValueError('Publicación suspendida por el propietario: falta aprobación visual del lote premium.')
    if state.get('estandar_aprobado_por_propietario') is not True:
        raise ValueError('El estándar premium todavía no está aprobado por el propietario.')
    selected = state.get('productos', {})
    if not manifest.get('skus') or len(manifest['skus']) > state.get('tamano_maximo', 5):
        raise ValueError('Lote vacío o superior al tamaño autorizado.')
    for sku in manifest['skus']:
        record = selected.get(sku, {})
        approval = record.get('aprobacion_visual', {})
        digest = record.get('sha256_maestro')
        if (approval.get('aprobado_por_propietario') is not True or
                not approval.get('evidencia') or not approval.get('fecha') or
                not digest or approval.get('sha256') != digest or
                record.get('fidelidad_resuelta') is not True):
            raise ValueError(f'{sku}: falta aprobación del propietario vinculada al maestro y fidelidad resuelta.')
        images = manifest.get('imagenes', {}).get(sku, [])
        if len(images) != 1 or images[0].get('posicion') != 1 or images[0].get('sha256') != digest:
            raise ValueError(f'{sku}: el manifiesto no corresponde a la portada aprobada.')
        source = (root / images[0]['archivo']).resolve()
        if (not source.is_relative_to(root) or not source.is_file() or
                hashlib.sha256(source.read_bytes()).hexdigest() != digest):
            raise ValueError(f'{sku}: los bytes del maestro no coinciden con la aprobación.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--manifiesto', required=True)
    args = parser.parse_args()
    try:
        validate(args.root, json.loads(Path(args.manifiesto).read_text()))
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error))
