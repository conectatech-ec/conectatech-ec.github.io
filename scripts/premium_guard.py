"""Approval gate for the owner's premium visual review; never grants approval."""
import argparse
import hashlib
import json
from pathlib import Path


def validate(root, manifest):
    root = Path(root).resolve()
    path = root / 'importacion/premium-activo.json'
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
