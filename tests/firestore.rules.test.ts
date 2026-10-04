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

// Cenário: grupo g1 com admin "ana", membros "bia" e "caio"; "duda" é de fora.
// Evento e1 criado por "bia", em votação de datas; e2 em votação de jogos.
let env: RulesTestEnvironment;

const db = (uid?: string) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vamos-jogar',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, 'groups/g1'), {
      name: 'Grupo',
      adminId: 'ana',
      members: ['ana', 'bia', 'caio'],
      inviteToken: 'tok',
    });
    await setDoc(doc(admin, 'groups/g1/members/bia'), { name: 'Bia' });
    await setDoc(doc(admin, 'groups/g1/events/e1'), {
      creatorId: 'bia',
      title: 'Jogatina',
      status: 'VOTING_DATE',
      dateOptions: [],
      locationOptions: [],
      gameOptions: [],
      votesDate: { ana: 'd1' },
      votesLocation: { ana: 'l1' },
      votesGames: {},
    });
    await setDoc(doc(admin, 'groups/g1/events/e2'), {
      creatorId: 'bia',
      title: 'Jogos',
      status: 'VOTING_GAMES',
      gameOptions: [{ id: 'ludo-1', suggesterId: 'ana' }],
      votesDate: {},
      votesLocation: {},
      votesGames: { ana: ['ludo-1'] },
    });
    await setDoc(doc(admin, 'users/bia/collection/ludo-1'), { name: 'Catan' });
    await setDoc(doc(admin, 'users/bia/favoriteLocations/f1'), { name: 'Casa', address: 'Rua X' });
  });
});

describe('grupos', () => {
  it('membro lista seus grupos; visitante e não logado não', async () => {
    const byMember = (uid: string) =>
      getDocs(query(collection(db(uid), 'groups'), where('members', 'array-contains', uid)));
    await assertSucceeds(byMember('bia'));
    await assertFails(getDoc(doc(db('duda'), 'groups/g1')));
    await assertFails(getDoc(doc(db(), 'groups/g1')));
  });

  it('criar grupo só como admin e único membro', async () => {
    await assertSucceeds(
      addDoc(collection(db('duda'), 'groups'), {
        name: 'Novo',
        adminId: 'duda',
        members: ['duda'],
      }),
    );
    await assertFails(
      addDoc(collection(db('duda'), 'groups'), {
        name: 'Novo',
        adminId: 'duda',
        members: ['duda', 'ana'],
      }),
    );
  });

  it('só o admin altera o grupo (remover membro)', async () => {
    await assertSucceeds(updateDoc(doc(db('ana'), 'groups/g1'), { members: ['ana', 'bia'] }));
    await assertFails(updateDoc(doc(db('bia'), 'groups/g1'), { members: ['ana', 'bia'] }));
    await assertFails(updateDoc(doc(db('duda'), 'groups/g1'), { members: ['duda'] }));
  });
});

describe('membros do grupo', () => {
  it('membro lê a lista; visitante não', async () => {
    await assertSucceeds(getDocs(collection(db('caio'), 'groups/g1/members')));
    await assertFails(getDocs(collection(db('duda'), 'groups/g1/members')));
  });

  it('cada um atualiza só o próprio apelido', async () => {
    await assertSucceeds(
      setDoc(doc(db('bia'), 'groups/g1/members/bia'), { name: 'B' }, { merge: true }),
    );
    await assertFails(setDoc(doc(db('bia'), 'groups/g1/members/caio'), { name: 'X' }));
    await assertFails(setDoc(doc(db('duda'), 'groups/g1/members/duda'), { name: 'Intrusa' }));
  });

  it('só o admin remove membros', async () => {
    await assertFails(deleteDoc(doc(db('caio'), 'groups/g1/members/bia')));
    await assertSucceeds(deleteDoc(doc(db('ana'), 'groups/g1/members/bia')));
  });
});

