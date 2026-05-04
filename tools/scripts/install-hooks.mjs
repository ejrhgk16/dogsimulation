import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hooksDir = path.join(root, '.git', 'hooks');

if (!fs.existsSync(hooksDir)) {
  console.log('Skipping hook installation because .git/hooks does not exist.');
  process.exit(0);
}

const shHook = `#!/bin/sh
npm run verify
`;

const cmdHook = `@echo off\r\nnpm run verify\r\n`;

fs.writeFileSync(path.join(hooksDir, 'pre-commit'), shHook, 'utf8');
fs.writeFileSync(path.join(hooksDir, 'pre-commit.cmd'), cmdHook, 'utf8');

try {
  fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755);
} catch {
  // Windows can ignore chmod failures here.
}

console.log('Installed pre-commit hooks.');
