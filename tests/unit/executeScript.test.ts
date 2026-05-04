import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildNextAction,
  getPlanSummary,
  markCompleted,
  markFailed,
  resetTask,
  runCli,
  stamp
} from '../../tools/scripts/execute.mjs';

const tmp: string[] = [];

function mk() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'h-'));
  tmp.push(d);
  fs.mkdirSync(path.join(d, 'docs', 'plans', 'plan-1'), { recursive: true });
  fs.writeFileSync(
    path.join(d, 'docs', 'plans', 'index.json'),
    JSON.stringify({ plans: [{ dir: 'plan-1', status: 'pending' }] }, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(d, 'docs', 'plans', 'plan-1', 'index.json'),
    JSON.stringify(
      {
        plan: 'plan-1',
        status: 'pending',
        tasks: [
          { name: 'task-1-setup', status: 'completed' },
          { name: 'task-2-core', status: 'pending' }
        ]
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(path.join(d, 'docs', 'plans', 'plan-1', 'task-2-core.md'), '# task core\n');
  return d;
}

afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('stamp', () => {
  it('KST', () => expect(stamp(new Date('2026-04-26T00:00:00Z'))).toBe('2026-04-26T09:00:00+0900'));
});

describe('getPlanSummary', () => {
  it('tasks', () => {
    const s = getPlanSummary(mk());
    expect(s.planDir).toBe('plan-1');
    expect(s.tasks[1].name).toBe('task-2-core');
    expect(s.tasks[1].status).toBe('pending');
  });
});

describe('buildNextAction', () => {
  it('Worker for pending', () => {
    const s = getPlanSummary(mk());
    expect(buildNextAction(s)).toEqual(
      expect.objectContaining({
        kind: 'delegate',
        agent: 'Worker',
        taskName: 'task-2-core'
      })
    );
  });
  it('error for failed', () => {
    const d = mk();
    markFailed(d, 'plan-1', 'task-2-core', 'fail');
    expect(buildNextAction(getPlanSummary(d))).toEqual({
      kind: 'error',
      message: 'Task task-2-core 실패.\nfail'
    });
  });
});

describe('transitions', () => {
  it('complete', () => {
    const d = mk();
    const r = markCompleted(d, 'plan-1', 'task-2-core', 'done');
    expect(r.summary.tasks[1].status).toBe('completed');
    expect(r.summary.planStatus).toBe('completed');
  });
  it('reset', () => {
    const d = mk();
    markFailed(d, 'plan-1', 'task-2-core', 'err');
    expect(resetTask(d, 'plan-1', 'task-2-core').summary.tasks[1].status).toBe('pending');
  });
});

describe('runCli', () => {
  const so = () => {
    let o = '';
    return {
      stdout: {
        write: (v: string) => {
          o += v;
        }
      },
      stderr: { write() {} },
      out: () => o
    };
  };
  it('next', () => {
    const d = mk(),
      m = so();
    expect(runCli(['next', 'plan-1'], { rootDir: d, ...m })).toBe(0);
    expect(m.out()).toContain('Agent: Worker');
  });
  it('complete', () => {
    const d = mk(),
      m = so();
    expect(
      runCli(['complete', 'plan-1', 'task-2-core', '--summary', 'ok'], { rootDir: d, ...m })
    ).toBe(0);
    expect(m.out()).toContain('task-2-core: completed');
  });
});
