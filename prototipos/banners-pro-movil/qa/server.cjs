// Sólo pruebas locales. No es autenticación ni servidor de producción.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..'),fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures.json')));
const pdfs=JSON.parse(fs.readFileSync(path.join(__dirname,'pdf-fixtures.json')));
const state={revision:1,assetReads:0};
function library(){return {mode:'qa-local',date:'2026-10-26',products:fixtures.map(p=>({...p,filename:p.sku+'-SIGNATURE.png',version:state.revision,updatedAt:'2026-10-26T22:30:00Z',path:undefined})),pdfs:pdfs.map(p=>({...p,version:state.revision,path:undefined}))};}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 function reply(status,data,type='application/json'){res.writeHead(status,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(data):data);}
 if(req.url==='/__qa_login'){res.setHeader('Set-Cookie','qa-session=local-only; HttpOnly; SameSite=Strict; Path=/');return reply(200,{qa:true});}
 if(!req.headers.cookie?.split(';').some(v=>v.trim()==='qa-session=local-only'))return reply(403,{error:'Acceso privado — prueba local'});
 if(req.url==='/')return reply(200,fs.readFileSync(path.join(base,'Index.html')),'text/html; charset=utf-8');
 if(req.method!=='POST')return reply(404,{error:'No encontrado'});
 let raw='';for await(const part of req){raw+=part;if(raw.length>4096)return reply(413,{error:'Solicitud demasiado grande'});}let args;try{args=JSON.parse(raw||'[]')}catch{return reply(400,{error:'JSON inválido'});}
 if(req.url==='/api/getLibrary')return reply(200,library());
 if(req.url==='/__qa_change_version'){state.revision++;return reply(200,state);}
 if(req.url==='/api/getAsset'||req.url==='/api/validateAsset'){
  const row=[...fixtures,...pdfs].find(p=>p.driveId===args[0]);if(!row)return reply(403,{error:'Archivo no autorizado'});
  if(args[1]!==state.revision)return reply(409,{error:'VERSION_CAMBIO'});
  const b=fs.readFileSync(row.path),sha=crypto.createHash('sha256').update(b).digest('hex');
  if(sha!==row.sha256)return reply(409,{error:'SHA256 no coincide'});if(req.url==='/api/validateAsset')return reply(200,{...row,path:undefined,version:state.revision});state.assetReads++;
  return reply(200,{id:row.driveId,version:state.revision,filename:row.filename||(row.sku+'-SIGNATURE.png'),mime:row.mime||'image/png',sha256:sha,base64:b.toString('base64')});
 }
 return reply(404,{error:'No encontrado'});
});
server.listen(Number(process.env.BANNERS_PRO_QA_PORT||0),'127.0.0.1',()=>console.log(JSON.stringify({qa_local:true,url:'http://127.0.0.1:'+server.address().port,pid:process.pid})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
