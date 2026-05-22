// Applique UNE seule migration SQL via la Management API Supabase.
//
//   SUPABASE_PAT=... SUPABASE_PROJECT_REF=... \
//     node scripts/apply-one-migration.mjs 20260523010000_wc_news.sql
//
// Plus sûr que apply-migrations.mjs quand on ne veut rejouer qu'un fichier.

import fs from 'node:fs';
import path from 'node:path';

const PAT = process.env.SUPABASE_PAT;
const REF = process.env.SUPABASE_PROJECT_REF;
const file = process.argv[2];

if (!PAT || !REF || !file) {
  console.error(
    'Usage: SUPABASE_PAT=... SUPABASE_PROJECT_REF=... node scripts/apply-one-migration.mjs <fichier.sql>',
  );
  process.exit(1);
}

const fullPath = path.join('supabase/migrations', file);
if (!fs.existsSync(fullPath)) {
  console.error(`Fichier introuvable : ${fullPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');
process.stdout.write(`▶ ${file} ... `);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
}
console.log(`OK (HTTP ${res.status})`);
console.log('✅ Migration appliquée.');
