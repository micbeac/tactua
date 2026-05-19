import fs from 'node:fs';
import path from 'node:path';

const PAT = process.env.SUPABASE_PAT;
const REF = process.env.SUPABASE_PROJECT_REF;
const MIGRATIONS_DIR = 'supabase/migrations';

if (!PAT || !REF) {
  console.error(
    'Usage: SUPABASE_PAT=... SUPABASE_PROJECT_REF=... node scripts/apply-migrations.mjs',
  );
  process.exit(1);
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Applying ${files.length} migrations to project ${REF}\n`);

for (const file of files) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
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
}

console.log('\n✅ Toutes les migrations ont été appliquées.');
