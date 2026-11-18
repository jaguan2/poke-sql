import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/', import.meta.url));
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? sourceFiles(path.join(directory, entry.name))
    : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []))).flat();
}
const files = await sourceFiles(root);
const names = new Set(files);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const layer = file => relative(file).split('/')[0];
const feature = file => layer(file) === 'features' ? relative(file).split('/')[1] : undefined;
const graph = new Map(files.map(file => [file, []]));
const errors = [];

for (const file of files) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function inspect(node) {
    const declaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
    const dynamic = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const specifier = declaration ? node.moduleSpecifier : dynamic ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
      const candidate = path.resolve(path.dirname(file), specifier.text);
      const target = [candidate, ...['.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => candidate + suffix)].find(name => names.has(name));
      // CSS/JSON assets have no source dependency edges; Vite checks their paths.
      if (target) {
        const typeOnly = declaration && (node.isTypeOnly || node.importClause?.isTypeOnly
          || (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
            && !node.importClause.name && node.importClause.namedBindings.elements.length > 0
            && node.importClause.namedBindings.elements.every(item => item.isTypeOnly))
          || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0
            && node.exportClause.elements.every(item => item.isTypeOnly)));
        if (layer(file) === 'shared' && ['features', 'app'].includes(layer(target))) {
          errors.push(`${relative(file)} imports ${relative(target)}: shared code cannot depend on features or app.`);
        }
        if (layer(file) === 'features' && layer(target) === 'app') {
          errors.push(`${relative(file)} imports ${relative(target)}: features cannot depend on app orchestration.`);
        }
        if (feature(file) && feature(target) && feature(file) !== feature(target) && !typeOnly) {
          errors.push(`${relative(file)} imports ${relative(target)}: compose feature behavior in app; cross-feature contracts must be type-only.`);
        }
        if (!typeOnly) graph.get(file).push(target);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}

const visited = new Set();
const active = new Set();
function visit(file, chain = []) {
  if (active.has(file)) { errors.push(`Runtime import cycle: ${[...chain, file].map(relative).join(' -> ')}`); return; }
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file)) visit(target, [...chain, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of files) visit(file);
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Verified architecture boundaries and runtime import cycles across ${files.length} source files.`);
