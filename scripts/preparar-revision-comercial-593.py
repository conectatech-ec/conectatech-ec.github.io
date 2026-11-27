#!/usr/bin/env python3
"""Prepara el MISMO corte público usando el validador 593 original, sin publicar.

XLSX, identidades y columnas privadas permanecen locales. Los módulos originales
se importan por SHA; no se duplica el parser ni se crea otro inventario.
Sólo se añaden compromisos técnicos de identidad, nunca nombres ERP ni costos.
"""
import argparse,collections,contextlib,copy,csv,hashlib,importlib.util,io,json,os,subprocess,sys,tempfile,urllib.request
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path

PIN='79f4e4fb77e30fd3a8a7ebac009cd8204a3b4c95'
MODULES={
 'report_identity.py':'d023d449cb7cec2bddfbfdbea89ad47881f9a765578e947bbfa191adcb3d955b',
 'inventory_completeness.py':'fbe6f014868364f224fa2c7ac1189762375299feebff6c2c25e48714259bed6e',
 'normalizar_593.py':'8cac386759763e357100bbb683c2e6008528fcad517ee5b1ec4d4aa15d656a86',
 'data_hub_593.py':'4072336099a31a81a64685b1e2c60b7354246721a815a3d73b1688e6bf0bb50d'}
BASE='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'+PIN+'/automatizacion/'

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read_json(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def utc(value):
    if not isinstance(value,str):raise ValueError('RECEPTION_TIMESTAMP_REQUIRED')
    try:d=datetime.fromisoformat(value.replace('Z','+00:00'))
    except ValueError:raise ValueError('RECEPTION_TIMESTAMP_INVALID') from None
    if d.tzinfo is None:raise ValueError('RECEPTION_TIMESTAMP_TIMEZONE_REQUIRED')
    return d.astimezone(timezone.utc)
def milliseconds(value):return utc(value).isoformat(timespec='milliseconds').replace('+00:00','Z')

@contextlib.contextmanager
def original_validator(path=None):
    """Importar exactamente los módulos originales aprobados, una vez por proceso."""
    with tempfile.TemporaryDirectory(prefix='original-593-code-') as temporary:
        folder=Path(path).resolve().parent if path else Path(temporary)
        for name,expected in MODULES.items():
            file=folder/name
            if path is None:
                with urllib.request.urlopen(BASE+name,timeout=30) as response:raw=response.read(1000000)
                if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('ORIGINAL_VALIDATOR_SHA_MISMATCH '+name)
                file.write_bytes(raw)
            if not file.is_file() or digest(file)!=expected:raise ValueError('ORIGINAL_VALIDATOR_SHA_MISMATCH '+name)
        names=['report_identity','inventory_completeness','normalizar_593','data_hub_593']
        saved={name:sys.modules.get(name) for name in names}
        try:
            for name in names:
                spec=importlib.util.spec_from_file_location(name,folder/(name+'.py'))
                module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module)
            sys.modules['normalizar_593'].identity_signature=sys.modules['data_hub_593'].identity
            yield sys.modules['normalizar_593']
        finally:
            for name,value in saved.items():
                if value is None:sys.modules.pop(name,None)
                else:sys.modules[name]=value

@contextlib.contextmanager
def original_name(path,name,normalizer):
    # Sólo copia efímera local si el nombre físico de descarga difiere; Drive y
    # original permanecen intactos y read_xlsx sigue validando el nombre oficial.
    normalizer.report_name(name)
    path=Path(path)
    if path.name==name:
        yield path;return
    with tempfile.TemporaryDirectory(prefix='private-593-name-') as temporary:
        target=Path(temporary)/name;target.write_bytes(path.read_bytes());target.chmod(0o600)
        yield target

