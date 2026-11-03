// Ephemeral test adapter ONLY; never mount in a production host.
import {readFileSync} from 'node:fs';
export const snapshot=JSON.parse(readFileSync(new URL('../../pilot/products-validation.json',import.meta.url)));
export const clock=()=>Date.parse('2026-11-03T12:00:00Z');
export const admin={id:'TEST_ADMIN',role:'ADMINISTRADOR',verified:true};
export const rafa={id:'TEST_RAFA',role:'COLABORADOR',memberId:'COL001',verified:true};
export const second={id:'TEST_SECOND',role:'COLABORADOR',memberId:'COL002',verified:true};
export function fixture(){
 const db={ads:new Map(),references:new Map(),opportunities:new Map(),audit:[]};let lock=Promise.resolve();
 const members=[{id:'COL001',alias:'Rafa',operation:'EXISTING_RAFA_WORK',active:true},{id:'COL002',alias:'Reservado',operation:'PREPARE_FOR_REVIEW',active:false}],products=structuredClone(snapshot.products),sales=new Map();
 const host={validationOnly:true,referralSecret:crypto.randomUUID()+crypto.randomUUID(),authorizedAlexChannels:[],async roster(){return structuredClone(members);},async catalogProduct(sku){return structuredClone(products[sku]||null);},async readConfirmed593Sale(id){return structuredClone(sales.get(id)||null);},async transaction(fn){const prior=lock;let release;lock=new Promise(r=>{release=r;});await prior;const backup=structuredClone(db);try{return await fn({async get(t,id){return structuredClone(db[t].get(id)||null);},async list(t){return structuredClone([...db[t].values()]);},async put(t,id,v){db[t].set(id,structuredClone(v));},async audit(v){db.audit.push(structuredClone(v));}});}catch(e){for(const k of Object.keys(db))db[k]=backup[k];throw e;}finally{release();}}};return {host,db,members,products,sales};
}
