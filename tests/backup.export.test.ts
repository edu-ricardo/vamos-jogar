import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { exportFirestore } from '../apps/api/scripts/backup/exportData';

// Projeto separado do teste de regras para não disputar os mesmos dados no emulador
let app: App;
let db: Firestore;

beforeAll(async () => {
  app = initializeApp({ projectId: 'demo-vamos-jogar-backup' }, 'backup-test');
  db = getFirestore(app);
  // Como em produção: users/{uid} não existe, só a subcoleção da ludoteca
  await db.doc('users/bia/collection/ludo-1').set({ name: 'Catan', minPlayers: 3 });
  await db.doc('users/bia/favoriteLocations/f1').set({ name: 'Casa', address: 'Rua X' });
  await db.doc('groups/g1').set({ name: 'Grupo', members: ['bia'] });
  await db.doc('groups/g1/events/e1').set({
    title: 'Jogatina',
    createdAt: Timestamp.fromDate(new Date('2026-10-03T12:00:00Z')),
  });
});

afterAll(async () => {
  await db.recursiveDelete(db.collection('users'));
  await db.recursiveDelete(db.collection('groups'));
  await deleteApp(app);
});

describe('exportFirestore', () => {
  it('inclui a ludoteca mesmo sem documento do usuário', async () => {
    const docs = await exportFirestore(db);
    const game = docs.find((d) => d.path === 'users/bia/collection/ludo-1');
    expect(game).toEqual({
      path: 'users/bia/collection/ludo-1',
      exists: true,
      data: { name: 'Catan', minPlayers: 3 },
    });
    expect(docs.find((d) => d.path === 'users/bia')?.exists).toBe(false);
  });

  it('exporta subcoleções de grupos com datas serializadas', async () => {
    const docs = await exportFirestore(db);
    expect(docs.map((d) => d.path).sort()).toEqual([
      'groups/g1',
      'groups/g1/events/e1',
      'users/bia',
      'users/bia/collection/ludo-1',
      'users/bia/favoriteLocations/f1',
    ]);
    expect(docs.find((d) => d.path === 'groups/g1/events/e1')?.data).toEqual({
      title: 'Jogatina',
      createdAt: { __type: 'timestamp', value: '2026-10-03T12:00:00.000Z' },
    });
  });
});
