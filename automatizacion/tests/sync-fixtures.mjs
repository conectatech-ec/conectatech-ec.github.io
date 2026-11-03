import {DatabaseSync} from 'node:sqlite';
import {commercialInit,commercialCleanup,commercialFetch} from '../commercial-reception.mjs';

function crc32(bytes){let c=0xffffffff;for(const n of bytes){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function workbook(tag='one'){
 const files={
  'docProps/core.xml':'<core xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:created>2026-10-25T22:49:48-05:00</dcterms:created><dcterms:modified>2026-10-25T22:49:48-05:00</dcterms:modified></core>',
  'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Inventario"/></sheets></workbook>',
  'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2" t="inlineStr"><is><t>INVENTARIO '+tag+'</t></is></c></row></sheetData></worksheet>'};
 const local=[],directory=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const n=Buffer.from(name),bytes=Buffer.from(text),crc=crc32(bytes),l=Buffer.alloc(30),d=Buffer.alloc(46);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(crc,14);l.writeUInt32LE(bytes.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(n.length,26);
  d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt32LE(crc,16);d.writeUInt32LE(bytes.length,20);d.writeUInt32LE(bytes.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);
  local.push(l,n,bytes);directory.push(d,n);offset+=l.length+n.length+bytes.length;
 }
 const index=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(3,8);end.writeUInt16LE(3,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,index,end]);
}
export function inbox(name='commercial-source-ci',env={},receiver={commercialInit,commercialCleanup,commercialFetch}){
 const db=new DatabaseSync(':memory:');let alarms=0;
 const box={name,env:{PILOT_TOKEN:'synthetic-private-test-pilot-key-00000',...env},state:{storage:{setAlarm:async()=>{alarms++;}}},sql:{exec(s,...p){const q=db.prepare(s),rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows,one:()=>rows[0]};}}};
 receiver.commercialInit(box);
 return {box,db,get alarms(){return alarms;},async call(path,body){receiver.commercialCleanup(box,Date.now());return receiver.commercialFetch(path.split('?')[0],new Request('https://inbox'+path,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined}),box);},async upload(bytes=workbook(),name='Reporte-Inventario.xlsx',headers={}){return receiver.commercialFetch('/commercial/report',new Request('https://inbox/commercial/report',{method:'POST',headers:{'X-Report-Filename':encodeURIComponent(name),...headers},body:bytes}),box);}};
}
export async function claim(box,sha){const r=await box.call('/commercial/complete',{sha256:sha,status:'claim'});return {response:r,data:await r.json()};}
export function confirmed(lease){return {...lease,status:'processed',validation:{cut_date:'2026-10-25',generated_at:'2026-10-25T22:49:48-05:00'}};}
