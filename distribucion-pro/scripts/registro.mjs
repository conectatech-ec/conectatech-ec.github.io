#!/usr/bin/env node
// Local/offline audit ledger only. Store its file outside the public repository.
import fs from 'node:fs';
import {transition,CHANNELS,metrics} from '../src/engine.mjs';
const [action,path,input]=process.argv.slice(2);
if(!['init','transition','metric','report'].includes(action)||!path){console.error('Uso: node scripts/registro.mjs init|transition|metric|report RUTA_PRIVADA_JSON [ENTRADA_JSON]');process.exit(2);}
let ledger=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{entries:[],observations:[]};
if(action==='init'){if(fs.existsSync(path))throw Error('No sobrescribir un registro existente');}
if(action==='transition'){
 const data=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!CHANNELS.includes(data.entry.channel)||!data.entry.sku)throw Error('Canal/SKU inválido');
 const index=ledger.entries.findIndex(e=>e.sku===data.entry.sku&&e.channel===data.entry.channel);
 const prior=index>=0?ledger.entries[index]:data.entry;
 if(index<0&&prior.state!=='PENDIENTE')throw Error('Nuevo registro debe comenzar PENDIENTE');
 const updated=transition(prior,data.next,data.context);
 if(index>=0)ledger.entries[index]=updated;else ledger.entries.push(updated);
}
if(action==='metric'){
 const observation=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!observation.id)throw Error('Falta identificador idempotente');
 metrics([observation]);if(ledger.observations.some(o=>o.id===observation.id))throw Error('Observación duplicada');ledger.observations.push(observation);
}
if(action==='report'){console.log(JSON.stringify({registered_publications:ledger.entries.filter(e=>e.state==='PUBLICADO').length,metrics:metrics(ledger.observations),by_channel:CHANNELS.map(channel=>({channel,records:ledger.entries.filter(e=>e.channel===channel).length,published:ledger.entries.filter(e=>e.channel===channel&&e.state==='PUBLICADO').length}))},null,2));}
else fs.writeFileSync(path,JSON.stringify(ledger,null,2)+'\n',{mode:0o600});
