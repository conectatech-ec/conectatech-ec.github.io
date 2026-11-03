#!/usr/bin/env node
// Apply the proposed patch only to a disposable copy of the existing host.
import {mkdtempSync,cpSync,rmSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2),i=args.indexOf('--host-root'),hostRoot=i>=0&&args[i+1]?resolve(args[i+1]):null;
if(!hostRoot||!existsSync(join(hostRoot,'automatizacion/worker.mjs')))throw Error('EXISTING_HOST_SOURCE_REQUIRED');
const collaboratorRoot=fileURLToPath(new URL('..',import.meta.url));
const patch=join(collaboratorRoot,'integration/alex-host-review.patch');
const root=mkdtempSync(join(tmpdir(),'ct-existing-alex-'));
try{
 cpSync(join(hostRoot,'automatizacion'),join(root,'automatizacion'),{recursive:true});
 cpSync(collaboratorRoot,join(root,'colaboradores'),{recursive:true,filter:p=>!p.slice(collaboratorRoot.length).split('/').some(x=>['node_modules','__pycache__','work','.wrangler'].includes(x))});
 execFileSync('git',['apply','--check',patch],{cwd:root,stdio:'pipe'});
 execFileSync('git',['apply',patch],{cwd:root,stdio:'pipe'});
 execFileSync(process.execPath,['--check','automatizacion/worker.mjs'],{cwd:root,stdio:'pipe'});
 const output=execFileSync(process.execPath,['--test','--test-reporter=tap','automatizacion/tests/worker.test.mjs','colaboradores/tests/host-worker.compat.mjs'],{cwd:root,encoding:'utf8'});
 const tests=Number(output.match(/# tests (\d+)/)?.[1]||0),passed=Number(output.match(/# pass (\d+)/)?.[1]||0);
 if(!tests||tests!==passed)throw Error('EXISTING_HOST_TESTS_NOT_CONFIRMED');
 const result={mode:'TEMPORARY_SOURCE_OVERLAY_ONLY',patchAppliesCleanly:true,tests,passed,hostBranchModified:false,productionModified:false,newInfrastructure:false,operatorAuthenticationReused:true,collaboratorLoginEnabled:false,writesEnabled:false,messagesSent:0};
 writeFileSync(join(collaboratorRoot,'integration/host-compatibility-result.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{rmSync(root,{recursive:true,force:true});}