def approved_missing_rows(cut,prior_rows,normalizer,now,*,repo,supplemental_excel,supplemental_name):
    """Sólo altas ya aprobadas: recibo previo + evidencia local + XLSX auténtico.

    No se infiere una aprobación desde el candidato. El SHA del recibo vigente
    debe identificar exactamente el original que respalda la fila ausente.
    """
    missing=set(cut['productos'])-set(prior_rows)
    receipts=[];approved=set()
    for receipt in cut.get('altas_validadas',[]):
        skus=receipt.get('skus',[])
        if not isinstance(skus,list) or any(not isinstance(s,str) for s in skus) or len(skus)!=len(set(skus)):
            raise ValueError('APPROVED_ALTA_RECEIPT_INVALID')
        selected=set(skus)
        if not selected&missing:continue
        if selected&set(prior_rows):raise ValueError('APPROVED_ALTA_PREVIOUS_ROW_OVERRIDE')
        if selected-set(cut['productos']) or selected&approved:raise ValueError('APPROVED_ALTA_RECEIPT_INVALID')
        approved.update(selected);receipts.append(receipt)
    if approved!=missing:raise ValueError('APPROVED_ALTA_RECEIPT_MISSING')
    if not repo or not supplemental_excel:raise ValueError('APPROVED_ALTA_ORIGINAL_AND_REPO_REQUIRED')
    root=Path(repo).resolve(strict=True)
    if not root.is_dir():raise ValueError('APPROVED_ALTA_EVIDENCE_PATH_INVALID')
    original_sha=digest(supplemental_excel)
    if any(r.get('sha256_original')!=original_sha for r in receipts):raise ValueError('APPROVED_ALTA_SOURCE_SHA_MISMATCH')
    with original_name(supplemental_excel,supplemental_name or Path(supplemental_excel).name,normalizer) as named:
        source,rows=normalizer.read_xlsx(named,now=now)
    if source['sha256']!=original_sha:raise ValueError('SOURCE_CHANGED_DURING_VALIDATION')
    if source['cut_date_evidence']!='593_matching_created_modified':raise ValueError('APPROVED_ALTA_EXPORT_TIME_NOT_CONFIRMED')
    counts=collections.Counter(r['values']['D'] for r in rows)
    by={r['values']['D']:r for r in rows};result={}
    for receipt in receipts:
        evidence_name=receipt.get('evidencia')
        if not isinstance(evidence_name,str):raise ValueError('APPROVED_ALTA_EVIDENCE_PATH_INVALID')
        relative=Path(evidence_name)
        if relative.is_absolute() or '..' in relative.parts or '\\' in evidence_name:raise ValueError('APPROVED_ALTA_EVIDENCE_PATH_INVALID')
        evidence_path=(root/relative).resolve(strict=True)
        if not evidence_path.is_relative_to(root) or not evidence_path.is_file():raise ValueError('APPROVED_ALTA_EVIDENCE_PATH_INVALID')
        evidence=read_json(evidence_path)
        if (receipt.get('fecha')!=source['cut_date'] or receipt.get('fuente')!=source['original_name'] or
            evidence.get('fecha_corte')!=receipt['fecha'] or evidence.get('archivo')!=receipt['fuente'] or
            evidence.get('sha256_original')!=original_sha):raise ValueError('APPROVED_ALTA_EVIDENCE_SOURCE_MISMATCH')
        products=evidence.get('productos',{})
        if not isinstance(products,dict) or set(products)!=set(receipt['skus']):raise ValueError('APPROVED_ALTA_EVIDENCE_SKUS_MISMATCH')
        for sku in receipt['skus']:
            row=by.get(sku);p=products[sku]
            if not row or counts[sku]!=1 or row['formulas'] or row['values'].get('F')!='PRODUCTO':raise ValueError('APPROVED_ALTA_EVIDENCE_ROW_MISMATCH '+sku)
            values=row['values']
            if (not isinstance(p,dict) or type(p.get('fila')) is not int or p['fila']!=row['row'] or p.get('nombre')!=values.get('C') or
                p.get('categoria593Original') is not None and p['categoria593Original']!=values.get('J')):raise ValueError('APPROVED_ALTA_EVIDENCE_ROW_MISMATCH '+sku)
            stock=Decimal(values['B']);evidence_stock=Decimal(str(p.get('stock')))
            if not stock.is_finite() or stock<0 or stock!=stock.to_integral_value() or stock!=evidence_stock:raise ValueError('APPROVED_ALTA_EVIDENCE_ROW_MISMATCH '+sku)
            cash=normalizer.cents(values['Q']);base=normalizer.cents(values['X']);tax=normalizer.cents(values['Y'])
            if (cash,base,tax,base+tax)!=(normalizer.cents(p.get('promo_contado')),normalizer.cents(p.get('pvp_neto')),normalizer.cents(p.get('iva_pvp_importe')),normalizer.cents(p.get('pvp_final'))):raise ValueError('APPROVED_ALTA_EVIDENCE_ROW_MISMATCH '+sku)
            canonical=cut['productos'][sku]
            if (int(stock),cash,base+tax)!=(canonical['stock'],canonical['promo_centavos'],canonical['pvp_centavos']):raise ValueError('APPROVED_ALTA_CANONICAL_VALUES_MISMATCH '+sku)
            result[sku]=row
    return result

