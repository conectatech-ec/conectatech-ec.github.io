// Reuse automatizacion/schema.sql:eventos_canal in the existing DB binding.
// No CREATE/ALTER/DROP and no new database. Optional installation remains off.
export function existingEventsLedger(db,{encode,decode,clock=()=>Date.now(),retentionDays=7}={}){
 if(!db?.prepare||typeof encode!=='function'||typeof decode!=='function'||retentionDays<1||retentionDays>30)throw Error('EXISTING_LEDGER_BINDING');
 const id='ct:collaborators:pilot-v2',channel='collaborators';
 return async function transaction(fn){
  for(let attempt=0;attempt<4;attempt++){
   const old=await db.prepare('SELECT payload FROM eventos_canal WHERE id=? AND canal=?').bind(id,channel).first();
   const data=old?await decode(old.payload):{ads:{},references:{},opportunities:{},audit:[]};const cutoff=clock()-retentionDays*86400000;let dirty=false;
   const tx={async get(table,key){return structuredClone(data[table]?.[key]||null);},async list(table){return structuredClone(Object.values(data[table]||{}));},async put(table,key,value){if(!['ads','references','opportunities'].includes(table))throw Error('LEDGER_SCOPE');data[table][key]={...structuredClone(value),_store_updated_at:clock()};dirty=true;},async audit(value){data.audit.push({...structuredClone(value),at:clock()});dirty=true;}};
   // Callback must be side-effect free except this transaction's staged writes.
   const result=await fn(tx);if(!dirty)return result;
   for(const table of ['ads','references','opportunities'])for(const [key,value] of Object.entries(data[table]))if((value._store_updated_at||0)<cutoff)delete data[table][key];data.audit=data.audit.filter(x=>x.at>=cutoff);
   if(Object.values(data.ads).length>1000||Object.values(data.references).length>3000||Object.values(data.opportunities).length>3000||data.audit.length>10000)throw Error('LEDGER_LIMIT');
   const payload=await encode(data);if(typeof payload!=='string'||payload.length>900000)throw Error('LEDGER_SIZE');const now=new Date(clock()).toISOString(),expires=new Date(clock()+retentionDays*86400000).toISOString();
   const written=old?await db.prepare('UPDATE eventos_canal SET payload=?,expires_at=? WHERE id=? AND canal=? AND payload=?').bind(payload,expires,id,channel,old.payload).run():await db.prepare('INSERT OR IGNORE INTO eventos_canal(id,canal,payload,created_at,expires_at) VALUES (?,?,?,?,?)').bind(id,channel,payload,now,expires).run();
   if(written.meta.changes===1)return result;
  }
  throw Error('EXISTING_LEDGER_CONCURRENT_CHANGE');
 };
}
