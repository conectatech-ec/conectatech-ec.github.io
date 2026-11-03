// Internal QA only. No deployment, cloud mutation, external order or payment.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createCheckout,createCatalogProvider,createFileLedger,TEST_DELIVERIES} from './servidor/motor.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const require=createRequire(import.meta.url),links=require('../scripts/compra-enlaces.cjs');
const ledgerFile=path.join(os.tmpdir(),'conectatech-compra-'+path.basename(path.dirname(root)),'pedidos-prueba.json');
const provider=createCatalogProvider(root);
const checkout=createCheckout({catalogProvider:provider,ledger:createFileLedger(ledgerFile,{repoRoot:root}),deliveries:TEST_DELIVERIES,mode:'test'});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function body(req){let str='';for await(const chunk of req){str+=chunk;if(Buffer.byteLength(str)>8192)throw Object.assign(Error('PAYLOAD_SIZE'),{status:413});}try{return JSON.parse(str);}catch{throw Object.assign(Error('INVALID_JSON'),{status:400});}}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://localhost');
    res.setHeader('X-Robots-Tag','noindex,nofollow');res.setHeader('Referrer-Policy','no-referrer');
    if(u.pathname.startsWith('/api/compra/')){
      if(req.method==='GET'&&u.pathname==='/api/compra/catalogo')return json(res,200,await checkout.catalog());
      if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON_REQUIRED'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'ORIGIN_REJECTED'});
      if(req.headers.origin){const originHost=new URL(req.headers.origin).host;const hosts=[req.headers.host,req.headers['x-forwarded-host']].filter(Boolean);if(!hosts.includes(originHost))return json(res,403,{error:'ORIGIN_REJECTED'});}
      const input=await body(req);
      if(u.pathname==='/api/compra/cotizacion')return json(res,200,await checkout.quote(input));
      if(u.pathname==='/api/compra/pedidos')return json(res,201,await checkout.confirm(input,req.headers['idempotency-key']));
      return json(res,404,{error:'NOT_FOUND'});
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'METHOD_NOT_ALLOWED'});
    let pathname=decodeURIComponent(u.pathname);
    if(pathname.includes('..')||pathname.includes('\\')||pathname.includes('\0'))return json(res,404,{error:'NOT_FOUND'});
    if(pathname.endsWith('/'))pathname+='index.html';
    const permitted=['/index.html','/logo-conectatech.png','/compra/index.html','/compra/compra.css','/compra/compra.js','/compra/privacidad.html','/cambios-devoluciones-garantias/index.html'];
    if(!permitted.includes(pathname)&&!/^\/(assets|imagenes|productos)\/[a-zA-Z0-9_./-]+\.(html|js|css|png|webp|jpg|svg)$/.test(pathname))return json(res,404,{error:'NOT_FOUND'});
    if(pathname.split('/').some(s=>s.startsWith('.')))return json(res,404,{error:'NOT_FOUND'});
    const file=path.join(root,pathname);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'NOT_FOUND'});
    const real=fs.realpathSync(file);if(!real.startsWith(root+path.sep))return json(res,404,{error:'NOT_FOUND'});
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method==='HEAD')return res.end();
    if(path.extname(file)==='.html'){
      let html=fs.readFileSync(file,'utf8');
      if(pathname.startsWith('/productos/')){const c=await provider(),p=c.products.find(p=>new URL(p.url,'http://localhost').pathname===u.pathname);html=links(html,p,{enabled:true});}
      if(pathname==='/index.html')html=html.replace('</body>','<p style="text-align:center;padding:18px"><a href="/compra/">Probar compra directa</a> · <a href="/cambios-devoluciones-garantias/">Devoluciones y garantías</a></p></body>');
      return res.end(html);
    }
    fs.createReadStream(file).pipe(res);
  }catch(error){json(res,error.status||503,{error:error.code||'SERVICE_UNAVAILABLE'});}
});
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:(process.env.PORT||3000));
server.listen(port,'0.0.0.0',()=>console.log('Compra de prueba preparada; sin servicios externos.'));