describe('eventos', () => {
  it('membro lê e cria evento em votação de datas', async () => {
    await assertSucceeds(getDoc(doc(db('caio'), 'groups/g1/events/e1')));
    await assertFails(getDoc(doc(db('duda'), 'groups/g1/events/e1')));
    await assertSucceeds(
      addDoc(collection(db('caio'), 'groups/g1/events'), {
        creatorId: 'caio',
        title: 'Nova',
        status: 'VOTING_DATE',
      }),
    );
    await assertFails(
      addDoc(collection(db('caio'), 'groups/g1/events'), {
        creatorId: 'bia',
        title: 'Falsa',
        status: 'VOTING_DATE',
      }),
    );
  });

  it('criador e admin do grupo gerenciam; outro membro não', async () => {
    const advance = { status: 'VOTING_GAMES', finalDateId: 'd1', finalLocationId: 'l1' };
    await assertFails(updateDoc(doc(db('caio'), 'groups/g1/events/e1'), advance));
    await assertSucceeds(updateDoc(doc(db('ana'), 'groups/g1/events/e1'), { title: 'Pelo admin' }));
    await assertSucceeds(updateDoc(doc(db('bia'), 'groups/g1/events/e1'), advance));
    await assertFails(deleteDoc(doc(db('caio'), 'groups/g1/events/e1')));
    await assertSucceeds(deleteDoc(doc(db('ana'), 'groups/g1/events/e1')));
  });

  it('membro registra só o próprio voto', async () => {
    await assertSucceeds(
      updateDoc(doc(db('caio'), 'groups/g1/events/e1'), {
        'votesDate.caio': 'd1',
        'votesLocation.caio': 'l1',
      }),
    );
    await assertFails(updateDoc(doc(db('caio'), 'groups/g1/events/e1'), { 'votesDate.ana': 'd2' }));
    await assertFails(updateDoc(doc(db('caio'), 'groups/g1/events/e1'), { votesDate: {} }));
    await assertFails(
      updateDoc(doc(db('duda'), 'groups/g1/events/e1'), { 'votesDate.duda': 'd1' }),
    );
  });

  it('membro comum não muda status junto com o voto', async () => {
    await assertFails(
      updateDoc(doc(db('caio'), 'groups/g1/events/e1'), {
        'votesDate.caio': 'd1',
        status: 'CONFIRMED',
      }),
    );
  });

  it('sugerir jogos só adiciona, e só na fase de jogos', async () => {
    const ref = doc(db('caio'), 'groups/g1/events/e2');
    await assertSucceeds(
      updateDoc(ref, {
        gameOptions: [
          { id: 'ludo-1', suggesterId: 'ana' },
          { id: 'bgg-2', suggesterId: 'caio' },
        ],
      }),
    );
    await assertFails(updateDoc(ref, { gameOptions: [] }));
    await assertFails(
      updateDoc(doc(db('caio'), 'groups/g1/events/e1'), {
        gameOptions: [{ id: 'bgg-2', suggesterId: 'caio' }],
      }),
    );
  });

  it('nenhum cliente grava o controle de lembretes', async () => {
    await assertFails(
      updateDoc(doc(db('ana'), 'groups/g1/events/e1'), { lastReminderSentAt: new Date() }),
    );
  });
});

describe('dados do usuário', () => {
  it('ludoteca: qualquer logado lê, só o dono escreve', async () => {
    await assertSucceeds(getDocs(collection(db('duda'), 'users/bia/collection')));
    await assertFails(getDocs(collection(db(), 'users/bia/collection')));
    await assertSucceeds(setDoc(doc(db('bia'), 'users/bia/collection/bgg-9'), { name: 'Azul' }));
    await assertFails(setDoc(doc(db('ana'), 'users/bia/collection/bgg-9'), { name: 'Azul' }));
    await assertFails(deleteDoc(doc(db('ana'), 'users/bia/collection/ludo-1')));
  });

  it('locais favoritos: só o dono', async () => {
    await assertSucceeds(getDocs(collection(db('bia'), 'users/bia/favoriteLocations')));
    await assertFails(getDocs(collection(db('ana'), 'users/bia/favoriteLocations')));
    await assertFails(
      addDoc(collection(db('ana'), 'users/bia/favoriteLocations'), { name: 'X', address: 'Y' }),
    );
  });
});
