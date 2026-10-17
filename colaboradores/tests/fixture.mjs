import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createApp,verifyAccess} from '../src/worker.mjs';
const schema=readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8');
export const editorial=JSON.parse(readFileSync(new URL('../data/piloto-editorial.json',import.meta.url)));
export const now=1800000000;
export function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(schema);
 function prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}};}
 const db={prepare,async batch(items){sql.exec('BEGIN');try{const result=[];for(const p of items)result.push(await p.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 for(const [id,role] of [['A','ADMINISTRADOR'],['C1','COLABORADOR'],['C2','COLABORADOR'],['S','SUPERVISOR']])sql.prepare('INSERT INTO members VALUES (?,?,?,1)').run(id,id,role);
 for(const p of editorial){sql.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?)').run(p.sku,JSON.stringify(p),10,12,1,now+86400,'verified-test');for(const id of ['A','C1','C2','S'])sql.prepare('INSERT INTO assignments VALUES (?,?)').run(id,p.sku);}
 const env={DB:db,DEPLOYMENT_ENABLED:'true',PUBLIC_ORIGIN:'https://pilot.example',REFERRAL_SECRET:'test-only-secret-not-for-deployment-1234567890',ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname)}};
 const app=createApp({verifyIdentity:async r=>{const s=r.headers.get('Test-Subject');if(!s)throw Object.assign(Error('No autenticado'),{status:401});return s;},now:()=>now});
 async function request(path,{method='GET',data,as='C1',origin='https://pilot.example',headers={}}={}){const h={'Test-Subject':as,Origin:origin,...headers};if(data)h['Content-Type']='application/json';const response=await app.fetch(new Request('https://pilot.example'+path,{method,headers:h,body:data?JSON.stringify(data):undefined}),env);return {status:response.status,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};}
 return {sql,env,request,app};
}
