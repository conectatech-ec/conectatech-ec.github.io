#!/usr/bin/env python3
"""Preparación privada y selectiva de las altas136; simulación sin escrituras del repo.

Adaptado del helper general privado de altas133. Ejecutar desde la raíz de la rama
catalogo/altas-web-136-20261126, una vez que el flujo593 original haya validado y
publicado globalmente R7. El helper no descubre, recibe, valida globalmente ni
publica un corte593, no accede al receptor y no ejecuta Git push, commit o fetch.
Con R6, o con cualquier fuente distinta del XLSX exacto, termina antes de escribir.
Reutiliza original_validator() y checkout_evidence() del adaptador existente para
extender la misma atestación de checkout a la proyección +N. --validador acepta
normalizar_593.py original o su carpeta privada ya cacheada. Sin ese argumento,
original_validator() descarga sus4módulos desde el PIN original y verifica susSHA;
esa es la única lectura de red posible. Nunca se llama a prepare() ni normalize().
La evidencia anterior debe reproducirse íntegramente antes de ampliarla; todas
sus firmas previas y sus tiempos/secuencia/validador permanecen iguales. Los nuevos
hashes los produce exclusivamente checkout_evidence(), sin fórmulas paralelas.

INPUTS PRIVADOS (UTF-8 JSON; los campos no usados no se copian a informes):

facts.json: mapa cuyas claves pertenecen a PARL017, MOUS047, PET001, TECL034.
Cada SKU seleccionado requiere:
  title,sub,variant,slug,desc,unit,category,compatibility: texto no vacío.
  classification: texto, permite vacío cuando no hay clasificación declarada.
  brand,model: texto o null cuando no se declaran; no completar por semejanza.
  tipo: original|generico; specs: objeto nombre->texto con evidencia revisada.
  benefits: 1..4 listas [valor,titulo,descripcion,[nombres de specs]] u objetos
            {valor,titulo,descripcion,especificaciones:[nombres de specs]}.
  verified: {identity:true,specifications:true,sale_unit:true,visual:true}.
Opcionales: sku (igual a su clave), commercial_category (mapeo existente),
  seo_desc, unit_quantity (entero positivo), priority, role, search_extra,
  identity_note, technical_sources (sólo referencias públicas revisadas),
  edicion_asistida_ia (booleano), categoria593Original (J real o null).
La categoría web sale de category; las columnas593 J/K siempre salen del XLSX.
No se admiten contractExtra ni seoExtra que puedan sobrescribir controles.

recursos-locales.json: mapa por SKU con {regla,entrada,foto}, mismo formato del
procesador existente scripts/procesar-imagenes.py. regla exige autenticidad,
presentacion='sin caja',revision,evidencia_autenticidad. entrada exige archivo
importacion/lotes/continuacion-136/editorial-imagenes/SKU.png,sha256,posicion=1,
revision_publicacion=136,modelo_revisado/calidad_revisada/sin_datos_privados=true,
contiene_caja=false,fuente y nota_revision concreta. foto exige original,
sha256_original,resolucion_original,revision_publicacion=136,fuente y versiones
1200/600/300 con url,sha256,ancho,alto. Rutas: /imagenes/sku/SKU-r136-01.webp y
las dos variantes -600/-300. Los bytes deben existir y coincidir antes de activar.

referencias/SKU/refs.json: lista privada de {path,sha256,sku?}; path apunta a un
original descargado bajo esa carpeta exacta, nombre SKU.jpg o SKU_*. Los campos
Drive id/title permanecen privados; sólo SHA, dimensiones y referencias locales
sanitizadas pasan a reportes/continuacion-136/fuentes-verificadas.json.

reportes/continuacion-136/recursos-http.json: recibo previo del patrón existente,
{estado:'RECURSOS_HTTP_VERIFICADOS',fecha,cantidad,resultados:[{sku,url,http:200,
sha256,coincide:true}]}. Debe acreditar los 3 recursos exactos de cada seleccionado.
No es una aprobación visual ni una publicación de producto. No se hace red aquí.

--sku acepta un subconjunto exacto y sin duplicados; predeterminado:
PARL017 MOUS047 PET001. TECL034 queda fuera hasta disponer de maestro aprobado y
verified.visual=true. Se permite conservar datos de candidatos no seleccionados
en ambos inputs: jamás se transforman ni se activan. Incrementos de SKU/portadas
y conteos son +N desde la base fresca; 1212->1216 y1020->1024 sólo si se eligen4
y la base conserva aquellos conteos. PARL017 sustituye únicamente su fila CSV
preexistente, en la misma posición; los otros seleccionados se añaden al final.
Este helper prepara una sola activación136. Tras aplicar el subconjunto inicial,
los reportes/backup136 se conservan: no repetirlo para añadir TECL034 ni sobrescribir
evidencias. Una alta posterior requiere su lote independiente revisado.

--aplicar exige --base-head SHA de la base fresca revisada. Todos los gates y la
comparación de bytes se ejecutan antes del backup privado y de cualquier escritura.
El modo aplicar sólo prepara archivos locales, sin compilar, publicar o registrar
fechas de publicación. Reutiliza contratos, mapas, lote/QA y altas_validadas.
Preserva loteActual062 y todas las claves del estado salvo conteos existentes.

Continuación separada tras aplicar, bajo revisión del operador y CI vigente:
  python scripts/preparar-editorial-publicacion.py
  node scripts/generar-seo.cjs --sku <exactamente los SKU seleccionados>
  python scripts/validar-contrato.py --manifiesto
    importacion/lotes/continuacion-136/manifiesto-aprobados.json --fase prepublicacion
Completar QA móvil, HTTP/Chromium públicos y CI de cabeza final mediante los
mecanismos existentes antes de registrar fechas o prioridad. Este helper no los
da por cumplidos y deja publicacionVerificada=null.
"""
import argparse
from collections import Counter
from urllib.parse import urlparse
import os
import zipfile
import xml.etree.ElementTree as ET
import copy
import csv
import datetime
import hashlib
import importlib.util
import io
import json
import pathlib
import re
import subprocess
import sys
from decimal import Decimal

import openpyxl
from PIL import Image


PRIVATE = pathlib.Path('/tmp/conectatech-altas-136')
SOURCE_SHA = 'a6b1797b33e6c69ed9b261a5d7cd05948730599a4e29df06958fb4306a147711'
PREVIOUS_SHA = 'a2609eff408b43fbecaf75dc2b4e04624154a448f5c8cd30192cdf348d8875f4'
SOURCE_GENERATED = '2026-11-27T00:09:48Z'
SOURCE_DATE = '2026-11-26'
SELECTED = ('PARL017', 'MOUS047', 'PET001', 'TECL034')
BRANCH = 'catalogo/altas-web-136-20261126'
REPORT = 'reportes/continuacion-136/'
LOT = 'importacion/lotes/continuacion-136/'
RX = r'const products=(\[[\s\S]*?\]);\s*\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def money(value):
    if isinstance(value, bool) or value is None:
        raise ValueError('Importe público ausente')
    amount = Decimal(str(value))
    if not amount.is_finite() or amount < 0:
        raise ValueError('Importe público no válido')
    result = amount.quantize(Decimal('.01'))
    assert result == amount, 'No redondear importes593con más de2decimales'
    return result


def safe_repo(root, value):
    path = (root / value).resolve()
    assert path.is_relative_to(root), 'Ruta fuera del repositorio: ' + str(value)
    return path


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def utc(value):
    if isinstance(value, str):
        value = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert isinstance(value, datetime.datetime) and value.tzinfo is not None, 'Fecha sin zona horaria acreditada'
    return value.astimezone(datetime.timezone.utc)


