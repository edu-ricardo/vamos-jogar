// Importa um backup do Firebase no PocketBase e confere o resultado campo a campo.
// Uso: npm run migrate --workspace=api -- --firestore <firestore-*.json> --auth <auth-users-*.json>
//      [--exclude <e-mail>]... [--reset]
// Ambiente: PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD
import { readFileSync } from 'node:fs';
import PocketBase from 'pocketbase/cjs';
import { countAppRecords, importBackup, resetAppData } from './importBackup';
import { verifyImport } from './verifyImport';
import { excludeUsers } from './transform';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const allArgs = (name: string) =>
  process.argv.flatMap((value, i) => (process.argv[i - 1] === name ? [value] : []));

const main = async () => {
  const firestoreFile = arg('--firestore');
  const authFile = arg('--auth');
  if (!firestoreFile || !authFile) {
    throw new Error(
      'Informe --firestore <arquivo> e --auth <arquivo> (gerados por npm run backup)',
    );
  }
  const excluded = allArgs('--exclude');
  const backup = excludeUsers(
    {
      documents: JSON.parse(readFileSync(firestoreFile, 'utf8')).documents,
      users: JSON.parse(readFileSync(authFile, 'utf8')).users,
    },
    excluded,
  );
  if (excluded.length) console.log(`Contas deixadas de fora (--exclude): ${excluded.length}`);

  const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');
  pb.autoCancellation(false);
  await pb
    .collection('_superusers')
    .authWithPassword(process.env.PB_SUPERUSER_EMAIL!, process.env.PB_SUPERUSER_PASSWORD!);

  const existing = await countAppRecords(pb);
  if (existing > 0) {
    if (!process.argv.includes('--reset')) {
      throw new Error(
        `O PocketBase já tem ${existing} registros do app. Use --reset para apagá-los antes ` +
          '(só para ensaio; nunca no banco que já está em uso).',
      );
    }
    console.log(`Apagando ${existing} registros do app (--reset)...`);
    await resetAppData(pb);
  }

  console.log('Importando...');
  const report = await importBackup(pb, backup);
  console.log('\nRegistros criados:');
  for (const [collection, n] of Object.entries(report.counts)) console.log(`  ${collection}: ${n}`);
  if (report.warnings.length) {
    console.log('\nAvisos:');
    for (const w of report.warnings) console.log(`  - ${w}`);
  }

  console.log('\nConferindo com o backup...');
  const problems = await verifyImport(pb, backup);
  if (problems.length === 0) {
    console.log('Nenhuma divergência: o PocketBase está igual ao backup.');
  } else {
    console.log(`${problems.length} divergência(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error('Falha na migração:', err.message ?? err);
  process.exit(1);
});
