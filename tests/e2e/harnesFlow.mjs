import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../../tools/scripts/execute.mjs';

const d = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
fs.mkdirSync(path.join(d, 'docs', 'plans', 'plan-1'), { recursive: true });
fs.writeFileSync(path.join(d, 'docs', 'plans', 'index.json'),
  JSON.stringify({ plans: [{ dir: 'plan-1', status: 'pending' }] }, null, 2));
fs.writeFileSync(path.join(d, 'docs', 'plans', 'plan-1', 'index.json'),
  JSON.stringify({
    plan: 'plan-1', status: 'pending',
    tasks: [
      { name: 'task-1-setup', status: 'pending' },
      { name: 'task-2-core', status: 'pending' }
    ]
  }, null, 2));

const so = () => { let o = ''; return { stdout: { write: v => { o += v } }, stderr: { write() {} }, out: () => o } };

const run = (cmd) => { const m = so(); runCli(cmd, { rootDir: d, ...m }); return m.out(); };

console.log('=== STATUS ===\n' + run(['status', 'plan-1']));
console.log('=== NEXT (pending) ===\n' + run(['next', 'plan-1']));
console.log('=== COMPLETE task-1 ===');
run(['complete', 'plan-1', 'task-1-setup', '--summary', 'Types done']);
console.log('=== NEXT (task-2) ===\n' + run(['next', 'plan-1']));
console.log('=== COMPLETE task-2 ===');
run(['complete', 'plan-1', 'task-2-core', '--summary', 'Core done']);
console.log('=== NEXT (plan done) ===\n' + run(['next', 'plan-1']));
console.log('=== FINAL STATUS ===\n' + run(['status', 'plan-1']));

console.log('=== FAIL TEST ===');
run(['fail', 'plan-1', 'task-2-core', '--message', 'broken']);
console.log('=== NEXT after fail ===\n' + run(['next', 'plan-1']));
console.log('=== RESET + retry ===');
run(['reset', 'plan-1', 'task-2-core']);
console.log('=== NEXT after reset ===\n' + run(['next', 'plan-1']));

fs.rmSync(d, { recursive: true, force: true });
console.log('ALL PASSED');
