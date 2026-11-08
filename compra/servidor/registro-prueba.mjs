import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Test-only order journal, outside the checkout and outside any static directory.
// There is no inventory table: pending quantities are derived from saved test orders.
export function createFileLedger(filename, {repoRoot} = {}) {
  if (!repoRoot || !path.isAbsolute(filename)) throw Error('REGISTRO_PRIVADO_REQUERIDO');
  filename = path.resolve(filename);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, filename);
  if (!rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) {
    throw Error('REGISTRO_NO_PUEDE_ESTAR_EN_REPOSITORIO');
  }
  let queue = Promise.resolve();
  return {
    mode: 'test',
    transaction(fn) {
      const task = queue.then(async () => {
        await fs.mkdir(path.dirname(filename), {recursive: true, mode: 0o700});
        const parent = await fs.realpath(path.dirname(filename));
        const realRoot = await fs.realpath(root);
        const relative = path.relative(realRoot, parent);
        if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
          throw Error('REGISTRO_NO_PUEDE_ESTAR_EN_REPOSITORIO');
        }
        const lockName = filename + '.lock';
        let lock;
        try { lock = await fs.open(lockName, 'wx', 0o600); }
        catch (error) { if (error.code === 'EEXIST') throw Error('REGISTRO_OCUPADO_REINTENTAR'); throw error; }
        let temp;
        try {
          let state = {schema: 'conectatech.test-orders.v1', orders: []};
          try {
            const st = await fs.lstat(filename);
            if (!st.isFile() || st.isSymbolicLink() || st.size > 10_000_000) throw Error('REGISTRO_INVALIDO');
            state = JSON.parse(await fs.readFile(filename, 'utf8'));
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
          if (state.schema !== 'conectatech.test-orders.v1' || !Array.isArray(state.orders)) throw Error('REGISTRO_INVALIDO');
          const result = await fn(state.orders);
          temp = filename + '.' + randomUUID() + '.tmp';
          const handle = await fs.open(temp, 'wx', 0o600);
          try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); }
          finally { await handle.close(); }
          await fs.rename(temp, filename); temp = undefined;
          const dir = await fs.open(parent, 'r');
          try { await dir.sync(); } finally { await dir.close(); }
          return result;
        } finally {
          if (temp) await fs.unlink(temp).catch(() => {});
          await lock.close(); await fs.unlink(lockName);
        }
      });
      queue = task.catch(() => {});
      return task;
    }
  };
}
