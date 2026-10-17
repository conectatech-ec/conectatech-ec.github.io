#!/usr/bin/env python3
"""Read only selected XLSX columns; output sanitized SQL, never costs or exact stock."""
import argparse, datetime as dt, hashlib, json, re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def rows(path):
 with zipfile.ZipFile(path) as z:
  if sum(i.file_size for i in z.infolist())>100_000_000: raise ValueError('XLSX demasiado grande')
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   shared=[''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)]
  wb=ET.fromstring(z.read('xl/workbook.xml')); sheet=wb.find('m:sheets/m:sheet',NS)
  rid=sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
  rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
  target=next(x.attrib['Target'] for x in rels if x.attrib['Id']==rid)
  part=target.lstrip('/') if target.startswith('/') else 'xl/'+target
  for row in ET.fromstring(z.read(part)).findall('.//m:sheetData/m:row',NS):
   cells={}
   for c in row.findall('m:c',NS):
    col=re.sub(r'\d','',c.attrib['r']);v=c.find('m:v',NS)
    value=v.text if v is not None else ''
    if c.find('m:f',NS) is not None: value='__FORMULA_NO_ADMITIDA__'
    elif c.attrib.get('t')=='s':value=shared[int(value)]
    elif c.attrib.get('t')=='inlineStr':value=''.join(c.find('m:is',NS).itertext())
    cells[col]=value or ''
   yield cells
def quote(x):return "'"+str(x).replace("'","''")+"'"
def build(path, mapping, editorial, until):
 if not re.fullmatch(r'Reporte-Inventario al \d{2}-\d{2}-\d{4}\.xlsx',path.name):raise ValueError('Requiere exportación XLSX de inventario identificada por fecha')
 if set(mapping)!={'sku','promo','pvp','stock'}:raise ValueError('Mapeo explícito requerido: sku,promo,pvp,stock')
 now=dt.datetime.now(dt.timezone.utc).timestamp()
 if not now<until<=now+172800:raise ValueError('Vigencia debe ser futura y máximo 48 horas')
 digest=hashlib.sha256(path.read_bytes()).hexdigest();iterator=iter(rows(path));headers=next(iterator)
 columns={}
 for key,label in mapping.items():
  matches=[col for col,value in headers.items() if value.strip()==label]
  if len(matches)!=1:raise ValueError('Encabezado ausente o ambiguo: '+label)
  columns[key]=matches[0]
 approved={p['sku']:p for p in editorial};seen=set();statements=['BEGIN TRANSACTION;','UPDATE products SET available=0;']
 for row in iterator:
  sku=row.get(columns['sku'],'').strip()
  if not sku:continue
  if sku in seen:raise ValueError('SKU duplicado: '+sku)
  seen.add(sku)
  if sku not in approved:continue
  values={}
  for key in ['promo','pvp','stock']:
   s=row.get(columns[key],'')
   if not re.fullmatch(r'\d+(?:\.\d+)?',s):raise ValueError('Valor numérico inválido: '+sku+' '+key)
   values[key]=float(s)
  if values['promo']<=0 or values['pvp']<=0:continue
  p=approved[sku];data=json.dumps({k:v for k,v in p.items() if k!='evidencia'},ensure_ascii=False)
  fingerprint=hashlib.sha256(json.dumps([sku,data,values['promo'],values['pvp'],values['stock']>0],ensure_ascii=False).encode()).hexdigest()
  statements.append('INSERT INTO products VALUES ('+','.join([quote(sku),quote(data),str(values['promo']),str(values['pvp']),str(int(values['stock']>0)),str(until),quote(fingerprint)])+') ON CONFLICT(sku) DO UPDATE SET data=excluded.data,promo=excluded.promo,pvp=excluded.pvp,available=excluded.available,verified_until=excluded.verified_until,inventory_digest=excluded.inventory_digest;')
 statements.append("INSERT INTO audit VALUES ("+quote('inventory:'+digest)+",'SISTEMA','INVENTARIO','IMPORTADO',"+quote(json.dumps({'source_sha256':digest,'source_file':path.name}))+","+str(int(now))+") ON CONFLICT(id) DO NOTHING;")
 statements.extend(["UPDATE publications SET state='PENDIENTE' WHERE state IN ('PREPARADO','APROBADO') AND EXISTS (SELECT 1 FROM products p WHERE p.sku=publications.sku AND (p.available=0 OR p.inventory_digest!=publications.inventory_digest));",'COMMIT;'])
 return '\n'.join(statements)+'\n'
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('xlsx',type=Path);p.add_argument('--mapping',type=Path,required=True);p.add_argument('--editorial',type=Path,default=Path('data/piloto-editorial.json'));p.add_argument('--valid-until',required=True,help='ISO 8601 UTC');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 try:
  until=int(dt.datetime.fromisoformat(a.valid_until.replace('Z','+00:00')).timestamp());sql=build(a.xlsx,json.loads(a.mapping.read_text()),json.loads(a.editorial.read_text()),until);a.output.write_text(sql);print('SQL comercial saneado generado; no aplicado a ningún servicio.')
 except (ValueError,KeyError,StopIteration,zipfile.BadZipFile) as e:p.error(str(e))
