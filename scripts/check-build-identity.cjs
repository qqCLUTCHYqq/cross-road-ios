// service-worker.js CACHE is authoritative. Do not change its update algorithm.
// --write refreshes only the diagnostic mirror; default mode checks consistency.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../CrossRoad/Web');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cache = worker.match(/^const CACHE = '([^']+)';/m)?.[1];
const version = cache?.match(/-(v\d+)$/)?.[1];
if (!version) throw Error('Expected versioned service-worker CACHE; review build identity format.');
const expected = `export const DIAGNOSTIC_BUILD = '${version} / ${cache}';`;
const file = path.join(root, 'diagnostics.js');
const diagnostic = fs.readFileSync(file, 'utf8');
const line = /^export const DIAGNOSTIC_BUILD = '[^']+';/m;
if (!line.test(diagnostic)) throw Error('Diagnostic build mirror missing.');
if (process.argv.includes('--write')) fs.writeFileSync(file, diagnostic.replace(line, expected));
else if (diagnostic.match(line)[0] !== expected) throw Error('Diagnostic/cache identity differs; run with --write after an intentional CACHE change.');
console.log('Build identity consistent: ' + version + ' / ' + cache);
