// One-shot script : ajoute timeZone: 'Europe/Paris' aux Intl.DateTimeFormat
// qui ne l'ont pas. Évite de patcher manuellement 30+ fichiers.
//
// Usage : node scripts/patch-timezone.mjs

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'public', 'scripts']);
const EXTENSIONS = ['.ts', '.tsx'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}

const PATTERN = /new Intl\.DateTimeFormat\(([^)]*?)\{([^}]*?)\}/g;

let totalPatched = 0;
let totalAlready = 0;
let filesPatched = 0;

for (const file of walk(ROOT)) {
  const orig = readFileSync(file, 'utf-8');
  if (!orig.includes('Intl.DateTimeFormat')) continue;

  const patched = orig.replace(PATTERN, (match, locale, options) => {
    if (options.includes('timeZone')) {
      totalAlready++;
      return match;
    }
    totalPatched++;
    // Ajoute timeZone juste avant la } fermante
    const trimmed = options.replace(/\s+$/, '');
    const needsComma = trimmed.length > 0 && !trimmed.endsWith(',');
    const sep = needsComma ? ',' : '';
    return `new Intl.DateTimeFormat(${locale}{${trimmed}${sep}\n  timeZone: 'Europe/Paris',\n}`;
  });

  if (patched !== orig) {
    writeFileSync(file, patched);
    filesPatched++;
    console.log(`✓ ${file.replace(ROOT, '')}`);
  }
}

console.log(`\n${filesPatched} fichiers patchés · ${totalPatched} formatters mis à jour · ${totalAlready} déjà OK`);
