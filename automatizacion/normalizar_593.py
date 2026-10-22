"""One commercial contract; XLSX remains private. Standard library only, never executes Excel."""
import argparse,collections,csv,hashlib,io,json,re,zipfile,tempfile,shutil,os,xml.etree.ElementTree as ET
from datetime import datetime,timedelta,timezone
from decimal import Decimal,InvalidOperation,ROUND_HALF_UP
from pathlib import Path
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
SCHEMA='conectatech.commercial.v1'
HEADERS={'B':'Stock','C':'Producto','D':'Cod. Principal','F':'Tipo','J':'Categoría','Q':'V. TOTAL','X':'PVP','Y':'PVP % IVA'}
def stamp():return datetime.now(timezone.utc)
def iso(v):return v.astimezone(timezone.utc).isoformat().replace('+00:00','Z')
def xml(data):
 if b'<!DOCTYPE' in data or b'<!ENTITY' in data:raise ValueError('XML_ENTITIES_FORBIDDEN')
 return ET.fromstring(data)
def cents(v):
 try:
  n=Decimal(str(v));q=n.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
  if not n.is_finite() or n<0 or abs(n-q)>Decimal('.000001') or n>1000000:raise ValueError()
  return int(q*100)
 except (InvalidOperation,ValueError,TypeError):raise ValueError('INVALID_PRICE')