def previous_report(path,cut,normalizer,now,*,repo=None,supplemental_excel=None,supplemental_name=None):
    if digest(path)!=cut['sha256_original']:raise ValueError('PREVIOUS_XLSX_SHA_MISMATCH')
    with original_name(path,'Reporte-Inventario.xlsx',normalizer) as named:
        source,rows=normalizer.read_xlsx(named,now=now,historical=True)
    if source['sha256']!=cut['sha256_original']:raise ValueError('PREVIOUS_XLSX_SHA_MISMATCH')
    if source['cut_date']!=cut['fecha_corte'] or source['cut_date_evidence']!='593_matching_created_modified':raise ValueError('PREVIOUS_EXPORT_TIME_NOT_CONFIRMED')
    counts=collections.Counter(r['values']['D'] for r in rows)
    if any(v!=1 for v in counts.values()):raise ValueError('PREVIOUS_DUPLICATE_SKU')
    by={r['values']['D']:r for r in rows}
    if set(cut['productos'])-set(by):
        by.update(approved_missing_rows(cut,by,normalizer,now,repo=repo,supplemental_excel=supplemental_excel,supplemental_name=supplemental_name))
    for sku,p in cut['productos'].items():
        r=by.get(sku)
        if not r or r['formulas'] or r['values'].get('F')!='PRODUCTO':raise ValueError('PREVIOUS_SOURCE_CANONICAL_COVERAGE_INVALID')
        values=r['values']
        stock=Decimal(values['B'])
        if not stock.is_finite() or stock!=stock.to_integral_value():raise ValueError('PREVIOUS_STOCK_INVALID')
        triple=(int(stock),normalizer.cents(values['Q']),normalizer.cents(values['X'])+normalizer.cents(values['Y']))
        if triple!=(p['stock'],p['promo_centavos'],p['pvp_centavos']):raise ValueError('PREVIOUS_CANONICAL_VALUES_MISMATCH '+sku)
    return source,by

def baseline_for_normalizer(text,cut,prior_rows,normalizer):
    rows=list(csv.DictReader(io.StringIO(text.lstrip('\ufeff'))))
    if not rows or len({r.get('sku') for r in rows})!=len(rows):raise ValueError('BASELINE_INVALID_OR_DUPLICATE_SKU')
    fields=list(rows[0]);by={r['sku']:dict(r) for r in rows}
    for field in ('sku','nombre','stock','promo_contado','pvp_final','categoria','tipo'):
        if field not in fields:fields.append(field)
    for sku,p in cut['productos'].items():
        if sku not in by and sku not in prior_rows:raise ValueError('BASELINE_CANONICAL_IDENTITY_MISSING '+sku)
        row=by.setdefault(sku,{f:'' for f in fields});row['sku']=sku
        if sku in prior_rows:
            original=prior_rows[sku]['values']
            row.update(nombre=original['C'],categoria=original.get('J',''),tipo=original['F'])
        # Sólo el corte anterior realmente publicado es la base comercial; no
        # usar precios del CSV histórico ni del Excel candidato como baseline.
        row.update(stock=str(p['stock']),promo_contado=format(Decimal(p['promo_centavos'])/100,'.2f'),pvp_final=format(Decimal(p['pvp_centavos'])/100,'.2f'))
    stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=fields,lineterminator='\n');writer.writeheader();writer.writerows(by.values())
    return stream.getvalue()

