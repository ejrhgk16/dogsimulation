import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export const stamp = (d = new Date()) => {
  const p = Object.fromEntries(FMT.formatToParts(d).map(x => [x.type, x.value]));
  return [p.year, '-', p.month, '-', p.day, 'T', p.hour, ':', p.minute, ':', p.second, '+0900'].join('');
};
const rj = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const wj = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');

function resolvePlan(rootDir, given) {
  if (given) return given;
  const top = rj(path.join(rootDir, 'docs', 'plans', 'index.json'));
  const plan = top.plans.find(p => p.status !== 'completed') ?? top.plans[0];
  if (!plan?.dir) throw new Error('실행할 plan이 없습니다.');
  return plan.dir;
}

export function getPlanSummary(rootDir, planDir) {
  const dir = resolvePlan(rootDir, planDir);
  const planIdx = rj(path.join(rootDir, 'docs', 'plans', dir, 'index.json'));
  const tasks = planIdx.tasks || [];
  return { planDir: dir, planStatus: planIdx.status ?? 'pending', tasks };
}

export function buildStatusText(s) {
  return [
    `Plan: ${s.planDir} (${s.planStatus})`,
    ...s.tasks.map(t => `  ${t.name}: ${t.status}`)
  ].join('\n');
}

function sec(t, l) { return [`=== ${t} ===`, ...l].join('\n'); }

export function buildNextAction(s) {
  if (s.planStatus === 'completed') return { kind: 'done', message: `${s.planDir} 완료.` };
  const failed = s.tasks.find(t => t.status === 'error');
  if (failed) return { kind: 'error', message: `Task ${failed.name} 실패.\n${failed.error_message ?? 'unknown'}` };
  const task = s.tasks.find(t => t.status !== 'completed');
  if (!task) return { kind: 'done', message: `${s.planDir} 모든 task 완료.` };
  return {
    kind: 'delegate', agent: 'Worker', taskName: task.name,
    prompt: [
      `docs/plans/${s.planDir}/index.json 에서 이전 task 완료 요약을 확인한 후,`,
      `docs/plans/${s.planDir}/${task.name}.md 를 읽고 실행해줘.`,
      '완료 후 아래 형식으로만 응답해.',
      'Task 완료', 'summary: {한 줄 요약}',
      '또는',
      'Task 실패', 'error_message: {구체적 오류 내용}'
    ].join('\n')
  };
}

function syncPlanTop(topIdx, planDir, planIdx, now) {
  const plan = topIdx.plans.find(p => p.dir === planDir);
  if (!plan) throw new Error(`Plan not found: ${planDir}`);
  const tasks = planIdx.tasks || [];
  if (tasks.every(t => t.status === 'completed')) { plan.status = 'completed'; plan.completed_at = now; planIdx.status = 'completed'; planIdx.completed_at = now; }
  else if (tasks.some(t => t.status === 'error')) { plan.status = 'error'; plan.failed_at = now; planIdx.status = 'error'; planIdx.failed_at = now; }
  else { plan.status = 'pending'; planIdx.status = 'pending'; }
}

function updateTask(rootDir, planDir, taskName, fn) {
  const s = getPlanSummary(rootDir, planDir);
  const topIdx = rj(path.join(rootDir, 'docs', 'plans', 'index.json'));
  const planIdx = rj(path.join(rootDir, 'docs', 'plans', s.planDir, 'index.json'));
  const task = (planIdx.tasks || []).find(t => t.name === taskName);
  if (!task) throw new Error(`Task ${taskName} not found in ${s.planDir}`);
  const now = stamp();
  fn(task, planIdx, now);
  syncPlanTop(topIdx, s.planDir, planIdx, now);
  wj(path.join(rootDir, 'docs', 'plans', s.planDir, 'index.json'), planIdx);
  wj(path.join(rootDir, 'docs', 'plans', 'index.json'), topIdx);
  return { summary: getPlanSummary(rootDir, s.planDir) };
}

export function markCompleted(rootDir, planDir, taskName, msg) {
  if (!msg) throw new Error('--summary 필요');
  return updateTask(rootDir, planDir, taskName, (task, planIdx, now) => {
    task.status = 'completed'; task.summary = msg; task.completed_at = now;
    delete task.error_message; delete task.failed_at;
  });
}

export function markFailed(rootDir, planDir, taskName, msg) {
  if (!msg) throw new Error('--message 필요');
  return updateTask(rootDir, planDir, taskName, (task, planIdx, now) => {
    task.status = 'error'; task.error_message = msg; task.failed_at = now;
    delete task.summary; delete task.completed_at;
  });
}

export function resetTask(rootDir, planDir, taskName) {
  return updateTask(rootDir, planDir, taskName, (task) => {
    task.status = 'pending';
    delete task.summary; delete task.error_message; delete task.completed_at; delete task.failed_at;
  });
}

export function runCli(argv, opts = {}) {
  const rootDir = opts.rootDir ?? ROOT;
  const out = opts.stdout ?? process.stdout;
  const err = opts.stderr ?? process.stderr;
  const w = s => out.write(s + '\n');
  const ws = (t, c) => w(sec(t, c.split('\n')));

  try {
    const [cmd, ...rest] = argv;
    const parsed = parseArgs({ args: cmd?.startsWith('--') ? argv : rest, allowPositionals: true,
      options: { summary: { type: 'string' }, message: { type: 'string' }, help: { type: 'boolean', default: false } }
    });

    if (!cmd || parsed.values.help) {
      w('Usage: npm run harness -- <command> [args]');
      w('Commands:');
      w('  status [plan-dir]');
      w('  next [plan-dir]');
      w('  complete <plan-dir> <task-name> --summary "..."');
      w('  fail <plan-dir> <task-name> --message "..."');
      w('  reset <plan-dir> <task-name>');
      return 0;
    }

    if (cmd === 'status') {
      ws('HARNESS STATUS', buildStatusText(getPlanSummary(rootDir, parsed.positionals[0])));
      return 0;
    }

    if (cmd === 'next') {
      const s = getPlanSummary(rootDir, parsed.positionals[0]);
      const a = buildNextAction(s);
      ws('HARNESS STATUS', buildStatusText(s));
      w('');
      if (a.kind === 'delegate') ws('NEXT ACTION', `Agent: ${a.agent}\nTask: ${a.taskName}\nPrompt:\n${a.prompt}`);
      else ws('NEXT ACTION', a.message);
      return a.kind === 'error' ? 2 : 0;
    }

    const planDir = parsed.positionals[0];
    const taskName = parsed.positionals[1];
    if (!planDir) throw new Error('plan-dir 필요');
    if (!taskName) throw new Error('task-name 필요');

    let r;
    if (cmd === 'complete') r = markCompleted(rootDir, planDir, taskName, parsed.values.summary);
    else if (cmd === 'fail') r = markFailed(rootDir, planDir, taskName, parsed.values.message);
    else if (cmd === 'reset') r = resetTask(rootDir, planDir, taskName);
    else throw new Error(`Unknown: ${cmd}`);

    ws('HARNESS STATUS', buildStatusText(r.summary));
    return 0;
  } catch (e) {
    w(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = runCli(process.argv.slice(2));