def variants(name):return sorted(set(int(x) for x in re.findall(r'\b(\d+)\s*GB\b',str(name),re.I)))
def read_xlsx(path,now=None,historical=False):
 now=now or stamp();path=Path(path);raw=path.read_bytes()
 if len(raw)>2000000:raise ValueError('FILE_SIZE_LIMIT')
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  if sum(f.file_size for f in z.infolist())>16000000 or any('vbaProject' in f.filename or 'externalLinks/' in f.filename for f in z.infolist()):raise ValueError('UNSAFE_WORKBOOK')
  core=xml(z.read('docProps/core.xml'));created=core.find('{http://purl.org/dc/terms/}created');generated=datetime.fromisoformat(created.text.replace('Z','+00:00')) if created is not None else None
  if generated is None or generated.tzinfo is None:raise ValueError('REPORT_TIMESTAMP_REQUIRED')
  match=re.search(r'(\d{2})-(\d{2})-(\d{4})',path.name)
  local_date=generated.astimezone(timezone(timedelta(hours=-5))).date().isoformat()
  if match and local_date!=f'{match[3]}-{match[2]}-{match[1]}':raise ValueError('REPORT_DATE_MISMATCH')
  if generated>now+timedelta(minutes=5):raise ValueError('REPORT_FROM_FUTURE')
  if now-generated>timedelta(hours=24) and not historical:raise ValueError('REPORT_EXPIRED')
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():shared=[''.join(e.itertext()) for e in xml(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
  workbook=xml(z.read('xl/workbook.xml'));sheets=workbook.findall('s:sheets/s:sheet',NS)
  if len(sheets)!=1:raise ValueError('SINGLE_INVENTORY_SHEET_REQUIRED')
  rows=[];headers=None
  for row in xml(z.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row',NS):
   values={};formulas=[]
   for cell in row.findall('s:c',NS):
    col=re.sub(r'\d','',cell.get('r',''))
    if col not in HEADERS:continue
    v=cell.find('s:v',NS);value=v.text if v is not None else ''
    if cell.get('t')=='s' and value:value=shared[int(value)]
    elif cell.get('t')=='inlineStr':value=''.join(cell.find('s:is',NS).itertext())
    values[col]=str(value or '').strip()
    if cell.find('s:f',NS) is not None:formulas.append(col)
   if int(row.get('r'))==4:headers=values;continue
   if int(row.get('r'))<5 or not values.get('D'):continue
   rows.append({'row':int(row.get('r')),'values':values,'formulas':formulas})
  if headers!=HEADERS or len(rows)>5000 or not rows:raise ValueError('INVENTORY_SCHEMA_MISMATCH')
 return {'file_name':path.name,'sha256':hashlib.sha256(raw).hexdigest(),'cut_date':local_date,'generated_at':iso(generated),'received_at':iso(now),'sheet':sheets[0].get('name'),'mapping':{'sku':'D','name':'C','availability':'B>0','promo_cash':'Q','pvp_card':'X+Y'}},rows
def normalize(path,baseline_csv,published,now=None,historical=False,media=None,sale_units=None,baseline_cut_date=None):
 now=now or stamp();source,rows=read_xlsx(path,now,historical);old=list(csv.DictReader(io.StringIO(baseline_csv)));oldmap={p['sku']:p for p in old};web={p['sku']:p for p in published['productos']};counts=collections.Counter(r['values']['D'] for r in rows);products=[];stocks={};issues=[];seen=set()
 if len(rows)<len(oldmap)*.9:raise ValueError('INCOMPLETE_FULL_REPORT')
 for row in rows:
  v=row['values'];sku=v['D'];reasons=[]
  if sku in seen:continue
  seen.add(sku)
  if not re.fullmatch(r'[A-Z0-9_-]{3,40}',sku):reasons.append('INVALID_SKU')
  if counts[sku]!=1:reasons.append('DUPLICATE_SKU')
  if row['formulas']:reasons.append('FORMULA_IN_COMMERCIAL_FIELD')
  if v.get('F')!='PRODUCTO':reasons.append('NOT_A_PRODUCT')
  if not v.get('C') or len(v['C'])>250:reasons.append('INVALID_NAME')
  try:
   stock=Decimal(v.get('B',''));assert stock.is_finite() and stock==stock.to_integral_value();stocks[sku]=int(stock)
   if stock<0:reasons.append('NEGATIVE_STOCK')
  except (InvalidOperation,AssertionError):stock=None;reasons.append('INVALID_STOCK')
  prices=None
  try:
   cash,base,tax=map(cents,[v.get('Q'),v.get('X'),v.get('Y')]);card=base+tax
   if cash<=0 or card<=0 or card<cash:raise ValueError('ZERO_OR_INVERTED_PRICE')
   prices={'currency':'USD','promo_cash_cents':cash,'pvp_card_cents':card}
  except ValueError as e:reasons.append(str(e))
  signature=variants(v.get('C'));old_signature=variants(oldmap.get(sku,{}).get('nombre',''))
  if signature and old_signature and signature!=old_signature:reasons.append('VARIANT_CHANGED_REVIEW_MEDIA')
  if sku in oldmap and re.sub(r'\W','',v.get('C','').casefold())!=re.sub(r'\W','',oldmap[sku]['nombre'].casefold()):reasons.append('IDENTITY_NAME_CHANGED_REVIEW')
  linked=web.get(sku);availability='blocked' if reasons else 'in_stock' if stock>0 else 'out_of_stock'
  product={'sku':sku,'source_name':v.get('C',''),'name':linked['nombre'] if linked and not any('REVIEW' in r for r in reasons) else v.get('C',''),'category':v.get('J',''),'variant_gb':signature,'availability':availability,'blocked_reasons':reasons,'prices':prices,'provenance':{'sheet':source['sheet'],'row':row['row'],'cells':{k:f'{c}{row["row"]}' for k,c in {'sku':'D','name':'C','cash':'Q','pvp_base':'X','pvp_vat':'Y','availability':'B'}.items()},'cash_source':v.get('Q'),'pvp_base_source':v.get('X'),'pvp_vat_source':v.get('Y')},'web':{'url':linked.get('url') if linked else None,'price_matches':bool(linked and prices and cents(linked['promo'])==prices['promo_cash_cents'] and cents(linked['pvp'])==prices['pvp_card_cents'])}}
  if sale_units and sku in sale_units:product['sale_unit']='una pila de botón'
  if media and sku in media:product['web']['image_url']=media[sku]
  products.append(product)
  if reasons:issues.append({'sku':sku,'row':row['row'],'reasons':reasons})
 # Explicit tombstones prevent a missing reference from falling back to an older price.
 for sku in sorted(set(oldmap)-set(counts)):
  prev=oldmap[sku];products.append({'sku':sku,'source_name':prev['nombre'],'name':prev['nombre'],'category':prev.get('categoria',''),'variant_gb':variants(prev['nombre']),'availability':'blocked','blocked_reasons':['ABSENT_LATEST_REPORT'],'prices':None,'provenance':{'note':'Absent in current full report; discontinuation not asserted'},'web':{'url':web.get(sku,{}).get('url'),'price_matches':False}})
 products.sort(key=lambda p:p['sku'])
 canonical={'schema':SCHEMA,'source':source,'normalized_at':iso(now),'published_at':None,'expires_at':iso(datetime.fromisoformat(source['generated_at'].replace('Z','+00:00'))+timedelta(hours=24)),'products':products}
 changes=[]
 for p in products:
  prev=oldmap.get(p['sku']);w=web.get(p['sku']);fields=[]
  if prev:
   if p['prices'] and cents(prev['promo_contado'])!=p['prices']['promo_cash_cents']:fields.append('promo_cash')
   if p['prices'] and cents(prev['pvp_final'])!=p['prices']['pvp_card_cents']:fields.append('pvp_card')
   if p['sku'] in stocks and Decimal(prev['stock'])!=stocks[p['sku']]:fields.append('stock_quantity_private')
   if prev['nombre']!=p['source_name']:fields.append('source_name')
  if fields:changes.append({'sku':p['sku'],'fields':fields})
 summary={'source':source,'sku_rows':len(rows),'unique_sku':len(counts),'product_count':sum(r['values'].get('F')=='PRODUCTO' for r in rows),'service_count':sum(r['values'].get('F')=='SERVICIO' for r in rows),'duplicate_sku':[s for s,n in counts.items() if n>1],'blocked':issues,'blocked_count':len(issues),'in_stock':sum(p['availability']=='in_stock' for p in products),'out_of_stock':sum(p['availability']=='out_of_stock' for p in products),'comparison_16_oct':{'status':'not_available_not_inferred'},'comparison_last_published_593':{'cut_date':baseline_cut_date,'sku_count':len(oldmap),'new_sku':sorted(set(counts)-set(oldmap)),'absent_sku_not_proven_discontinued':sorted(set(oldmap)-set(counts)),'changed_sku':len(changes),'change_counts':dict(collections.Counter(f for c in changes for f in c['fields'])),'changes':changes},'comparison_web_feed':{'published_at':published['fechaCatalogo'],'sku_count':len(web),'common_sku':len(set(web)&set(counts)),'cash_changed':sum(bool(p['prices'] and p['sku'] in web and cents(web[p['sku']]['promo'])!=p['prices']['promo_cash_cents']) for p in products),'pvp_changed':sum(bool(p['prices'] and p['sku'] in web and cents(web[p['sku']]['pvp'])!=p['prices']['pvp_card_cents']) for p in products),'became_unavailable':sorted(p['sku'] for p in products if p['sku'] in web and p['availability']!='in_stock')},'private_columns_exported':False,'stock_quantities_exported':False}
 return canonical,summary
def adapters(canonical,outdir):
 outdir=Path(outdir);outdir.mkdir(parents=True,exist_ok=True);active=[p for p in canonical['products'] if p['availability']=='in_stock'];allvalid=[p for p in canonical['products'] if not p['blocked_reasons']]
 eligible=[p for p in active if p['web'].get('url') and p['web'].get('image_url') and p['web']['price_matches'] and p['category']]
 def money(p,k):return f"{p['prices'][k]/100:.2f}"
 def csvout(name,fields,data):
  with (outdir/name).open('w',newline='',encoding='utf-8') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(data)
 for name in ['alex','web_catalog','webstore','banner_factory','pdf_categories','whatsapp_business']:
  view={'source_sha256':canonical['source']['sha256'],'data_version':'593-v1-'+canonical['source']['sha256'],'canonical':'../current.json','enrichment':'../enrichment.json','generated_at':canonical['source']['generated_at'],'validated_at':canonical['normalized_at'],'expires_at':canonical['expires_at'],'sku':[p['sku'] for p in allvalid] if name in ['alex','web_catalog','webstore'] else [p['sku'] for p in active],'price_fields':{'cash':'prices.promo_cash_cents','card':'prices.pvp_card_cents'},'publishing_enabled':False}
  if name=='pdf_categories':view['categories']={k:[p['sku'] for p in active if (p['category'] or 'Sin categoría')==k] for k in sorted(set(p['category'] or 'Sin categoría' for p in active))}
  (outdir/(name+'.json')).write_text(json.dumps(view,ensure_ascii=False,separators=(',',':'))+'\n')
 rows=[{'id':p['sku'],'title':p['name'][:150],'description':p['name'],'availability':'in stock','condition':'new','price':money(p,'pvp_card_cents')+' USD','link':p['web']['url'],'image_link':p['web']['image_url'],'product_type':p['category']} for p in eligible]
 csvout('meta.csv',list(rows[0]) if rows else ['id','title','availability','condition','price','sale_price','link','image_link','product_type'],rows)
 # Cash prices are payment-conditional, so Google candidate uses card PVP without an unconditional sale claim.
 google=[{**r,'availability':'in_stock'} for r in rows];csvout('google.csv',list(google[0]) if google else ['id','title','description','availability','condition','price','link','image_link','product_type'],google)
 return {'source_sha256':canonical['source']['sha256'],'data_version':'593-v1-'+canonical['source']['sha256'],'destinations':8,'active_products':len(active),'meta_google_candidate_rows':len(rows),'publishing_enabled':False,'skipped_until_web_and_media_match':len(active)-len(rows),'conditional_sale_price_omitted':'Promo contado is conditional on payment method; no invented unconditional discount in automatic channel feeds.','external_validation_pending':['landing-page structured price/payment consistency','brand/GTIN requirements where applicable','destination account authorization']}
def write_bundle(out,canonical,report,previous_central=None):
 from data_hub_593 import write_hub
 out=Path(out);out.parent.mkdir(parents=True,exist_ok=True)
 previous=None
 if (out/'current.json').exists():
  previous=json.loads((out/'current.json').read_text())
 reference=previous_central or previous
 if reference and reference['source']['generated_at']>canonical['source']['generated_at']:raise ValueError('REPORT_OLDER_THAN_LAST_VALID')
 with tempfile.TemporaryDirectory(prefix='central-stage-',dir=out.parent) as directory:
  stage=Path(directory);channels=adapters(canonical,stage/'adapters');(stage/'current.json').write_text(json.dumps(canonical,ensure_ascii=False,separators=(',',':'))+'\n');(stage/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');(stage/'channels.json').write_text(json.dumps(channels,ensure_ascii=False,indent=2)+'\n')
  enrichment=json.loads((out/'enrichment.json').read_text()) if (out/'enrichment.json').exists() else None
  write_hub(stage,canonical,reference,existing_enrichment=enrichment)
  out.mkdir(exist_ok=True)
  if reference and reference['source']['sha256']!=canonical['source']['sha256']:(out/'last-valid.json').write_text(json.dumps(reference,ensure_ascii=False,separators=(',',':'))+'\n')
  for f in stage.iterdir():
   if f.name=='current.json':continue
   if f.is_dir():shutil.copytree(f,out/f.name,dirs_exist_ok=True)
   else:os.replace(f,out/f.name)
  os.replace(stage/'current.json',out/'current.json')
def main():
 a=argparse.ArgumentParser();a.add_argument('xlsx');a.add_argument('--baseline-csv',required=True);a.add_argument('--baseline-cut-date');a.add_argument('--published',required=True);a.add_argument('--media');a.add_argument('--sale-units');a.add_argument('--out',required=True);a.add_argument('--historical',action='store_true');args=a.parse_args()
 media=json.loads(Path(args.media).read_text()) if args.media else {};units=json.loads(Path(args.sale_units).read_text()).get('skus_aplicados',[]) if args.sale_units else []
 data,report=normalize(args.xlsx,Path(args.baseline_csv).read_text(encoding='utf-8-sig'),json.loads(Path(args.published).read_text()),historical=args.historical,media=media,sale_units=units,baseline_cut_date=args.baseline_cut_date)
 write_bundle(args.out,data,report);print(json.dumps({k:report[k] for k in ['sku_rows','unique_sku','product_count','service_count','blocked_count','in_stock','out_of_stock']}))
if __name__=='__main__':main()
