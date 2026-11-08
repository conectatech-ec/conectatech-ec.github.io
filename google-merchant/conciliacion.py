"""Adaptador de lectura: reconoce evidencias existentes, nunca escribe aprobaciones."""
import copy
import hashlib
import json
import re
import subprocess
from pathlib import Path

from generar import local_url, product_schema


class Reconciler:
    def __init__(self, root):
        self.root = root.resolve()
        self.proofs = {}
        self.cache = {}
        reader = Path(__file__).with_name('leer-aprobaciones.cjs')
        self.snapshot = json.loads(subprocess.check_output(
            ['node', str(reader), str(self.root)], text=True))
        self.commit = subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD'], text=True).strip()
        if self.snapshot['source_commit'] != self.commit:
            raise ValueError('La fuente cambió durante la lectura de aprobaciones')

    def read(self, relative, expected=None):
        path = (self.root / relative).resolve()
        if not path.is_relative_to(self.root) or not path.is_file():
            raise ValueError('evidencia_fuera_de_fuente_o_ausente')
        if relative not in self.cache:
            raw = path.read_bytes()
            self.cache[relative] = (hashlib.sha256(raw).hexdigest(), json.loads(raw))
        digest, value = self.cache[relative]
        if expected is not None and digest != expected:
            raise ValueError('hash_evidencia_no_coincide')
        return value, dict(archivo=relative, sha256=digest)

    def receipt(self, sku, kind, source):
        item = dict(tipo=kind, **source)
        if item not in self.proofs.setdefault(sku, []):
            self.proofs[sku].append(item)

    def sealed_source(self, sku):
        registry, anchor = self.read('importacion/excepciones-presentacion-sellada.json')
        row = registry.get('productos', {}).get(sku, {})
        if registry.get('version') != 1 or row.get('aprobado_por_propietario') is not True or row.get('tipo') not in (
                'UNIDAD_SORPRESA_SELLADA', 'UNIDAD_COMERCIAL_SELLADA'):
            return None
        proof = row.get('evidencia', registry.get('evidencia', {}))
        if not str(proof.get('archivo', '')).startswith('reportes/') or not re.fullmatch('[a-f0-9]{64}', proof.get('sha256', '')):
            return None
        source, verified = self.read(proof['archivo'], proof['sha256'])
        claim = source.get('excepciones_presentacion_sellada', {}).get(sku, {})
        if source.get('origen') != 'CONFIRMACION_PROPIETARIO_CHAT' or not all(
                claim.get(key) is True for key in ['autorizada', 'mostrar_empaque', 'unidad_sellada']):
            return None
        return source, anchor, verified

    def sealed(self, sku, contract):
        if contract.get('unidad_venta', {}).get('sellada') is not True:
            return False
        approved = self.sealed_source(sku)
        if approved is None:
            return False
        for proof in approved[1:]:
            self.receipt(sku, 'presentacion_sellada_ya_autorizada', proof)
        return True

    def visual(self, sku, info):
        if sku != 'PROT003':
            return False
        source, proof = self.read('importacion/fotografia-publicada/PROT003.json')
        valid = (source.get('sku') == sku and source.get('aprobado_por_propietario') is True and
                 source.get('maestro_aprobado_sha256') == info.get('sha256_original') and
                 info.get('sha256_original') == 'ec2a21e15462f82bed2c87963ee69e46fc961ad998613a9176be5341f3393f53' and
                 source.get('imagenProfesional') == info and source.get('publicacion_verificada') is True and
                 source.get('estado') == 'PUBLICADO_VERIFICADO' and
                 source.get('sha256_publicada') == info.get('versiones', {}).get('1200', {}).get('sha256'))
        if valid:
            self.receipt(sku, 'aprobacion_visual_propietario_por_sha_existente', proof)
        return valid

    def verify_snapshot(self):
        current = subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD'], text=True).strip()
        if current != self.commit:
            raise ValueError('Cambio concurrente del commit de la fuente')
        for filename, (digest, _) in self.cache.items():
            if hashlib.sha256((self.root / filename).read_bytes()).hexdigest() != digest:
                raise ValueError('Cambio concurrente de evidencia: ' + filename)

    def publication(self, sku, contract, slug):
        check = contract.get('validaciones', {}).get('publicacion_http', {})
        if contract.get('estado_publicacion') == 'PUBLICADO_VERIFICADO' and check.get('estado') == 'VERIFICADO':
            return
        filename = check.get('archivo') or check.get('reporte')
        if not filename or not re.fullmatch('[a-f0-9]{64}', check.get('sha256', '')):
            return
        report, proof = self.read(filename, check['sha256'])
        matches = [r for r in report.get('resultados', []) if r.get('sku') == sku]
        if len(matches) != 1:
            return
        row = matches[0]
        if (row.get('solicitado') != sku or row.get('estado') != 'publicado_verificado' or
                row.get('http') != 200 or row.get('imagen_pendiente') is not False or
                row.get('url') != local_url('/productos/' + slug + '/') or
                not re.fullmatch('[a-f0-9]{64}', row.get('sha256_ficha', '')) or
                not row.get('versiones_verificadas') or
                any(v.get('http') != 200 or not re.fullmatch('[a-f0-9]{64}', v.get('sha256', ''))
                    for v in row['versiones_verificadas'])):
            return
        # Normalización en memoria del esquema antiguo; el informe y el contrato no cambian.
        contract['estado_publicacion'] = 'PUBLICADO_VERIFICADO'
        contract['validaciones']['publicacion_http'] = dict(check, estado='VERIFICADO', sku=sku)
        self.receipt(sku, 'publicacion_historica_recuperada', proof)

    def omitted_identity(self, sku, p, o, contract, slug):
        identity = contract.get('validaciones', {}).get('identidad', {})
        issues = identity.get('discrepancias_pendientes', [])
        if not issues or identity.get('sku_verificado') is not True or contract.get('estado_calidad') != 'APROBADO':
            return
        obj = product_schema((self.root / 'productos' / slug / 'index.html').read_text())
        emitted = json.dumps({k: obj.get(k) for k in ['name', 'description', 'brand', 'model']}, ensure_ascii=False)
        normalize = lambda value: re.sub(r'[^a-z0-9]', '', value.casefold())
        emitted = normalize(emitted + p.get('name', '') + o.get('nombre', '') + o.get('descripcion', ''))
        for issue in issues:
            field = issue.get('campo')
            value = issue.get('valor_catalogo')
            if (field not in ('marca', 'modelo') or issue.get('tratamiento') != 'NO_DECLARAR' or
                    identity.get(field + '_no_declarada' if field == 'marca' else field + '_no_declarado') is not True or
                    contract.get(field) or not isinstance(value, str) or not normalize(value) or normalize(value) in emitted):
                return
        identity['discrepancias_pendientes'] = []
        self.receipt(sku, 'no_declaracion_existente_respetada', self.read('importacion/contratos/' + sku + '.json')[1])

    def reconcile(self, p, o, contract, slug):
        p, o, contract = copy.deepcopy((p, o, contract))
        sku = p['sku']
        premium, _ = self.read('importacion/premium-activo.json')
        reserved = premium.get('productos', {}).get(sku, {})
        if p.get('imageUrl') and reserved.get('sha256_maestro'):
            raw = (self.root / p['imageUrl'].lstrip('/')).read_bytes()
            if hashlib.sha256(raw).hexdigest() == reserved['sha256_maestro']:
                a = reserved.get('aprobacion_visual', {})
                if not (reserved.get('fidelidad_resuelta') is True and a.get('aprobado_por_propietario') is True and
                        a.get('fecha') and a.get('evidencia') and a.get('sha256') == reserved['sha256_maestro']):
                    raise ValueError('aprobacion_premium_por_sha_pendiente')
        effective = self.snapshot['productos'].get(sku, {})
        if effective.get('imagen') and effective['imagen'] != o.get('imagen'):
            if contract.get('imagen_principal') != o.get('imagen') or not effective.get('fuentes'):
                raise ValueError('cadena_imagen_contrato_no_acreditada')
            for proof in effective['fuentes']:
                self.read(proof['archivo'], proof['sha256'])
                self.receipt(sku, 'portada_vigente_aprobada', proof)
            o.update(imagen=effective['imagen'], imagenProfesional=effective['imagenProfesional'])
            contract['imagen_principal'] = effective['imagen']
            if sku == 'PROT003':
                p['imageUrl'] = effective['imagen']  # Misma excepción del renderer, sin escribir catálogo.
        if sku == 'CUBO024' and effective.get('nombre') != o.get('nombre'):
            source, proof = self.read('importacion/fotografia-publicada/direccion-20261026-06.json')
            approval = source.get('ajuste_titulo', {})
            if approval.get('sku') == sku and approval.get('autorizado_por_propietario') is True and (
                    o.get('nombre') == approval.get('anterior') and p.get('name') == approval.get('nuevo') == effective.get('nombre')):
                o['nombre'] = approval['nuevo']
                self.receipt(sku, 'titulo_premium_ya_autorizado', proof)
        if sku == 'CHIP003' and p.get('name') != o.get('nombre'):
            approved = self.sealed_source(sku)
            claim = approved[0].get('cambioOperadorCHIP003', {}) if approved else {}
            if (claim.get('sku') == sku and claim.get('fuente') == 'ORDEN_EXPRESA_PROPIETARIO_CHAT' and
                    claim.get('conservarSKUPreciosStockURL') is True and claim.get('mostrarEmpaqueAnteriorTuenti') is True and
                    p.get('name') == 'Chip Simcard ' + claim.get('operadorAnterior', '') and
                    o.get('nombre') == contract.get('titulo_comercial') == 'Chip SIM ' + claim.get('operadorActualConfirmado', '')):
                p['name'] = o['nombre']
                self.receipt(sku, 'operador_ya_confirmado_sin_renombrar_593', approved[2])
        self.publication(sku, contract, slug)
        self.omitted_identity(sku, p, o, contract, slug)
        return p, o, contract
