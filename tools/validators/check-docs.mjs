import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = ['docs/ARCHITECTURE.md', 'docs/PRD.md', 'docs/ADR.md'];

const failures = [];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required file: ${relativePath}`);
  }
}

if (failures.length > 0) {
  console.error('Documentation validation failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Documentation validation passed.');