def core_timestamps(data):
    # Read only the metadata of the exact hashed workbook. openpyxl discards its
    # explicit -05:00 offset, so properties.created cannot prove export time.
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        core = ET.fromstring(archive.read('docProps/core.xml'))
    ns = '{http://purl.org/dc/terms/}'
    values = [core.find(ns + key) for key in ('created', 'modified')]
    assert all(v is not None and v.text for v in values), 'Faltan timestamps originales XLSX'
    return [v.text for v in values]


def public_reference(value):
    if not isinstance(value, str):
        return False
    if re.fullmatch(r'(?:reportes|importacion|datos-593)/[A-Za-z0-9_./-]+(?:#[A-Za-z0-9_-]+)?', value):
        return '..' not in value
    parsed = urlparse(value)
    return (parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username
            and not parsed.password and not re.search(r'(?:drive|docs)\.google\.com|usercontent\.com', parsed.hostname))


def validate_facts(facts, sku):
    assert isinstance(facts, dict), 'facts porSKU debe ser objeto: ' + sku
    text_fields = ('title', 'sub', 'variant', 'slug', 'desc', 'unit', 'category', 'compatibility')
    assert all(isinstance(facts.get(k), str) and facts[k].strip() for k in text_fields), 'Texto revisado ausente o inválido: ' + sku
    assert isinstance(facts.get('classification'), str), 'classification debe ser texto; se conserva vacío si no está declarado'
    assert all(facts.get(k) is None or isinstance(facts[k], str) and facts[k].strip() for k in ('brand', 'model')), 'Marca/modelo no declarado debe ser null, nunca texto vacío: ' + sku
    assert all(k in facts for k in ('brand', 'model', 'tipo', 'specs', 'benefits', 'verified')), 'Faltan campos del esquema: ' + sku
    assert facts['tipo'] in ('original', 'generico'), 'Tipo comercial inválido: ' + sku
    specs = facts['specs']
    assert isinstance(specs, dict) and specs and all(isinstance(k, str) and k.strip() and isinstance(v, str) and v.strip() for k, v in specs.items()), 'Especificaciones vacías o con tipos inválidos: ' + sku
    verified = facts['verified']
    assert isinstance(verified, dict) and all(verified.get(k) is True for k in ('identity','specifications','sale_unit','visual')), 'Revisión humana pendiente para seleccionado: ' + sku
    assert type(facts.get('unit_quantity', 1)) is int and facts.get('unit_quantity', 1) > 0, 'Cantidad de unidad inválida: ' + sku
    assert type(facts.get('edicion_asistida_ia', True)) is bool, 'edicion_asistida_ia debe ser booleano'
    for key in ('priority', 'role', 'identity_note', 'seo_desc', 'commercial_category'):
        assert key not in facts or isinstance(facts[key], str) and facts[key].strip(), 'Campo de texto opcional inválido: ' + key
    extra = facts.get('search_extra', [])
    assert isinstance(extra, list) and all(isinstance(v, str) and v.strip() for v in extra), 'search_extra inválido'
    benefits = facts['benefits']
    assert isinstance(benefits, list) and 1 <= len(benefits) <= 4, 'Se requieren1a4beneficios revisados'
    for benefit in benefits:
        if isinstance(benefit, dict):
            assert all(k in benefit for k in ('valor','titulo','descripcion','especificaciones')), 'Beneficio incompleto'
            values = [benefit[k] for k in ('valor','titulo','descripcion','especificaciones')]
        else:
            assert isinstance(benefit, list) and len(benefit) == 4, 'Formato de beneficio inválido'
            values = benefit
        assert all(isinstance(v, str) and v.strip() for v in values[:3]), 'Beneficio con texto vacío'
        assert isinstance(values[3], list) and values[3] and all(isinstance(k, str) and k in specs for k in values[3]), 'Beneficio sin especificaciones verificadas'


def validate_http_receipt(receipt, resources):
    assert receipt.get('estado') == 'RECURSOS_HTTP_VERIFICADOS', 'Recursos HTTP pendientes'
    utc(receipt.get('fecha'))
    results = receipt.get('resultados')
    assert isinstance(results, list) and receipt.get('cantidad') == len(results), 'Recibo HTTP incompleto'
    expected = {(sku, 'https://conectatech-ec.github.io' + version['url']): version['sha256']
                for sku, resource in resources.items() for version in resource['foto']['versiones'].values()}
    assert len(expected) == 3 * len(resources), 'Se requieren3versiones por seleccionado'
    seen = set()
    for result in results:
        key = (result.get('sku'), result.get('url'))
        assert key not in seen and result.get('sku') in SELECTED, 'Recurso HTTP duplicado o de otroSKU'
        seen.add(key)
        if key in expected:
            assert result.get('http') == 200 and result.get('coincide') is True, 'HTTP sin bytes acreditados'
            assert result.get('sha256') == expected[key], 'SHA HTTP distinto de recurso revisado'
    assert set(expected).issubset(seen), 'Falta acreditar HTTP/SHA de un recurso seleccionado'


def rebuild_checkout_evidence(root, old_cut, cut, xlsx, validator_path, selected, read_repo, private_inputs):
    """Extend the existing attestation with the original adapter, never prepare().

    The global R7 receipt has already passed the caller's gates. read_xlsx() reads
    that same exact private XLSX once; checkout_evidence() checks every projected
    row's stock, explicit Q/X/Y amounts and original identity, including excluded
    web SKUs retained by the canonical inventory. No source or receipt is changed.
    """
    adapter_relative = 'scripts/preparar-revision-comercial-593.py'
    read_repo(adapter_relative)
    assert not git(root, 'diff', 'HEAD', '--name-only', '--', adapter_relative), 'El adaptador original debe coincidir con HEAD revisado'
    expected_before = old_cut.get('evidencia_checkout')
    assert isinstance(expected_before, dict), 'R7 carece de evidencia_checkout original; no fabricarla desde este helper'
    old_snapshot = copy.deepcopy(old_cut)
    new_snapshot = copy.deepcopy(cut)
    no_bytecode_before = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        # Import the repository's original adapter without executing its CLI.
        spec = importlib.util.spec_from_file_location('_alta136_original_revision', root / adapter_relative)
        assert spec is not None and spec.loader is not None, 'No se puede cargar el adaptador original'
        adapter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(adapter)
        assert adapter.PIN == expected_before.get('validator_commit'), 'PIN original distinto de evidencia_checkout vigente'
        assert adapter.MODULES == expected_before.get('validator_modules_sha256'), 'Módulos originales distintos de evidencia_checkout vigente'
        cached = validator_path.resolve() if validator_path is not None else None
        if cached is not None:
            if cached.is_dir():
                cached = cached / 'normalizar_593.py'
            assert cached.is_file(), '--validador debe identificar el paquete original ya disponible'
            for name in adapter.MODULES:
                file = cached.parent / name
                private_inputs[str(file)] = sha(file.read_bytes())
        # original_validator() enforces the original four SHA pins, including
        # the identity implementation used by checkout_evidence().
        with adapter.original_validator(cached) as normalizer:
            with adapter.original_name(xlsx, 'Reporte-Inventario.xlsx', normalizer) as named:
                source, rows = normalizer.read_xlsx(named, now=datetime.datetime.now(datetime.timezone.utc))
            assert source.get('sha256') == SOURCE_SHA, 'El lector original devolvió otra fuente'
            before = adapter.checkout_evidence(old_cut, source, rows, normalizer)
            assert before == expected_before, 'La evidencia_checkout anterior no se reproduce íntegra desde R7 original'
            after = adapter.checkout_evidence(cut, source, rows, normalizer)
        assert old_cut == old_snapshot and cut == new_snapshot, 'El adaptador original alteró el corte en memoria'
        mutable = {'identity_signatures', 'projection_sha256', 'attestation_sha256'}
        assert {k:v for k,v in after.items() if k not in mutable} == {k:v for k,v in before.items() if k not in mutable}, 'Checkout cambió tiempos, fuente, secuencia o validador'
        previous_proofs = before['identity_signatures']
        next_proofs = after['identity_signatures']
        assert set(previous_proofs) == set(old_cut['productos']), 'Cobertura de firmas anteriores incompleta'
        assert set(next_proofs) == set(previous_proofs) | set(selected) == set(cut['productos']), 'La nueva evidencia debe añadir sólo las firmas seleccionadas'
        assert all(next_proofs[sku] == proof for sku, proof in previous_proofs.items()), 'Firma original de SKU previo cambiada'
        assert after['projection_sha256'] != before['projection_sha256'], 'La proyección nueva conserva un hash anterior'
        assert after['attestation_sha256'] != before['attestation_sha256'], 'La atestación nueva conserva un hash anterior'
        return after
    finally:
        sys.dont_write_bytecode = no_bytecode_before


