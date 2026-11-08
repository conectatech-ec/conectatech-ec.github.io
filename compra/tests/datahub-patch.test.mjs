import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {preparedIntegration, verifyTarget} from '../servidor/preparar-integracion.mjs';

test('parche aplica exactamente sobre la base inspeccionada y rechaza Worker concurrente', t => {
  const {baseline, files} = preparedIntegration();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-patch-test-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  execFileSync('git', ['init', '-q', '-b', 'review-checkout'], {cwd: temp});
  for (const [file, text] of Object.entries(baseline)) { fs.mkdirSync(path.dirname(path.join(temp, file)), {recursive: true}); fs.writeFileSync(path.join(temp, file), text); }
  assert.doesNotThrow(() => verifyTarget(temp, baseline));
  const worker = path.join(temp, 'automatizacion/worker.mjs');
  fs.appendFileSync(worker, '\n// concurrent change\n');
  assert.throws(() => verifyTarget(temp, baseline), /TARGET_SOURCE_CHANGED/);
  fs.writeFileSync(worker, baseline['automatizacion/worker.mjs']);
  const patch = path.resolve(import.meta.dirname, '../servidor/datahub-integracion.patch');
  execFileSync('git', ['apply', '--check', patch], {cwd: temp});
  execFileSync('git', ['apply', patch], {cwd: temp});
  for (const [file, text] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(temp, file), 'utf8'), text, file);
  for (const file of Object.keys(files).filter(f => f.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', path.join(temp, file)]);
  execFileSync('python', ['-m', 'py_compile', path.join(temp, 'automatizacion/deploy_free.py')]);
  assert.throws(() => verifyTarget(temp, baseline), /TARGET_SOURCE_CHANGED/);
});

test('el instalador local rechaza main antes de escribir', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-main-gate-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  execFileSync('git', ['init', '-q', '-b', 'main'], {cwd: temp});
  assert.throws(() => verifyTarget(temp, {}), /INDEPENDENT_BRANCH_REQUIRED/);
});
