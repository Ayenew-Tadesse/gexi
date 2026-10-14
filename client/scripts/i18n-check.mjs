// Checks translations:
//  1. every text key used in the code exists in English (en.json)
//  2. lists Amharic (am.json) keys that still need translating
// Run from the project folder:  npm run i18n:check
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const en = JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales/en.json'), 'utf8'));
const am = JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales/am.json'), 'utf8'));

const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const enKeys = new Set(flatten(en));
const amKeys = new Set(flatten(am));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    (d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(jsx?|tsx?)$/.test(d.name) ? [path.join(dir, d.name)] : []));
}
const used = new Set();
for (const file of walk(root)) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]);
}

const missingEn = [...used].filter((k) => !enKeys.has(k) && !enKeys.has(`${k}_one`));
const missingAm = [...enKeys].filter((k) => !amKeys.has(k));

console.log(`English: ${enKeys.size} texts. Amharic: ${enKeys.size - missingAm.length} translated, ${missingAm.length} still in English.`);
if (missingEn.length) {
  console.log('\n❌ Used in the code but missing from en.json:');
  missingEn.forEach((k) => console.log('  ', k));
  process.exitCode = 1;
} else {
  console.log('✅ Every text used in the code exists in en.json.');
}
if (process.argv.includes('--list')) {
  console.log('\nNot yet translated to Amharic:');
  missingAm.forEach((k) => console.log('  ', k));
} else {
  console.log('Add --list to see the untranslated Amharic keys:  npm run i18n:check -- --list');
}
