// Backup completo do Firestore e dos usuários do Firebase Auth em JSON.
// Uso: npm run backup --workspace=api [-- --out <pasta>]
// Credenciais: FIREBASE_SERVICE_ACCOUNT_KEY no apps/api/.env ou GOOGLE_APPLICATION_CREDENTIALS
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { db, auth } from '../../src/lib/firebase-admin';
import { exportAuthUsers, exportFirestore, summarizeBackup } from './exportData';

const outArgIndex = process.argv.indexOf('--out');
const outDir = resolve(
  outArgIndex > -1 ? process.argv[outArgIndex + 1] : join(__dirname, '../../../../backups'),
);

const main = async () => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  mkdirSync(outDir, { recursive: true });

  console.log('Exportando Firestore...');
  const documents = await exportFirestore(db);
  console.log('Exportando usuários do Auth...');
  const users = await exportAuthUsers(auth);

  const firestoreFile = join(outDir, `firestore-${stamp}.json`);
  const usersFile = join(outDir, `auth-users-${stamp}.json`);
  const exportedAt = new Date().toISOString();
  writeFileSync(firestoreFile, JSON.stringify({ exportedAt, documents }, null, 2));
  writeFileSync(usersFile, JSON.stringify({ exportedAt, users }, null, 2));

  const summary = summarizeBackup(documents);
  const emailByUid = new Map(users.map((u) => [u.uid, u.email || u.uid]));

  console.log(`\nArquivos gravados em ${outDir}`);
  console.log(`  ${firestoreFile}\n  ${usersFile}`);
  console.log(`\nUsuários no Auth: ${users.length}`);
  console.log('\nDocumentos por coleção:');
  for (const [collection, count] of Object.entries(summary.collections)) {
    console.log(`  ${collection}: ${count}`);
  }
  console.log('\nJogos por ludoteca (confira com a tela Ludoteca de cada um):');
  for (const [uid, count] of Object.entries(summary.gamesByUser)) {
    console.log(`  ${emailByUid.get(uid) || uid}: ${count}`);
  }
};

main().catch((err) => {
  console.error('Falha no backup:', err);
  process.exit(1);
});
