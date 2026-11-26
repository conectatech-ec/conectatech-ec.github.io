const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const code=fs.readFileSync(__dirname+'/drive-change-detection.gs','utf8');
const context={module:{exports:{}},console};vm.runInNewContext(code,context);
const {ct593Scan:scan,ct593Fingerprint:fp}=context.module.exports;
const digest=(b,alg='sha256')=>crypto.createHash(alg).update(Buffer.from(b)).digest('hex');
function fixture(){
 let now=Date.parse('2026-11-26T19:00:00Z'),bytes=Array.from(Buffer.alloc(130,3));
 let file={id:'file1',name:'Reporte-Inventario.xlsx',version:'1',modifiedTime:'2026-11-26T18:59:00Z',size:'130',md5Checksum:digest(bytes,'md5'),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',parents:['folder'],owners:[{emailAddress:'conectatech.ecu@gmail.com'}]};
 let cache=new Map(),calls={download:0,upload:0,retry:0},published='0'.repeat(64),receipt=null;
 let io={folder:'folder',mode:'LIVE',now:()=>now++,list:()=>[file],publishedSha:()=>published,get:id=>cache.get(id),put:(id,v)=>cache.set(id,v),download:()=>{calls.download++;return bytes;},metadata:()=>file,sha256:digest,md5:b=>digest(b,'md5'),receipt:()=>receipt,retry:()=>{calls.retry++;},upload:(f,b,sha)=>{calls.upload++;return {received:true,sha256:sha,trigger:'triggered'};}};
 return {io,file,bytes,cache,calls,setPublished:v=>published=v,setReceipt:v=>receipt=v};
}
let tests=0;function test(name,fn){fn();tests++;console.log('PASS '+name);}
test('sin archivos no descarga ni publica',()=>{let t=fixture();t.io.list=()=>[];scan(t.io);assert.equal(t.calls.download,0);assert.equal(t.calls.upload,0);});
test('reporte publicado con nuevo ID no se envia',()=>{let t=fixture();t.setPublished(digest(t.bytes));scan(t.io);assert.equal(t.calls.upload,0);assert.equal(t.cache.get('file1').terminal,true);});
test('metadatos identicos y terminales no vuelven a descargar',()=>{let t=fixture();t.cache.set('file1',{fingerprint:fp(t.file),sha256:digest(t.bytes),terminal:true});scan(t.io);assert.equal(t.calls.download,0);});
test('reemplazo del mismo ID se detecta',()=>{let t=fixture();t.cache.set('file1',{fingerprint:fp(t.file),sha256:'1'.repeat(64),terminal:true});t.file.version='2';scan(t.io);assert.equal(t.calls.upload,1);});
test('modificacion durante lectura no produce envio',()=>{let t=fixture();t.io.metadata=()=>({...t.file,version:'2'});scan(t.io);assert.equal(t.calls.upload,0);assert.equal(t.cache.size,0);});
test('checksum falso se rechaza',()=>{let t=fixture();t.file.md5Checksum='0'.repeat(32);assert.throws(()=>scan(t.io),/SOURCE_CHECKSUM/);assert.equal(t.calls.upload,0);});
test('reserva activa del supervisor evita descarga y reintento',()=>{let t=fixture();t.cache.set('file1',{fingerprint:fp(t.file),sha256:digest(t.bytes),terminal:false});t.setReceipt({status:'received',lease_active:true});scan(t.io);assert.deepEqual(t.calls,{download:0,upload:0,retry:0});});
test('pendiente sin reserva usa retry existente sin segunda descarga',()=>{let t=fixture();t.cache.set('file1',{fingerprint:fp(t.file),sha256:digest(t.bytes),terminal:false});t.setReceipt({status:'received',lease_active:false});scan(t.io);assert.equal(t.calls.download,0);assert.equal(t.calls.retry,1);});
test('receptor ocupado no confirma caché',()=>{let t=fixture();t.io.upload=()=>({busy:true});scan(t.io);assert.equal(t.cache.size,0);});
test('202 recibido no es publicación',()=>{let t=fixture();scan(t.io);assert.equal(t.cache.get('file1').terminal,false);});
test('acuse de otro SHA se rechaza',()=>{let t=fixture();t.io.upload=()=>({received:true,sha256:'a'.repeat(64)});assert.throws(()=>scan(t.io),/RECEIPT_IDENTITY/);assert.equal(t.cache.size,0);});
test('dos candidatos usan un único espacio de recepción',()=>{let t=fixture();t.io.list=()=>[t.file,{...t.file,id:'file2'}];scan(t.io);assert.equal(t.calls.upload,1);});
test('modo observación no envía archivos',()=>{let t=fixture();t.io.mode='OBSERVE';scan(t.io);assert.equal(t.calls.download,1);assert.equal(t.calls.upload,0);});
test('propietario distinto se excluye',()=>{let t=fixture();t.file.owners=[{emailAddress:'other@example.org'}];scan(t.io);assert.equal(t.calls.download,0);});
test('nombre genérico no requiere alterar el reporte',()=>{let t=fixture();scan(t.io);assert.equal(t.calls.upload,1);assert.equal(t.file.name,'Reporte-Inventario.xlsx');});
test('original fuera de carpeta se excluye',()=>{let t=fixture();t.file.parents=['other'];scan(t.io);assert.equal(t.calls.download,0);});
test('estado canónico inaccesible impide envío',()=>{let t=fixture();t.setPublished(null);assert.throws(()=>scan(t.io),/CANONICAL_SHA/);assert.equal(t.calls.upload,0);});
console.log(JSON.stringify({tests,passed:tests,synthetic:true,remote_execution:false}));
