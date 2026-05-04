import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFolders = ['tests/unit', 'tests/integration'];
const failures = [];

for (const folder of requiredFolders) {
  const fullPath = path.join(root, folder);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing test folder: ${folder}`);
    continue;
  }
  const testFiles = fs.readdirSync(fullPath).filter((f) => f.endsWith('.test.ts'));
  if (testFiles.length === 0) {
    failures.push(`No test files found in ${folder}`);
  }
}

if (failures.length > 0) {
  console.error('Test harness validation failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Test harness validation passed.');
