import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenMarkers = [/\bTODO\b/i, /\bFIXME\b/i, /\bTBD\b/i, /placeholder/i, /dummy/i];
const scanRoots = ['src', 'tests', 'tools'];
const allowedFiles = new Set(['tools/linters/check-quality.mjs']);
const failures = [];

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return [fullPath];
  });
}

for (const scanRoot of scanRoots) {
  for (const filePath of walk(path.join(root, scanRoot))) {
    const relative = path.relative(root, filePath).replaceAll('\\', '/');
    if (allowedFiles.has(relative)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const marker of forbiddenMarkers) {
      if (marker.test(content)) {
        failures.push(`${relative} contains forbidden marker ${marker}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Quality content lint failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Quality content lint passed.');
