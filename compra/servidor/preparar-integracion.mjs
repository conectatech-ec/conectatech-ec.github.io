import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {CHECKOUT_CONFIG} from './checkout-config.mjs';

export const BASE_SHA = '747291490f6cd836ec06d14dcb252e53a8a5e02d';
const sourceDir = import.meta.dirname;
const root = path.resolve(sourceDir, '../..');
const modules = ['checkout-config.mjs', 'checkout-core.mjs', 'checkout-edge.mjs', 'checkout-shared-source.mjs', 'checkout-store.mjs', 'checkout-entry.mjs'];
const affected = ['automatizacion/worker.mjs', 'automatizacion/messenger-store.mjs', 'automatizacion/deploy_free.py'];
const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 2000000});
function once(text, before, after) {
  if (text.split(before).length !== 2) throw Error('INTEGRATION_ANCHOR_CHANGED');
  return text.replace(before, after);
}
export function preparedIntegration() {
  if (CHECKOUT_CONFIG.enabled !== false || CHECKOUT_CONFIG.deliveries.length || CHECKOUT_CONFIG.nationalShippingEnabled !== false) throw Error('PREPARATION_MUST_REMAIN_DISABLED');
  const baseline = Object.fromEntries(affected.map(file => [file, git(['show', BASE_SHA + ':' + file])]));
  const files = {...baseline};
  files[affected[0]] = once(files[affected[0]], "import {central} from './central-source.mjs';", "import {handleCheckoutPublic,handleCheckoutAdmin} from './checkout-entry.mjs';\nimport {central} from './central-source.mjs';");
  files[affected[0]] = once(files[affected[0]], "  const path=new URL(req.url).pathname;", "  const path=new URL(req.url).pathname;\n  const checkoutPublic=await handleCheckoutPublic(req,env);if(checkoutPublic)return checkoutPublic;");
  files[affected[0]] = once(files[affected[0]], "  if(!await authorized(req,env)) return json({error:'Unauthorized'},401);", "  if(!await authorized(req,env)) return json({error:'Unauthorized'},401);\n  const checkoutAdmin=await handleCheckoutAdmin(req,env);if(checkoutAdmin)return checkoutAdmin;");
  files[affected[1]] = "import {initCheckoutStore,handleCheckoutStore} from './checkout-entry.mjs';\n" + files[affected[1]];
  files[affected[1]] = once(files[affected[1]], '  controlInit(this);sellerInit(this);alexInit(this);commercialInit(this);', '  controlInit(this);sellerInit(this);alexInit(this);commercialInit(this);initCheckoutStore(this);');
  files[affected[1]] = once(files[affected[1]], '  this.cleanup(Date.now());', '  this.cleanup(Date.now());\n  const checkout=await handleCheckoutStore(path,req,this);if(checkout)return checkout;');
  files[affected[2]] = once(files[affected[2]], "    for name in ['worker.mjs'", "    for name in [" + modules.map(v => "'" + v + "'").join(',') + ",'worker.mjs'");
  for (const file of modules) files['automatizacion/' + file] = fs.readFileSync(path.join(sourceDir, file), 'utf8');
  return {baseline, files};
}
export function verifyTarget(target, baseline) {
  const branch = execFileSync('git', ['branch', '--show-current'], {cwd: target, encoding: 'utf8'}).trim();
  if (!branch || branch === 'main') throw Error('INDEPENDENT_BRANCH_REQUIRED');
  for (const [file, expected] of Object.entries(baseline)) {
    if (sha(fs.readFileSync(path.join(target, file))) !== sha(expected)) throw Error('TARGET_SOURCE_CHANGED:' + file);
  }
  for (const file of modules) if (fs.existsSync(path.join(target, 'automatizacion', file))) throw Error('TARGET_CHECKOUT_MODULE_EXISTS:' + file);
}
export function writePatch(destination = path.join(sourceDir, 'datahub-integracion.patch')) {
  const {baseline, files} = preparedIntegration();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-checkout-patch-'));
  try {
    execFileSync('git', ['init', '-q'], {cwd: temp});
    for (const [file, text] of Object.entries(baseline)) { fs.mkdirSync(path.dirname(path.join(temp, file)), {recursive: true}); fs.writeFileSync(path.join(temp, file), text); }
    execFileSync('git', ['add', '.'], {cwd: temp});
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(temp, file), text);
    execFileSync('git', ['add', '-N', '.'], {cwd: temp});
    const patch = execFileSync('git', ['diff', '--no-ext-diff', '--binary'], {cwd: temp, encoding: 'utf8', maxBuffer: 500000});
    fs.writeFileSync(destination, patch);
    fs.writeFileSync(path.join(sourceDir, 'datahub-integracion-manifiesto.json'), JSON.stringify({baseSha: BASE_SHA,
      deploymentPerformed: false, enabled: false, existingBinding: 'MESSENGER_TEST_INBOX', existingObjectName: 'messenger-development',
      baseline: Object.fromEntries(Object.entries(baseline).map(([file, text]) => [file, sha(text)])),
      prepared: Object.fromEntries(Object.entries(files).map(([file, text]) => [file, sha(text)])), patchSha256: sha(patch)}, null, 2) + '\n');
    return destination;
  } finally { fs.rmSync(temp, {recursive: true, force: true}); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const command = process.argv[2] || '--prepare';
  if (command === '--prepare') console.log(writePatch());
  else if (command === '--check' || command === '--apply-local') {
    const target = fs.realpathSync(process.argv[3]);
    const {baseline, files} = preparedIntegration(); verifyTarget(target, baseline);
    if (command === '--apply-local') for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(target, file), text);
    console.log(command === '--check' ? 'SOURCE_HASHES_VERIFIED' : 'LOCAL_SOURCE_PREPARED_NO_DEPLOYMENT');
  } else throw Error('USE_PREPARE_CHECK_OR_APPLY_LOCAL');
}