def selective_csv_bytes(original, headers, old_rows, new_rows, selected):
    """Keep every unrelated CSV record literally; replace PARL017 and append N."""
    text = original.decode('utf-8-sig')
    lines = text.splitlines(keepends=True)
    reader = csv.reader(io.StringIO(text, newline=''))
    assert next(reader) == headers, 'Cabecera CSV cambió'
    previous_line = reader.line_num
    chunks = [''.join(lines[:previous_line])]
    updated = {row['sku']: row for row in new_rows if row['sku'] in selected}
    old_index = 0
    newline = '\r\n' if '\r\n' in text else '\n'

    def encode_row(row):
        output = io.StringIO(newline='')
        csv.DictWriter(output, fieldnames=headers, lineterminator=newline).writerow(row)
        return output.getvalue()

    for values in reader:
        end_line = reader.line_num
        assert len(values) == len(headers), 'CSV con fila irregular'
        row = dict(zip(headers, values))
        assert row == old_rows[old_index], 'Lectores CSV discrepantes'
        old_index += 1
        literal = ''.join(lines[previous_line:end_line])
        chunks.append(encode_row(updated['PARL017']) if row['sku'] == 'PARL017' and 'PARL017' in selected else literal)
        previous_line = end_line
    assert old_index == len(old_rows), 'CSV incompleto'
    chunks.append(''.join(lines[previous_line:]))
    if selected and any(s != 'PARL017' for s in selected):
        if not ''.join(chunks).endswith(('\r', '\n')):
            chunks.append(newline)
        chunks.extend(encode_row(updated[sku]) for sku in selected if sku != 'PARL017')
    payload = ''.join(chunks).encode('utf-8')
    if original.startswith(b'\xef\xbb\xbf'):
        payload = b'\xef\xbb\xbf' + payload
    assert list(csv.DictReader(io.StringIO(payload.decode('utf-8-sig')))) == new_rows, 'Payload CSV distinto del plan'
    return payload


def apply_outputs(root, outputs, backup, snapshots, head, integrity, now):
    """Local reversible preparation, with no Git mutation or external call."""
    assert not backup.exists(), 'Existe backup previo; no repetir ni sobrescribir una preparación anterior'
    backup.mkdir(mode=0o700, parents=True)
    before = {path: safe_repo(root, path).read_bytes() if safe_repo(root, path).exists() else None for path in outputs}
    for path, data in before.items():
        if data is not None:
            destination = backup / 'archivos-anteriores' / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
    (backup / 'estado.json').write_bytes(json_bytes({'fecha': now, 'head': head,
        'archivos_antes': {p: sha(v) if v is not None else None for p, v in before.items()},
        'archivos_despues': {p: sha(v) for p, v in outputs.items()}, 'integridad': integrity}))
    assert git(root, 'rev-parse', 'HEAD') == head, 'HEAD avanzó durante backup; cero archivos del repositorio escritos'
    assert all(pathlib.Path(p).read_bytes() == data for p, data in snapshots.items()), 'La base avanzó durante backup'
    written = []
    temporary = None
    temporary_created = False
    try:
        for path, data in outputs.items():
            destination = safe_repo(root, path)
            current = destination.read_bytes() if destination.exists() else None
            assert current == before[path], 'Destino cambiado concurrentemente: ' + path
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name('.' + destination.name + '.alta136.tmp')
            assert not temporary.exists(), 'Temporal previo requiere revisión: ' + str(temporary)
            with temporary.open('xb') as handle:
                temporary_created = True
                handle.write(data)
            os.replace(temporary, destination)
            temporary_created = False
            written.append(path)
    except BaseException:
        # Restore only bytes written by this invocation; never overwrite a later
        # concurrent edit. The complete private backup remains available.
        for path in reversed(written):
            destination = safe_repo(root, path)
            if destination.read_bytes() != outputs[path]:
                raise RuntimeError('Conflicto durante rollback; preservar backup y revisar ' + path)
            if before[path] is None:
                destination.unlink()
            else:
                destination.write_bytes(before[path])
        raise
    finally:
        if temporary_created and temporary is not None and temporary.exists():
            temporary.unlink()