def checkout_evidence(cut,source,rows,normalizer):
    """Evidence from the original validated rows, in the existing cut; no approval bypass."""
    receipt=cut.get('revision_fuente') or {}
    if (receipt.get('version')!=1 or receipt.get('evidencia')!='XLSX_CORE_CREATED_EQUALS_MODIFIED' or
        type(receipt.get('secuencia')) is not int or receipt['secuencia']<1 or
        source['sha256']!=cut['sha256_original'] or source['cut_date']!=cut['fecha_corte'] or
        source['cut_date_evidence']!='593_matching_created_modified' or
        milliseconds(source['generated_at'])!=milliseconds(receipt.get('generado_en'))):
        raise ValueError('CHECKOUT_VALIDATION_RECEIPT_REQUIRED')
    if not callable(getattr(normalizer,'identity_signature',None)):
        raise ValueError('CHECKOUT_ORIGINAL_IDENTITY_MODULE_REQUIRED')
    counts=collections.Counter(r['values']['D'] for r in rows)
    if len(counts)!=cut['cantidad_sku_original'] or any(n!=1 for n in counts.values()):
        raise ValueError('CHECKOUT_ORIGINAL_COVERAGE_INVALID')
    by={r['values']['D']:r for r in rows};proofs={};projection=[]
    if not 1000<=len(cut['productos'])<=5000 or len(cut['productos'])!=cut['cantidad_sku_web']:
        raise ValueError('CHECKOUT_PUBLISHED_COVERAGE_INVALID')
    for sku,price in sorted(cut['productos'].items()):
        row=by.get(sku)
        if not row or row['formulas'] or row['values'].get('F')!='PRODUCTO' or not row['values'].get('C'):
            raise ValueError('CHECKOUT_ORIGINAL_IDENTITY_INVALID '+sku)
        v=row['values'];stock=Decimal(v['B'])
        if not stock.is_finite() or stock<0 or stock!=stock.to_integral_value():
            raise ValueError('CHECKOUT_ORIGINAL_STOCK_INVALID '+sku)
        values=(int(stock),normalizer.cents(v['Q']),normalizer.cents(v['X'])+normalizer.cents(v['Y']))
        if values!=(price['stock'],price['promo_centavos'],price['pvp_centavos']):
            raise ValueError('CHECKOUT_ORIGINAL_COMMERCIAL_MISMATCH '+sku)
        proofs[sku]=normalizer.identity_signature({'source_name':v['C'],'variant_gb':normalizer.variants(v['C'])})
        projection.append([sku,*values])
    encode=lambda value:json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
    generated=utc(source['generated_at'])
    from datetime import timedelta
    evidence={'schema':'conectatech.checkout-source-attestation.v1','source_sha256':source['sha256'],
        'cut_date':source['cut_date'],'generated_at':milliseconds(source['generated_at']),
        'expires_at':milliseconds((generated+timedelta(hours=24)).isoformat()),
        'revision_sequence':receipt['secuencia'],'validator_commit':PIN,
        'validator_modules_sha256':dict(MODULES),'projection_sha256':hashlib.sha256(encode(projection)).hexdigest(),
        'identity_signatures':proofs}
    evidence['attestation_sha256']=hashlib.sha256(encode(evidence)).hexdigest()
    return evidence

