import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
if(config.alex_validation==='commercial_objections')await import('./alex-objections-e2e.mjs');
else if(config.alex_validation==='samsung_recovery')await import('./alex-samsung-e2e.mjs');
else if(config.alex_validation==='conversation_flow')await import('./alex-conversation-e2e.mjs');
else if(config.alex_validation==='targeted_regression')await import('./alex-targeted-e2e.mjs');
else if(!config.alex_validation||config.alex_validation==='conversation_24')await import('./alex-commercial-e2e.mjs');
else throw Error('Unknown validation scope');