def main():
    if not __debug__:
        raise RuntimeError('No ejecutar con python -O: las guardas de preparación son obligatorias')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sku', nargs='+', default=['PARL017', 'MOUS047', 'PET001'], help='Subconjunto exacto de los4autorizados; TECL034 requiere revisión visual aprobada')
    parser.add_argument('--facts', type=pathlib.Path, default=PRIVATE / 'facts.json')
    parser.add_argument('--recursos', type=pathlib.Path, default=PRIVATE / 'recursos-locales.json')
    parser.add_argument('--referencias', type=pathlib.Path, default=PRIVATE / 'referencias')
    parser.add_argument('--base-head', help='HEAD fresco cotejado por el operador; obligatorio con --aplicar')
    parser.add_argument('--recursos-http', type=pathlib.Path, default=None, help='Recibo existente HTTP/SHA de3recursos por seleccionado; por defecto reportes/continuacion-136/recursos-http.json')
    parser.add_argument('--validador', type=pathlib.Path, help='normalizar_593.py original o carpeta cacheada; sin argumento original_validator descarga4módulos por susSHA originales')
    parser.add_argument('--xlsx', type=pathlib.Path, required=True)
    parser.add_argument('--fecha-fuente', default=SOURCE_DATE)
    parser.add_argument('--aplicar', action='store_true')
    args = parser.parse_args()
    root = pathlib.Path.cwd().resolve()
    assert (root / 'scripts/validar-contrato.py').is_file(), 'Ejecutar desde la raíz del repositorio'
    snapshots = {}
    private_inputs = {}
    def read_repo(path):
        file = safe_repo(root, path)
        data = file.read_bytes()
        snapshots[str(file)] = data
        return data
    def load(path):
        return json.loads(read_repo(path))
    head = git(root, 'rev-parse', 'HEAD')
    branch = git(root, 'branch', '--show-current')
    assert branch == BRANCH, 'Usar la rama independiente autorizada: ' + BRANCH
    assert not args.aplicar or args.base_head, '--aplicar exige --base-head cotejado contra main fresco'
    assert not args.base_head or re.fullmatch(r'[a-f0-9]{40}', args.base_head), '--base-head debe ser SHA completo'
    assert not args.base_head or args.base_head == head, 'HEAD cambió; releer la base, no reparar hashes a mano'
    def private_json(path):
        path = path.resolve()
        data = path.read_bytes()
        private_inputs[str(path)] = sha(data)
        return json.loads(data)
    facts = private_json(args.facts)
    resources = private_json(args.recursos)
    assert isinstance(facts, dict) and facts, 'facts debe contener un mapa no vacío por SKU'
    assert isinstance(resources, dict) and resources, 'recursos debe ser un mapa no vacío porSKU'
    assert set(facts).issubset(SELECTED) and set(resources).issubset(SELECTED), 'Sólo4candidatos autorizados; no normalizar MOUSE047'
    assert args.sku and len(set(args.sku)) == len(args.sku) and set(args.sku).issubset(SELECTED), '--sku contiene SKU desconocidos o duplicados'
    selected = [s for s in SELECTED if s in args.sku]
    assert set(selected).issubset(facts) and set(selected).issubset(resources), 'Faltan facts o recursos de unSKU seleccionado'
    assert len(selected) <= 30, 'Máximo editorial verificado: 30 por lote'
    assert all(re.fullmatch(r'[A-Z0-9_-]{1,40}', s) for s in selected), 'Código inválido'
    assert not any(s.startswith(('ESTU', 'FUND')) for s in selected), 'Estuches excluidos'
    assert args.fecha_fuente == SOURCE_DATE, 'La fecha local del reporte exacto es26nov2026; no usar la fecha UTC27nov'
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source_bytes = args.xlsx.read_bytes()
    source_hash = sha(source_bytes)
    private_inputs[str(args.xlsx.resolve())] = source_hash
    assert source_hash == SOURCE_SHA, 'XLSX distinto del reporte autorizado; no reprocesar R6 ni aceptar otra fuente'
    refs_by_sku = {sku: private_json(args.referencias / sku / 'refs.json') for sku in selected}
    assert all(isinstance(refs_by_sku[sku], list) and refs_by_sku[sku] for sku in selected), 'Cada SKU requiere refs.json no vacío'

    catalog = root / 'index.html'
    html = read_repo('index.html').decode('utf-8')
    match = re.search(RX, html)
    assert match, 'No se localizó const products'
    old_products = json.loads(match[1])
    products = copy.deepcopy(old_products)
    old_skus = {p['sku'] for p in old_products}
    assert len(old_skus) == len(old_products), 'Duplicados preexistentes: revisar antes de preparar'
    assert not old_skus.intersection(selected), 'Un SKU seleccionado ya existe en el catálogo'

    cut = load('datos-593/corte-comercial-publico-validado.json')
    state = load('datos-593/estado-ultimo-corte.json')
    old_cut, old_state = copy.deepcopy(cut), copy.deepcopy(state)
    assert cut.get('sha256_original') == state.get('origen_sha256') == SOURCE_SHA, 'R7_PENDIENTE: el corte y el estado globales aún no corresponden al XLSX exacto. Esperar al flujo593original; este helper no lo invoca'
    assert cut.get('fecha_corte') == state.get('fecha_corte') == SOURCE_DATE, 'Fecha global distinta del reporte R7'
    assert cut.get('cantidad_sku_original') == state.get('sku_fuente') == 1599, 'Cobertura global R7 no acreditada'
    revision = cut.get('revision_fuente')
    assert isinstance(revision, dict) and revision == state.get('revision_fuente'), 'Recibo global de revisión ausente o distinto'
    assert revision.get('secuencia') == 7 and revision.get('anterior_sha256') == PREVIOUS_SHA, 'Revisión R7 sin continuidad original R6'
    assert revision.get('evidencia') == 'XLSX_CORE_CREATED_EQUALS_MODIFIED', 'Falta identidad XLSX original validada'
    assert utc(revision.get('generado_en')) == utc(SOURCE_GENERATED), 'Hora global distinta del core XLSX'
    assert utc(revision.get('recibido_en')) > utc(SOURCE_GENERATED), 'Recibo R7 no posterior a su exportación'
    assert cut.get('cantidad_sku_web') == state.get('sku_web') == len(cut.get('productos', {})), 'Conteos globales inconsistentes'
    assert all(k in state for k in ('sku_web', 'con_stock', 'stock_cero', 'stock_negativo')), 'Estado global incompleto'
    assert all(type(state[k]) is int and state[k] >= 0 for k in ('sku_web', 'con_stock', 'stock_cero', 'stock_negativo')), 'Conteos globales inválidos'
    assert state['con_stock'] + state['stock_cero'] + state['stock_negativo'] == state['sku_web'], 'Conteos de disponibilidad inconsistentes'
    original_csv_bytes = read_repo('datos-593/inventario-publico.csv')
    csv_reader = csv.DictReader(io.StringIO(original_csv_bytes.decode('utf-8-sig')))
    headers = csv_reader.fieldnames
    csv_rows = list(csv_reader)
    old_csv_rows = copy.deepcopy(csv_rows)
    assert headers and 'promo_contado' in headers and 'pvp_final' in headers
    csv_counts = Counter(r.get('sku') for r in csv_rows)
    assert all(n == 1 for n in csv_counts.values()), 'CSV global con SKU duplicados'
    assert ('PARL017' not in selected or csv_counts['PARL017'] == 1) and all(csv_counts[s] == 0 for s in selected if s != 'PARL017'), 'CSV inesperado: PARL017 seleccionado debe existir exactamente una vez; otros seleccionados deben estar ausentes'
    assert csv_counts['MOUSE047'] == 0, 'Alias MOUSE047 hallado: resolver evidencia, nunca normalizar automáticamente'
    assert not set(cut['productos']).intersection(selected), 'Un alta seleccionada ya está en el corte; investigar antes'
    committed_baseline = ['index.html', 'datos-593/corte-comercial-publico-validado.json', 'datos-593/estado-ultimo-corte.json', 'datos-593/inventario-publico.csv']
    assert not git(root, 'diff', 'HEAD', '--name-only', '--', *committed_baseline), 'La base comercial debe coincidir con HEAD revisado; no acreditar R7 editando sus JSON a mano'
    # Validate the current baseline, including the five deliberately excluded SKUs.
    validator = str(root / 'scripts/validar-exportacion-593.cjs')
    read_repo('scripts/validar-exportacion-593.cjs')
    read_repo('scripts/politica-publicacion-web.cjs')
    validate_command = ['node', '-e', "const x=JSON.parse(require('fs').readFileSync(0,'utf8'));require(process.argv[1]).validar(x)", validator]
    subprocess.run(validate_command, input=json.dumps({'products': old_products, 'inventoryState': state, 'cut': cut}),
                   text=True, check=True, capture_output=True)

    workbook = openpyxl.load_workbook(io.BytesIO(source_bytes), data_only=True, read_only=True)
    assert all(utc(value) == utc(SOURCE_GENERATED) for value in core_timestamps(source_bytes)), 'Core XLSX created/modified no coincide con R7'
    source_skus = Counter()
    rows = {}
    checked_public_headers = False
    for row_number, row in enumerate(workbook.active.iter_rows(values_only=True), 1):
        if len(row) > 24 and row[3] == 'Cod. Principal':
            expected_headers = {1: 'Stock', 2: 'Producto', 3: 'Cod. Principal', 5: 'Tipo', 9: 'Categoría',
                                10: 'Clasificación', 13: 'Precio de venta', 14: '% IVA',
                                16: 'V. TOTAL', 23: 'PVP', 24: 'PVP % IVA'}
            assert row_number == 4 and len(row) == 28, 'Estructura física distinta: R7 tiene28columnas A:AB y cabecera4'
            assert all(row[column] == label for column, label in expected_headers.items()), \
                'Cambió el formato del reporte593; no aplicar columnas por aproximación'
            checked_public_headers = True
        if row_number > 4 and len(row) > 24 and row[3]:
            source_skus[row[3]] += 1
        if row_number > 4 and len(row) > 24 and row[3] in selected:
            sku = row[3]
            assert sku not in rows, 'SKU repetido en fuente593: ' + sku
            rows[sku] = (row_number, row)
    workbook.close()
    assert checked_public_headers, 'No se verificaron las cabeceras públicas del reporte593'
    assert set(rows) == set(selected), 'Hay SKU seleccionados sin fila exacta en593'
    assert len(source_skus) == sum(source_skus.values()) == 1599, 'Cantidad deSKU o duplicados inesperados en XLSX'
    assert source_skus['MOUSE047'] == 0, 'Alias MOUSE047 hallado; no normalizar'
    expected_rows = {'MOUS047':1117, 'PARL017':1169, 'PET001':1208, 'TECL034':1496}
    assert all(rows[s][0] == expected_rows[s] for s in selected), 'Filas del XLSX exacto distintas de la revisión privada'

    existing_maps = {path: load(path) for path in [
        'seo-contenido.json', 'seo-pages.json', 'importacion/reglas-sku.json',
        'importacion/medios.json', 'importacion/editorial/publicados.json',
        'reportes/editorial-selectivo/clasificacion-1170.json']}
    old_maps = copy.deepcopy(existing_maps)
    seo = existing_maps['seo-contenido.json']
    slugs = existing_maps['seo-pages.json']
    rules = existing_maps['importacion/reglas-sku.json']
    media = existing_maps['importacion/medios.json']
    cfg = existing_maps['importacion/editorial/publicados.json']
    queue = existing_maps['reportes/editorial-selectivo/clasificacion-1170.json']
    assert not any(s in seo or s in slugs or s in media or s in rules['productos'] or s in cfg['productos'] for s in selected), \
        'Alta con rastro previo en registros: cotejar identidad, no sobrescribir'
    assert cfg.get('loteActual') == '062', 'Conservar loteActual062; no cambiar editorial vigente'
    assert not any(x.get('sku') in selected for x in queue['cola']), 'SKU con rastro previo en cola editorial'
    for sku in selected:
        assert not (root / ('importacion/contratos/' + sku + '.json')).exists(), 'Contrato previo: no sobrescribir ' + sku
    category_mapping = load('importacion/categorias-comerciales.json')['mapa']
    http_receipt_path = args.recursos_http or root / (REPORT + 'recursos-http.json')
    http_receipt_path = http_receipt_path.resolve()
    assert http_receipt_path.is_relative_to(root), 'El recibo HTTP debe estar en el repositorio, sin rutas privadas públicas'
    http_receipt = load(str(http_receipt_path.relative_to(root)))
    validate_http_receipt(http_receipt, {s:resources[s] for s in selected})
    read_repo('importacion/lote-activo.json')
    known_categories = {p['category'] for p in products}
    all_slugs = set(slugs.values())
    outputs, contracts, entries, source_map, source_proof, visual_report = {}, {}, {}, {}, {}, {}
    manifest = {'version': 3, 'lote': 'continuacion-136', 'cantidad_seleccionada': len(selected),
                'skus': selected, 'imagenes': {}, 'aprobaciones': {}, 'contratos': {}, 'categorias_comerciales': {}}

    for sku in selected:
        f, resource = facts[sku], resources[sku]
        validate_facts(f, sku)
        required = ['title', 'sub', 'brand', 'model', 'variant', 'slug', 'desc', 'unit', 'specs',
                    'benefits', 'category', 'compatibility', 'tipo', 'classification', 'verified']
        assert all(k in f for k in required), 'Faltan datos revisados en facts: ' + sku
        assert all(f['verified'].get(k) is True for k in ['identity', 'specifications', 'sale_unit', 'visual']), \
            'El operador debe confirmar las cuatro revisiones en facts.verified: ' + sku
        assert f.get('sku', sku) == sku, 'facts.sku distinto de su clave exacta'
        assert not any(k in f for k in ('contractExtra', 'seoExtra')), 'Extensiones libres no admitidas; revisar cualquier campo adicional explícitamente'
        assert isinstance(f['brand'], (str, type(None))) and isinstance(f['model'], (str, type(None)))
        assert f['tipo'] in ('original', 'generico')
        expected_auth = {'original': 'original verificado', 'generico': 'genérico/compatible'}[f['tipo']]
        rule, entry, photo = resource['regla'], resource['entrada'], resource['foto']
        assert rule['autenticidad'] == expected_auth and rule.get('evidencia_autenticidad'), 'Condición sin evidencia: ' + sku
        assert rule['presentacion'] == 'sin caja' and entry.get('contiene_caja') is False
        assert entry.get('posicion') == photo.get('posicion') == 1 and photo.get('contiene_caja') is False, 'La portada debe ser posición1 sin caja'
        assert entry.get('revision_regla') == photo.get('revision_regla') == rule.get('revision'), 'Revisiones de regla distintas'
        assert entry.get('modelo_revisado') is True and entry.get('calidad_revisada') is True and entry.get('sin_datos_privados') is True
        assert entry.get('nota_revision'), 'Falta observación visual concreta: ' + sku
        master = (root / entry['archivo']).resolve()
        assert master.is_relative_to(root) and master.is_file() and sha(master.read_bytes()) == entry['sha256']
        assert entry['archivo'] == LOT + 'editorial-imagenes/' + sku + '.png', 'Maestro fuera del lote136'
        assert entry.get('revision_publicacion') == photo.get('revision_publicacion') == 136
        assert entry.get('fuente') == photo.get('fuente') == REPORT + 'fuentes-verificadas.json#' + sku
        assert set(photo['versiones']) == {'1200', '600', '300'}, 'Se requieren las tres versiones existentes'
        assert photo['versiones']['1200']['url'] == '/imagenes/' + sku.lower() + '/' + sku + '-r136-01.webp'
        assert photo['sha256_original'] == entry['sha256'], 'Foto y maestro deben compartir SHA original'
        original_path = safe_repo(root, photo['original'].lstrip('/'))
        assert original_path.is_file() and sha(read_repo(str(original_path.relative_to(root)))) == entry['sha256'], 'Original procesado distinto del maestro'
        snapshots[str(master)] = master.read_bytes()
        with Image.open(master) as master_image:
            assert list(master_image.size) == photo['resolucion_original'], 'Metadatos de dimensiones distintos del maestro'
        for size, version in photo['versiones'].items():
            expected_url = '/imagenes/' + sku.lower() + '/' + sku + '-r136-01' + ('' if size == '1200' else '-' + size) + '.webp'
            assert version['url'] == expected_url, 'Ruta versionada incorrecta: ' + sku
            path = (root / version['url'].lstrip('/')).resolve()
            assert path.is_relative_to(root) and path.is_file() and sha(read_repo(str(path.relative_to(root)))) == version['sha256'], 'Recurso inválido: ' + sku
            with Image.open(path) as image:
                assert list(image.size) == [int(size), int(size)] == [version['ancho'], version['alto']], 'Dimensiones de recurso distintas: ' + sku
        category = f['category']
        assert category in known_categories, 'Categoría original no existente: ' + category
        commercial_category = f.get('commercial_category', category)
        if commercial_category != category:
            assert category_mapping.get(category, {}).get('nombre') == commercial_category, 'Mapeo comercial no verificado: ' + sku
            manifest['categorias_comerciales'][category] = category_mapping[category]
        assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', f['slug']) and f['slug'] not in all_slugs
        assert f['slug'].startswith(sku.lower() + '-'), 'Slug debe identificar SKU exacto'
        all_slugs.add(f['slug'])
        assert isinstance(f['specs'], dict) and f['specs'] and 1 <= len(f['benefits']) <= 4
        assert f['variant'] and f['desc'] and f['unit'] and f['title']
        matching_refs = refs_by_sku[sku]
        public_refs = []
        for i, ref in enumerate(matching_refs, 1):
            assert ref.get('sku') in (None, sku), 'Referencia conSKU diferente; no normalizar alias'
            reference_file = pathlib.Path(ref.get('path', ref.get('workspace_path', ''))).resolve()
            assert reference_file.is_relative_to((args.referencias / sku).resolve()), 'Referencia fuera de su carpeta privadaSKU'
            assert reference_file.name == sku + '.jpg' or reference_file.name.startswith(sku + '_'), 'Referencia con prefijoSKU distinto'
            assert reference_file.is_file(), 'Referencia no descargada: ' + sku
            digest = sha(reference_file.read_bytes())
            assert digest == ref.get('sha256'), 'Referencia cambió o carece de SHA tras la revisión: ' + sku
            private_inputs[str(reference_file)] = digest
            with Image.open(reference_file) as image:
                dimensions = list(image.size)
            public_refs.append({'url': REPORT + 'fuentes-verificadas.json#' + sku + '-' + str(i).zfill(2),
                                'sha256': digest, 'resolucion': dimensions,
                                'tipo': 'Fotografía propia de producto o empaque revisada; original de identificación conservado privadamente'})
        reviewed_sources = f.get('technical_sources', [])
        assert isinstance(reviewed_sources, list) and all(public_reference(x) for x in reviewed_sources), 'Fuente técnica privada o inválida'
        technical = list(dict.fromkeys([x['url'] for x in public_refs] + [REPORT + 'base-593.json', REPORT + 'revision-visual.json'] + reviewed_sources))
        row_number, row = rows[sku]
        name = str(row[2]).strip()
        assert name and row[1] is not None and Decimal(str(row[1])) == int(row[1]) and int(row[1]) >= 0
        stock = int(row[1])
        promo = money(row[16])
        pvp_net = money(row[23])
        pvp_tax = money(row[24])
        # PVP is the explicit sum of the two public source columns, never a markup from contado.
        pvp = money(Decimal(str(row[23])) + Decimal(str(row[24])))
        csv_row = {h: '' for h in headers}
        csv_row.update({'sku': sku, 'nombre': name, 'stock': str(stock), 'precio_general': f'{money(row[13]):.2f}',
                        'iva': str(row[14]), 'tipo': str(row[5]), 'categoria': str(row[9] or ''),
                        'clasificacion': str(row[10] or ''), 'promo_contado': f'{promo:.2f}', 'pvp_final': f'{pvp:.2f}'})
        assert f.get('categoria593Original', row[9] or None) == (row[9] or None), 'No inventar categoría593 desde categoríaweb'
        if sku == 'PARL017':
            csv_position = next(i for i, r in enumerate(csv_rows) if r['sku'] == sku)
            csv_rows[csv_position] = csv_row
        else:
            csv_rows.append(csv_row)
        cut['productos'][sku] = {'stock': stock, 'promo_centavos': int(promo * 100), 'pvp_centavos': int(pvp * 100)}
        source_map[sku] = {'fila': row_number, 'nombre': name, 'stock': stock, 'promo_contado': float(promo),
                           'pvp_final': float(pvp), 'pvp_neto': float(pvp_net), 'iva_pvp_importe': float(pvp_tax),
                           'precio_general_publico': float(money(row[13])), 'iva_porcentaje': float(row[14]),
                           'categoria593Original': row[9] or None, 'clasificacion593Original': row[10] or None}
        url = 'https://conectatech-ec.github.io/productos/' + f['slug'] + '/'
        search_parts = [sku, name, f['title'], f['brand'], f['model']] + f.get('search_extra', [])
        products.append({'sku': sku, 'name': name, 'category': category, 'stock': stock,
                         'promo': float(promo), 'pvp': float(pvp), 'priority': f.get('priority', 'MEDIA'),
                         'role': f.get('role', 'CAPTADOR'), 'imageUrl': photo['versiones']['1200']['url'],
                         'specs': f['specs'], 'searchTerms': ' '.join(str(x) for x in search_parts if x)})
        specs = [{'nombre': key, 'valor': value, 'fuentes': technical, 'estado': 'VERIFICADO', 'publicar': True}
                 for key, value in f['specs'].items()]
        benefits = []
        for benefit in f['benefits']:
            if isinstance(benefit, dict):
                benefit = [benefit[k] for k in ['valor', 'titulo', 'descripcion', 'especificaciones']]
            value, title, description, names = benefit
            assert names and all(n in f['specs'] for n in names), 'Beneficio sin respaldo técnico: ' + sku
            benefits.append({'valor': value, 'titulo': title, 'descripcion': description, 'especificaciones': names,
                             'fuentes': technical, 'estado': 'VERIFICADO'})
        identity = {'sku_verificado': True, 'marca_verificado': True, 'modelo_verificado': True,
                    'variante_verificado': True, 'fuentes': [x['url'] for x in public_refs], 'discrepancias_pendientes': []}
        for field, english in [('marca', 'brand'), ('modelo', 'model')]:
            if f[english] is None:
                identity[field + '_no_declarad' + ('a' if field == 'marca' else 'o')] = True
        contract = {
            'sku': sku, 'nombre_original': name, 'titulo_comercial': name,
            'presentacion_editorial_verificada': {'titulo': f['title'], 'subtitulo': f['sub'],
                'fuente': 'importacion/editorial/publicados.json#' + sku, 'conservarTituloOriginalEn593YDatosBase': True},
            'tipo': f['tipo'], 'marca': f['brand'], 'modelo': f['model'], 'variante': f['variant'],
            'categoria_original': category, 'categoria_comercial': commercial_category,
            'categoria593Original': row[9] or None, 'clasificacionWebDesdeFuncionVerificada': REPORT + 'orden-y-fuentes.json',
            'precio_contado': float(promo), 'pvp': float(pvp), 'stock': stock,
            'unidad_venta': {'descripcion': f['unit'], 'cantidad': f.get('unit_quantity', 1), 'verificada': True, 'fuente': REPORT + 'revision-visual.json'},
            'fotografias_fuente': public_refs, 'fuentes_tecnicas': technical,
            'imagen_principal': photo['versiones']['1200']['url'], 'imagenes_secundarias': [],
            'derechos_imagen': {'estado': 'AUTORIZADO', 'tipo': 'propia', 'fuente': entry['fuente'],
                'evidencia': 'Referencias propias del propietario en Drive CONECTATECH y autorización vigente de representación comercial asistida. ' + REPORT + 'orden-y-fuentes.json',
                'fecha_verificacion': now, 'edicion_asistida_ia': f.get('edicion_asistida_ia', True),
                'archivos': [{'sha256': entry['sha256'], 'fuente': entry['fuente']}]},
            'especificaciones': specs, 'estado_calidad': 'APROBADO', 'estado_publicacion': 'APROBADO_LOCAL',
            'url_publica': url, 'fecha_verificacion': now, 'descripcion': f['desc'],
            'descripcion_seo': f.get('seo_desc', f['desc'][:155]), 'contenido_venta': f['unit'],
            'compatibilidad': f['compatibility'], 'presentacion': 'sin caja', 'revision_regla': rule['revision'],
            'evidencia_clasificacion': rule['evidencia_autenticidad'], 'stock_fecha_corte': args.fecha_fuente,
            'stock_tiempo_real': False, 'beneficios': benefits,
            'validaciones': {'identidad': identity,
                'ficha': {'verificada': True, 'fuente': REPORT + 'revision-visual.json',
                          'evidencia': f.get('identity_note', 'Identidad y afirmaciones contrastadas por el operador con referencias propias y fila exacta593; sin atributos inferidos de un modelo parecido.')},
                'revision_visual': {'estado': 'VERIFICADO', 'fecha': now,
                    'sha256_maestro': entry['sha256'], 'evidencia': entry['nota_revision']}}}
        contracts[sku] = contract
        entries[sku] = {'titulo': f['title'], 'subtitulo': f['sub'], 'tituloAnterior': name, 'nombre593': name,
            'marca': f['brand'], 'modelo': f['model'], 'modelosBusquedaVerificados': [f['model']] if f['model'] else [],
            'condicionTarjeta': 'De terceros' if f['tipo'] == 'generico' else '', 'fuentes': technical + ['importacion/contratos/' + sku + '.json'],
            'evidenciaAtributos': f['specs'], 'clasificacionReal': expected_auth, 'url': url,
            'foto': photo['versiones']['1200']['url'], 'sha256Foto': photo['versiones']['1200']['sha256'],
            'causa': 'Alta nueva con referencias propias y datos593 verificados, según orden vigente del propietario.',
            'lote': 'editorial-136', 'estado': 'PREPARADO_PENDIENTE_HTTP_CHROMIUM',
            'publicacionVerificada': None, 'mostrarTituloEnFicha': True}
        rules['productos'][sku] = rule
        media[sku] = {'revision_regla': rule['revision'], 'regla': rule, 'imagenes': [photo]}
        slugs[sku] = f['slug']
        seo[sku] = {'nombre': name, 'tituloSeo': f['title'] + ' en Quito | ConectaTech',
            'descripcionSeo': contract['descripcion_seo'], 'descripcion': f['desc'], 'caracteristicas': f['specs'],
            'comercialVerificado': True, 'fuenteVerificacion': 'importacion/contratos/' + sku + '.json',
            'tipo': f['tipo'], 'marca': f['brand'], 'modelo': f['model'], 'variante': f['variant'],
            'contenidoVenta': f['unit'], 'compatibilidad': f['compatibility'], 'unidadVenta': f['unit'],
            'beneficios': [{k: b[k] for k in ['valor', 'titulo', 'descripcion']} for b in benefits],
            'imagenOriginal': {'sha256': entry['sha256'], 'ancho': photo['resolucion_original'][0], 'alto': photo['resolucion_original'][1]},
            'imagen': contract['imagen_principal'], 'imagenPendiente': False, 'imagenProfesional': photo, 'galeria': [photo],
            'clasificacionComercial': f['classification'], 'categoriaOriginal': category, 'categoriaComercial': commercial_category,
            'fechaInventario': '/'.join(args.fecha_fuente.split('-')[::-1]), 'stockTiempoReal': False,
            'presentacion': 'sin caja', 'reglaSKU': rule}
        cfg['productos'][sku] = entries[sku]
        queue['cola'].append({'sku': sku, 'estado': 'MEJORAR TÍTULO', 'tituloActual': name,
            'propuesta': f['title'], 'causa': entries[sku]['causa'], 'prioridad': 0,
            'evidencia': entries[sku]['fuentes'], 'aplicar': False, 'altaCatalogo136': True})
        manifest['imagenes'][sku] = [entry]
        manifest['aprobaciones'][sku] = {'estado': 'APROBADO', 'identidad_verificada': True, 'ficha_verificada': True, 'uso_comercial_permitido': True}
        manifest['contratos'][sku] = 'importacion/contratos/' + sku + '.json'
        source_proof[sku] = {'referencias': public_refs, 'cantidadReferencias': len(public_refs),
            'observaciones': f.get('identity_note', entry['nota_revision']), 'maestroGenerado': entry['sha256']}
        visual_report[sku] = {'identidadVerificada': True, 'referenciasPropiasRevisadas': len(public_refs),
            'marca': f['brand'], 'modelo': f['model'], 'fuentesTecnicas': technical,
            'maestro_sha256': entry['sha256'], 'productoCompleto': True, 'sinCaja': True,
            'sinDatosPrivados': True, 'unidadVenta': f['unit'], 'observaciones': entry['nota_revision']}

    # Preserve main's commercial source date and hash; this is a narrow addition from a newer source.
    count = len(selected)
    cut['cantidad_sku_web'] = old_cut['cantidad_sku_web'] + count
    cut.setdefault('altas_validadas', []).append({'fecha': args.fecha_fuente, 'skus': selected,
        'fuente': 'Reporte-Inventario.xlsx', 'sha256_original': source_hash, 'evidencia': REPORT + 'base-593.json',
        'alcance': 'Sólo altas nuevas. Todos los registros anteriores y exclusiones vigentes se conservan; no es una sincronización global.'})
    state['sku_web'] = old_state['sku_web'] + count
    state['con_stock'] = old_state['con_stock'] + sum(source_map[s]['stock'] > 0 for s in selected)
    state['stock_cero'] = old_state['stock_cero'] + sum(source_map[s]['stock'] == 0 for s in selected)
    cut['evidencia_checkout'] = rebuild_checkout_evidence(root, old_cut, cut, args.xlsx,
        args.validador, selected, read_repo, private_inputs)
    csv_payload = selective_csv_bytes(original_csv_bytes, headers, old_csv_rows, csv_rows, selected)
    cut_payload = json_bytes(cut)
    for sku, contract in contracts.items():
        contract['validaciones']['base_593'] = {'archivo': 'datos-593/inventario-publico.csv', 'sha256': sha(csv_payload),
                                                'fila': next(r for r in csv_rows if r['sku'] == sku)}
        contract['validaciones']['corte_comercial'] = {'archivo': 'datos-593/corte-comercial-publico-validado.json',
            'sha256': sha(cut_payload), 'fecha': cut['fecha_corte'], 'fila': cut['productos'][sku]}
        outputs['importacion/contratos/' + sku + '.json'] = json_bytes(contract)
    outputs['datos-593/inventario-publico.csv'] = csv_payload
    outputs['datos-593/corte-comercial-publico-validado.json'] = cut_payload
    outputs['datos-593/estado-ultimo-corte.json'] = json_bytes(state)
    new_html = re.sub(RX, lambda m: 'const products=' + json.dumps(products, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + ';\n', html, count=1)
    outputs['index.html'] = new_html.encode()
    for path, value in existing_maps.items():
        outputs[path] = json_bytes(value)
    outputs['importacion/editorial/lotes/lote-136.json'] = json_bytes({'version': 1, 'lote': 'editorial-136', 'maximo': 30,
        'estado': 'PREPARADO_PENDIENTE_PUBLICACION', 'skus': selected, 'productos': entries})
    outputs[LOT + 'manifiesto-aprobados.json'] = json_bytes(manifest)
    outputs[LOT + 'manifiesto-qa.json'] = json_bytes({'version': 1, 'skus': selected})
    outputs['importacion/lote-activo.json'] = json_bytes({'version': 1, 'lote': 'continuacion-136',
        'rama': BRANCH, 'estado': 'PREPARADO_PENDIENTE_PUBLICACION',
        'manifiesto': LOT + 'manifiesto-aprobados.json', 'skus': selected,
        'qa_manifiesto': LOT + 'manifiesto-qa.json', 'qa_base_publica': None})
    outputs[REPORT + 'fuentes-verificadas.json'] = json_bytes({'fecha': now, 'productos': source_proof,
        'originalesDeIdentificacionPrivados': True, 'sinPublicarIDsNiEnlacesInternosDeDrive': True})
    outputs[REPORT + 'base-593.json'] = json_bytes({'fecha_corte': args.fecha_fuente, 'archivo': 'Reporte-Inventario.xlsx',
        'sha256_original': source_hash, 'productos': source_map,
        'regla_precios': 'Promo=columnaQ V.TOTAL. PVP=columnaX PVP+importeIVA columnaY. No se recalcula desde contado ni se publican costos.',
        'alcance': 'Únicamente altas nuevas; se preserva el corte comercial anterior para todos los SKU existentes.'})
    outputs[REPORT + 'orden-y-fuentes.json'] = json_bytes({'fecha': now,
        'instruccionActual': 'Crear exclusivamente PARL017,MOUS047,PET001,TECL034 con sus fuentes propias y el reporte R7 ya validado globalmente; conservar MOUSE047 sin normalización. No competir con el observador593.',
        'reglasVigentes': ['Sólo Drive empresarial CONECTATECH', 'Conservar fotografías aprobadas y maestros originales',
            'Producto completo premium sin caja; identidad y conexiones reales', 'Descripciones comerciales con beneficios verificados',
            'Condición real visible antes de comprar; no repetirla en beneficios', 'Estuches excluidos; no retirar otros SKU',
            'Preservar precios, existencias, nombres593, URLs y datos de todos los registros existentes',
            'Recursos HTTP antes de activar; fechas sólo tras HTTP/Chromium públicos',
            'Nuevos y actualizados primero tras verificación; mantener Recomendados comercial',
            'No interferir con automatización comercial24/7'],
        'skusConReferenciasNuevas': selected, 'costoAdicional': 0})
    outputs[REPORT + 'revision-visual.json'] = json_bytes({'fecha': now, 'productos': visual_report, 'costoAdicional': 0})

    # Fail before writing any production file if an old object or lineage was changed.
    assert products[:len(old_products)] == old_products and len(products) == len(old_products) + count
    assert all(cut['productos'][s] == value for s, value in old_cut['productos'].items())
    assert len(csv_rows) == len(old_csv_rows) + sum(s != 'PARL017' for s in selected)
    assert [r for r in csv_rows if r['sku'] not in selected] == [r for r in old_csv_rows if r['sku'] not in selected], 'Valores CSV ajenos cambiados'
    assert 'PARL017' not in selected or next(i for i,r in enumerate(csv_rows) if r['sku']=='PARL017') == next(i for i,r in enumerate(old_csv_rows) if r['sku']=='PARL017'), 'Se movió la filaCSV dePARL017'
    assert set(state) == set(old_state), 'No añadir campos ad hoc al estado593'
    assert {k:v for k,v in state.items() if k not in ('sku_web','con_stock','stock_cero')} == {k:v for k,v in old_state.items() if k not in ('sku_web','con_stock','stock_cero')}, 'Estado global ajeno cambiado'
    assert {k:v for k,v in cut.items() if k not in ('productos','cantidad_sku_web','altas_validadas','evidencia_checkout')} == {k:v for k,v in old_cut.items() if k not in ('productos','cantidad_sku_web','altas_validadas','evidencia_checkout')}, 'Recibo/corte global cambiado'
    assert cut['altas_validadas'][:-1] == old_cut.get('altas_validadas', []), 'Recibos históricos dealtas cambiados'
    assert {k:v for k,v in cfg.items() if k != 'productos'} == {k:v for k,v in old_maps['importacion/editorial/publicados.json'].items() if k != 'productos'}, 'Metadatos editoriales anteriores cambiados'
    assert queue['cola'][:-count] == old_maps['reportes/editorial-selectivo/clasificacion-1170.json']['cola']
    assert {k:v for k,v in queue.items() if k!='cola'} == {k:v for k,v in old_maps['reportes/editorial-selectivo/clasificacion-1170.json'].items() if k!='cola'}
    assert {k:v for k,v in rules.items() if k!='productos'} == {k:v for k,v in old_maps['importacion/reglas-sku.json'].items() if k!='productos'}
    assert cfg['loteActual'] == old_maps['importacion/editorial/publicados.json']['loteActual']
    for path in ['seo-contenido.json', 'seo-pages.json', 'importacion/medios.json']:
        assert all(existing_maps[path][s] == value for s, value in old_maps[path].items()), 'Registro previo cambiado: ' + path
    assert all(rules['productos'][s] == value for s, value in old_maps['importacion/reglas-sku.json']['productos'].items())
    assert all(cfg['productos'][s] == value for s, value in old_maps['importacion/editorial/publicados.json']['productos'].items())
    subprocess.run(validate_command, input=json.dumps({'products': products, 'inventoryState': state, 'cut': cut}),
                   text=True, check=True, capture_output=True)
    # Old public files contain historical source URLs. Never rewrite them merely
    # to sanitize this batch; check only data newly introduced by this script.
    new_records = {'contracts': contracts, 'editorial': entries, 'manifest': manifest,
                   'products': products[len(old_products):], 'sources': source_proof,
                   'seo': {s: seo[s] for s in selected}, 'media': {s: media[s] for s in selected},
                   'rules': {s: rules['productos'][s] for s in selected},
                   'reports': {p: json.loads(data) for p, data in outputs.items() if p.startswith(REPORT)}}
    serialized = json.dumps(new_records, ensure_ascii=False)
    assert not re.search(r'drive\.google\.com|docs\.google\.com|usercontent\.com|sediment://|/workspace/(?:attachments|work/)|/tmp/conectatech-altas-136', serialized), \
        'No publicar referencias privadas'
    old_cover_count = sum(bool(p.get('imageUrl')) for p in old_products)
    new_cover_count = sum(bool(p.get('imageUrl')) for p in products)
    assert new_cover_count == old_cover_count + count, 'El incremento de portadas debe coincidir con el subconjunto seleccionado'
    integrity = {'estado': 'PREPARADO_LOCAL_NO_PUBLICADO', 'fecha': now, 'skus': selected, 'cantidadAltas': count,
        'objetosWebPrevios': len(old_products), 'objetosWebDespues': len(products),
        'portadasPrevias': old_cover_count, 'portadasDespues': new_cover_count,
        'coberturaCortePrevia': old_state['sku_web'], 'coberturaCorteDespues': state['sku_web'],
        'exclusionesPreviasConservadas': old_state['sku_web'] - len(old_products),
        'objetosAnterioresIntactos': True, 'finanzasPreviasIntactas': True,
        'fuenteGlobalAnteriorConservada': {'fecha': old_state['fecha_corte'], 'sha256': old_state['origen_sha256']},
        'fuenteAltas': {'fecha': args.fecha_fuente, 'sha256': source_hash},
        'checkoutMismaInfraestructuraOriginal': {'firmasPrevias':len(old_cut['evidencia_checkout']['identity_signatures']),
            'firmasDespues':len(cut['evidencia_checkout']['identity_signatures']), 'firmasPreviasIntactas':True,
            'tiemposSecuenciaValidadorIntactos':True, 'evidenciaGeneradaPor':'scripts/preparar-revision-comercial-593.py#checkout_evidence'},
        'loteEditorialAnteriorConservado': cfg['loteActual'], 'sinFechasPublicacionAnticipadas': True,
        'sinEdicionCloud': True, 'costoAdicional': 0}
    outputs[REPORT + 'integridad-local.json'] = json_bytes(integrity)

    # All gates run before even a backup is created. A changed baseline requires rereading.
    new_paths = [p for p in outputs if str(safe_repo(root,p)) not in snapshots]
    assert all(not safe_repo(root,p).exists() for p in new_paths), 'Un destino nuevo ya existe: no sobrescribir evidencia'
    for path, data in snapshots.items():
        assert pathlib.Path(path).read_bytes() == data, 'La base avanzó durante la preparación: ' + path
    for path, digest in private_inputs.items():
        assert sha(pathlib.Path(path).read_bytes()) == digest, 'Un input privado cambió durante la preparación'
    assert git(root, 'rev-parse', 'HEAD') == head, 'HEAD avanzó durante la preparación'
    if args.aplicar:
        apply_outputs(root, outputs, PRIVATE / 'base-activacion', snapshots, head, integrity, now)
    print(json.dumps({'modo': 'APLICADO_LOCAL' if args.aplicar else 'SIMULACION_SIN_ESCRITURAS',
                      'altas': count, 'skus': selected, 'objetosWebPrevios': len(old_products),
                      'objetosWebDespues': len(products), 'coberturaCorteDespues': state['sku_web'], 'portadasPrevias':old_cover_count, 'portadasDespues':new_cover_count,
                      'archivos': len(outputs), 'siguiente': 'Compilar editorial, generar sólo PDPs seleccionados y ejecutar QA/CI; todavía no publicado.'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
