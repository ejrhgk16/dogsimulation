import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

const layerOrder = ['types', 'config', 'repository', 'services', 'runtime', 'ui'];
const allowedImports = {
  types: new Set(['types']),
  config: new Set(['types', 'config']),
  repository: new Set(['types', 'config', 'repository']),
  services: new Set(['types', 'config', 'repository', 'services']),
  runtime: new Set(['types', 'config', 'repository', 'services', 'runtime']),
  ui: new Set(['types', 'config', 'repository', 'services', 'runtime', 'ui'])
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}

function normalizeImport(resolvedPath) {
  const relative = path.relative(srcRoot, resolvedPath).replaceAll('\\', '/');
  return relative.replace(/\.ts$/, '');
}

function resolveImport(sourceFile, importPath) {
  if (!importPath.startsWith('.')) return null;
  const candidate = path.resolve(path.dirname(sourceFile), importPath);
  const withTs = `${candidate}.ts`;
  const withIndex = path.join(candidate, 'index.ts');
  if (fs.existsSync(withTs)) return withTs;
  if (fs.existsSync(withIndex)) return withIndex;
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

function fileLayer(filePath) {
  const segments = path.relative(srcRoot, filePath).split(path.sep);
  if (segments.length === 1) return 'ui';
  return segments[0];
}

function importsFor(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/from\s+['"](.+?)['"]/g)];
  return matches.map(m => m[1]).map(p => resolveImport(filePath, p)).filter(Boolean);
}

function detectCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function visit(node, trail) {
    if (visiting.has(node)) {
      const idx = trail.indexOf(node);
      cycles.push([...trail.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...trail, node]);
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node, []);
  return cycles;
}

const files = walk(srcRoot);
const graph = new Map();
const failures = [];

for (const file of files) {
  const layer = fileLayer(file);
  if (!layerOrder.includes(layer)) {
    failures.push(`Unknown layer for ${normalizeImport(file)}`);
    continue;
  }

  const resolvedImports = importsFor(file);
  graph.set(file, resolvedImports);

  for (const ri of resolvedImports) {
    const depLayer = fileLayer(ri);
    if (!allowedImports[layer].has(depLayer)) {
      failures.push(`${normalizeImport(file)} illegally imports ${normalizeImport(ri)} (${layer} ⇢ ${depLayer})`);
    }
  }
}

for (const cycle of detectCycles(graph)) {
  failures.push(`Circular dependency: ${cycle.map(normalizeImport).join(' → ')}`);
}

if (failures.length > 0) {
  console.error('Architecture validation failed.');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('Architecture validation passed.');
