import { execSync } from 'child_process';

function run(cmd) {
  const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  return result.trim();
}

function runWithOutput(cmd) {
  execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
}

const branch = run('git rev-parse --abbrev-ref HEAD');
if (branch === 'dev' || branch === 'main') {
  console.error(`error: cannot finish plan from '${branch}'`);
  process.exit(1);
}

function generateMessage() {
  const log = run('git log dev..HEAD --oneline --format="%s"');
  if (log) {
    const lines = log.split('\n').filter(Boolean);
    if (lines.length > 0) return lines[0];
  }
  const desc = branch.replace(/^plan-\d+-/, '').replace(/[-_]/g, ' ');
  return `feat: ${desc}`;
}

const msg = process.argv[2] || process.env.COMMIT_MESSAGE || generateMessage();

console.log(`\n=== finishing plan: ${branch} ===\n`);

try {
  console.log('=== formatting ===');
  runWithOutput('npm run format');

  runWithOutput('git add -A');
  runWithOutput(`git commit -m "${msg.replace(/"/g, '\\"')}"`);

  console.log('\n=== merging into dev ===\n');
  runWithOutput('git checkout dev');
  runWithOutput(`git merge ${branch} --no-edit`);

  console.log('\n=== pushing dev ===\n');
  runWithOutput('git push origin dev');

  console.log(`\n=== done: ${branch} merged into dev and pushed ===`);
} catch (e) {
  console.error(`\nfailed: ${e.message}`);
  process.exit(1);
}