def prepare(excel,state,previous,catalog,baseline_csv,received_at,*,normalizer,name=None,previous_excel=None,repo=None,now=None):
    """Función sin escrituras. now sólo permite reloj fijo en pruebas aisladas."""
    now=now or datetime.now(timezone.utc);received=utc(received_at)
    if received>now:raise ValueError('RECEPTION_TIMESTAMP_FROM_FUTURE')
    if previous.get('sha256_original')!=state.get('origen_sha256') or previous.get('fecha_corte')!=state.get('fecha_corte'):raise ValueError('PREVIOUS_CUT_STATE_MISMATCH')
    if catalog.get('fuente_sha256')!=state['origen_sha256'] or catalog.get('fecha_corte')!=state['fecha_corte']:raise ValueError('CURRENT_CATALOG_STATE_MISMATCH')
    candidate_sha=digest(excel)
    if candidate_sha==state['origen_sha256']:
        # El mismo original ya validado no cambia recibos, fecha ni datos, y no
        # vuelve a validar identidades contra un CSV histórico obsoleto.
        result=copy.deepcopy(previous)
        # Metadata-only backfill of an already published SHA; preserve its receipt/time.
        # A legacy cut without its confirmed receipt remains closed to checkout.
        if 'evidencia_checkout' not in result and result.get('revision_fuente'):
            with original_name(excel,name or Path(excel).name,normalizer) as named:
                source,rows=normalizer.read_xlsx(named,now=now)
            result['evidencia_checkout']=checkout_evidence(result,source,rows,normalizer)
        return result
    previous_source=None;prior_rows={}
    if not previous_excel and any(r.get('fecha','')>previous['fecha_corte'] for r in previous.get('altas_validadas',[])):
        raise ValueError('PREVIOUS_XLSX_REQUIRED_FOR_APPROVED_ALTAS')
    if previous_excel:
        previous_source,prior_rows=previous_report(previous_excel,previous,normalizer,now,repo=repo,supplemental_excel=excel,supplemental_name=name)
    baseline=baseline_for_normalizer(baseline_csv,previous,prior_rows,normalizer)
    published=copy.deepcopy(catalog);published['fechaCatalogo']=catalog.get('fechaCatalogo') or catalog['fecha_corte']
    with original_name(excel,name or Path(excel).name,normalizer) as named:
        canonical,validation=normalizer.normalize(named,baseline,published,now=now,baseline_cut_date=state['fecha_corte'])
        source,rows=normalizer.read_xlsx(named,now=now)
    if source['sha256']!=candidate_sha or canonical['source']['sha256']!=candidate_sha:raise ValueError('SOURCE_CHANGED_DURING_VALIDATION')
    if source['cut_date_evidence']!='593_matching_created_modified':raise ValueError('EXPORT_TIME_CORE_EQUALITY_NOT_CONFIRMED')
    if source['cut_date']<state['fecha_corte']:raise ValueError('REPORT_OLDER_THAN_LAST_PUBLISHED_CUT')
    generated=utc(source['generated_at'])
    if generated>received:raise ValueError('EXPORT_AFTER_RECEIPT')
    if validation.get('duplicate_sku'):raise ValueError('DUPLICATE_SKU')
    old_products=previous['productos'];web={p['sku']:p for p in catalog['productos']}
    required=set(old_products)|set(web)
    if len(required)<1000 or validation['unique_sku']<1000:raise ValueError('REPORT_BELOW_EXISTING_MINIMUM_1000')
    normalized={p['sku']:p for p in canonical['products']}
    raw={r['values']['D']:r for r in rows}
    projected={}
    for sku in sorted(required):
        p=normalized.get(sku);row=raw.get(sku)
        if not p or not row:raise ValueError('SOURCE_CANONICAL_SKU_MISSING '+sku)
        if p['blocked_reasons']:raise ValueError('SOURCE_CANONICAL_BLOCKED '+sku+' '+','.join(p['blocked_reasons']))
        # Importes YA calculados/validados por normalizar_593; stock procede de
        # su misma fila validada, sin tratar ausencia como cero.
        stock=int(Decimal(row['values']['B']))
        projected[sku]={'stock':stock,'promo_centavos':p['prices']['promo_cash_cents'],'pvp_centavos':p['prices']['pvp_card_cents']}
    prior_receipt=state.get('revision_fuente') or previous.get('revision_fuente')
    r={'version':1,'anterior_sha256':state['origen_sha256'],'secuencia':(prior_receipt or {}).get('secuencia',0)+1,
       'generado_en':milliseconds(source['generated_at']),'recibido_en':milliseconds(received_at),'evidencia':'XLSX_CORE_CREATED_EQUALS_MODIFIED'}
    previous_generated=(prior_receipt or {}).get('generado_en')
    if source['cut_date']==state['fecha_corte'] and not previous_generated:
        if not previous_source:raise ValueError('PREVIOUS_XLSX_REQUIRED_FOR_INTRADAY_BOOTSTRAP')
        previous_generated=milliseconds(previous_source['generated_at'])
        r['anterior_confirmado']={'sha256':state['origen_sha256'],'generado_en':previous_generated,'evidencia':'XLSX_CORE_CREATED_EQUALS_MODIFIED'}
    if previous_generated and utc(r['generado_en'])<=utc(previous_generated):raise ValueError('REPORT_EXPORT_NOT_STRICTLY_NEWER')
    if prior_receipt and utc(r['recibido_en'])<=utc(prior_receipt['recibido_en']):raise ValueError('REPORT_RECEIPT_NOT_STRICTLY_NEWER')
    counters=dict(stock_cambiado=0,disponibilidad_cambiada=0,promo_cambiado=0,pvp_cambiado=0,precios_productos_cambiados=0)
    for sku,p in projected.items():
        before=old_products.get(sku)
        if before is None:
            w=web[sku];before={'stock':w['stock'],'promo_centavos':normalizer.cents(w['promo']),'pvp_centavos':normalizer.cents(w['pvp'])}
        counters['stock_cambiado']+=p['stock']!=before['stock'];counters['disponibilidad_cambiada']+=(p['stock']>0)!=(before['stock']>0)
        cash=p['promo_centavos']!=before['promo_centavos'];card=p['pvp_centavos']!=before['pvp_centavos']
        counters['promo_cambiado']+=cash;counters['pvp_cambiado']+=card;counters['precios_productos_cambiados']+=cash or card
    result={'fecha_corte':source['cut_date'],'fuente':name or Path(excel).name,'sha256_original':candidate_sha,
            'cantidad_sku_original':validation['unique_sku'],'cantidad_sku_web':len(projected),'productos':projected,
            'verificacion':counters,'revision_fuente':r}
    result['evidencia_checkout']=checkout_evidence(result,source,rows,normalizer)
    if previous.get('altas_validadas'):result['altas_validadas']=copy.deepcopy(previous['altas_validadas'])
    if repo:
        script="const fs=require('fs'),path=require('path');const repo=process.argv[1];const data=JSON.parse(fs.readFileSync(0,'utf8'));const result=require(path.join(repo,'scripts/aplicar-corte-comercial-593.cjs')).prepare(fs.readFileSync(path.join(repo,'index.html'),'utf8'),data.cut,data.state,data.previous);process.stdout.write(JSON.stringify(result.summary));"
        completed=subprocess.run(['node','-e',script,str(Path(repo).resolve())],input=json.dumps({'cut':result,'state':state,'previous':previous}),text=True,capture_output=True,check=False)
        if completed.returncode:raise ValueError('PUBLICADOR_PREVALIDATION_FAILED '+completed.stderr[-1600:])
        summary=json.loads(completed.stdout)
        if summary['origen_sha256']!=candidate_sha or summary['revision_fuente']['secuencia']!=r['secuencia']:raise ValueError('PUBLICADOR_PREVALIDATION_RECEIPT_MISMATCH')
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--excel',required=True,type=Path);p.add_argument('--estado',required=True,type=Path);p.add_argument('--corte-anterior',required=True,type=Path)
    p.add_argument('--catalogo',required=True,type=Path);p.add_argument('--base-csv',required=True,type=Path);p.add_argument('--recibido-en',required=True)
    p.add_argument('--nombre-original');p.add_argument('--excel-anterior',type=Path);p.add_argument('--validador',type=Path);p.add_argument('--repo',type=Path);p.add_argument('--salida',type=Path)
    a=p.parse_args()
    with original_validator(a.validador) as normalizer:
        result=prepare(a.excel,read_json(a.estado),read_json(a.corte_anterior),read_json(a.catalogo),a.base_csv.read_text(encoding='utf-8-sig'),a.recibido_en,
                       normalizer=normalizer,name=a.nombre_original,previous_excel=a.excel_anterior,repo=a.repo)
    text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if a.salida:
        if a.salida.resolve() in {f.resolve() for f in [a.excel,a.estado,a.corte_anterior,a.catalogo,a.base_csv,a.excel_anterior] if f}:raise ValueError('OUTPUT_CANNOT_OVERWRITE_SOURCE')
        a.salida.parent.mkdir(parents=True,exist_ok=True)
        fd,temp=tempfile.mkstemp(prefix='.593-prepared-',dir=a.salida.parent)
        try:
            with os.fdopen(fd,'w') as f:f.write(text)
            os.replace(temp,a.salida)
        finally:
            if os.path.exists(temp):os.unlink(temp)
        print(json.dumps({'estado':'PREPARADO_LOCAL_SIN_PUBLICAR','archivo':str(a.salida),'sha256_original':result['sha256_original'],'fecha_corte':result['fecha_corte']}))
    else:sys.stdout.write(text)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('ERROR_593 '+str(error),file=sys.stderr);raise SystemExit(1)
