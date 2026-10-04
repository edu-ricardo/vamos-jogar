import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

// Regras da virada (firestore.readonly.rules): tudo o que o app lê continua legível,
// nenhuma escrita passa. Cenário: grupo g1 com "ana" (admin) e "bia"; "duda" é de fora.
let env: RulesTestEnvironment;
const db = (uid: string) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vamos-jogar-readonly',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.readonly.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, 'groups/g1'), {
      name: 'G',
      adminId: 'ana',
      members: ['ana', 'bia'],
      inviteToken: 't',
    });
    await setDoc(doc(admin, 'groups/g1/members/bia'), { name: 'Bia' });
    await setDoc(doc(admin, 'groups/g1/events/e1'), {
      creatorId: 'bia',
      status: 'VOTING_DATE',
      votesDate: {},
    });
    await setDoc(doc(admin, 'users/bia/collection/ludo-1'), { name: 'Catan' });
    await setDoc(doc(admin, 'users/bia/favoriteLocations/f1'), { name: 'Casa' });
  });
});

describe('Firebase somente leitura', () => {
  it('as mesmas leituras de antes continuam funcionando', async () => {
    await assertSucceeds(
      getDocs(query(collection(db('bia'), 'groups'), where('members', 'array-contains', 'bia'))),
    );
    await assertSucceeds(getDocs(collection(db('bia'), 'groups/g1/members')));
    await assertSucceeds(getDoc(doc(db('bia'), 'groups/g1/events/e1')));
    await assertSucceeds(getDocs(collection(db('ana'), 'users/bia/collection')));
    await assertSucceeds(getDocs(collection(db('bia'), 'users/bia/favoriteLocations')));
  });

  it('quem não podia ler continua sem poder', async () => {
    await assertFails(getDoc(doc(db('duda'), 'groups/g1')));
    await assertFails(getDocs(collection(db('ana'), 'users/bia/favoriteLocations')));
  });

  it('nenhuma escrita passa, nem do admin nem do dono', async () => {
    await assertFails(updateDoc(doc(db('bia'), 'groups/g1/events/e1'), { 'votesDate.bia': 'd1' }));
    await assertFails(updateDoc(doc(db('ana'), 'groups/g1'), { name: 'X' }));
    await assertFails(deleteDoc(doc(db('ana'), 'groups/g1/events/e1')));
    await assertFails(
      addDoc(collection(db('duda'), 'groups'), { name: 'N', adminId: 'duda', members: ['duda'] }),
    );
    await assertFails(setDoc(doc(db('bia'), 'users/bia/collection/bgg-2'), { name: 'Azul' }));
    await assertFails(deleteDoc(doc(db('bia'), 'users/bia/collection/ludo-1')));
    await assertFails(setDoc(doc(db('bia'), 'groups/g1/members/bia'), { name: 'B' }));
    await assertFails(addDoc(collection(db('bia'), 'users/bia/favoriteLocations'), { name: 'X' }));
  });
});
