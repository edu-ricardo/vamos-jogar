import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, arrayUnion, type Firestore } from 'firebase/firestore';
import { createFirebaseGroupRepository } from '../apps/web/src/services/firebase/groupRepository';
import { createFirebaseEventRepository } from '../apps/web/src/services/firebase/eventRepository';
import { createFirebaseLudotecaRepository } from '../apps/web/src/services/firebase/ludotecaRepository';

// Contrato dos repositórios: o mesmo roteiro deve passar na implementação Firebase de hoje e na
// PocketBase de amanhã. Aqui roda no emulador com as regras de produção ativas.
let env: RulesTestEnvironment;

const dbAs = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const groupsAs = (uid: string) => createFirebaseGroupRepository(dbAs(uid));
const eventsAs = (uid: string) => createFirebaseEventRepository(dbAs(uid));
const ludotecaAs = (uid: string) => createFirebaseLudotecaRepository(dbAs(uid));

// Entrar por convite é feito pela API (Admin SDK); aqui simulado sem regras
const joinAsMember = (groupId: string, uid: string, name: string) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(uid) });
    await setDoc(doc(db, 'groups', groupId, 'members', uid), { name });
  });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vamos-jogar-contract',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const createGroupWithMembers = async () => {
  await groupsAs('ana').createGroup('ana', 'Jogatina de Sexta', 'Ana');
  const [group] = await groupsAs('ana').fetchUserGroups('ana');
  await joinAsMember(group.id, 'bia', 'Bia');
  await joinAsMember(group.id, 'caio', 'Caio');
  return group;
};

describe('GroupRepository', () => {
  it('cria grupo com quem criou como admin e membro', async () => {
    const group = await createGroupWithMembers();

    expect(group).toMatchObject({ name: 'Jogatina de Sexta', adminId: 'ana' });
    expect(group.inviteToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(await groupsAs('bia').fetchGroupDetails(group.id)).toMatchObject({ id: group.id });
    expect((await groupsAs('bia').fetchUserGroups('bia')).map((g) => g.id)).toEqual([group.id]);
  });

  it('lista membros, atualiza apelido e admin remove membro', async () => {
    const group = await createGroupWithMembers();

    await groupsAs('bia').updateMemberName(group.id, 'bia', 'Bia Boardgamer');
    await groupsAs('ana').removeMember(group.id, 'caio');

    const members = await groupsAs('ana').fetchGroupMembers(group.id);
    expect(members.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'ana', name: 'Ana' },
      { id: 'bia', name: 'Bia Boardgamer' },
    ]);
    expect(await groupsAs('caio').fetchUserGroups('caio')).toEqual([]);
  });
});

describe('EventRepository', () => {
  const dates = [
    { id: 'd1', date: '2026-10-10', startTime: '19:00', endTime: '23:00' },
    { id: 'd2', date: '2026-10-11', startTime: '14:00', endTime: '' },
  ];
  const locations = [{ id: 'l1', name: 'Casa da Ana', address: 'Rua A, 1' }];

  it('percorre o fluxo completo: criar, votar, avançar, sugerir, votar jogos e confirmar', async () => {
    const group = await createGroupWithMembers();
    const eventId = await eventsAs('bia').createEvent(group.id, 'bia', 'Sexta', dates, locations);

    await eventsAs('ana').voteDateLocation(group.id, eventId, 'ana', 'd1', 'l1');
    await eventsAs('caio').voteDateLocation(group.id, eventId, 'caio', 'd2', 'l1');
    await eventsAs('ana').advanceToGamesVoting(group.id, eventId, 'd1', 'l1');

    await eventsAs('caio').suggestGames(group.id, eventId, [
      { id: 'ludo-1', name: 'Catan', thumb: '', suggesterId: 'caio', suggesterName: 'Caio' },
    ]);
    await eventsAs('bia').suggestGames(group.id, eventId, [
      { id: 'ludo-1', name: 'Catan', thumb: '', suggesterId: 'bia', suggesterName: 'Bia' },
      { id: 'bgg-2', name: 'Azul', thumb: '', suggesterId: 'bia', suggesterName: 'Bia' },
    ]);
    await eventsAs('ana').voteGames(group.id, eventId, 'ana', ['ludo-1', 'bgg-2']);
    await eventsAs('bia').confirmEvent(group.id, eventId, ['ludo-1']);

    const event = await eventsAs('caio').getEventDetails(group.id, eventId);
    expect(event).toMatchObject({
      status: 'CONFIRMED',
      finalDateId: 'd1',
      finalLocationId: 'l1',
      finalGameIds: ['ludo-1'],
      votesDate: { ana: 'd1', caio: 'd2' },
      votesLocation: { ana: 'l1', caio: 'l1' },
      votesGames: { ana: ['ludo-1', 'bgg-2'] },
    });
    // Sugestão repetida não duplica e mantém quem sugeriu primeiro
    expect(event.gameOptions?.map((g) => [g.id, g.suggesterId])).toEqual([
      ['ludo-1', 'caio'],
      ['bgg-2', 'bia'],
    ]);
  });

  it('lista eventos do grupo do mais novo para o mais antigo', async () => {
    const group = await createGroupWithMembers();
    const first = await eventsAs('bia').createEvent(group.id, 'bia', 'Primeiro', dates, locations);
    const second = await eventsAs('caio').createEvent(
      group.id,
      'caio',
      'Segundo',
      dates,
      locations,
    );

    const events = await eventsAs('ana').fetchGroupEvents(group.id);
    expect(events.map((e) => e.id)).toEqual([second, first]);
  });

  it('criador edita e o admin exclui o evento', async () => {
    const group = await createGroupWithMembers();
    const eventId = await eventsAs('bia').createEvent(
      group.id,
      'bia',
      'Rascunho',
      dates,
      locations,
    );

    await eventsAs('bia').updateEvent(group.id, eventId, 'Sábado', [dates[1]], locations);
    expect(await eventsAs('caio').getEventDetails(group.id, eventId)).toMatchObject({
      title: 'Sábado',
      dateOptions: [dates[1]],
    });

    await eventsAs('ana').deleteEvent(group.id, eventId);
    expect(await eventsAs('ana').fetchGroupEvents(group.id)).toEqual([]);
  });

  it('salva e lista locais favoritos do próprio usuário', async () => {
    await eventsAs('ana').saveFavoriteLocation('ana', { name: 'Casa', address: 'Rua A, 1' });
    const favorites = await eventsAs('ana').fetchFavoriteLocations('ana');
    expect(favorites).toMatchObject([{ name: 'Casa', address: 'Rua A, 1' }]);
    expect(favorites[0].id).toBeTruthy();
  });
});

describe('LudotecaRepository', () => {
  it('adiciona, edita, lista e remove jogos; outros usuários conseguem ver', async () => {
    const catan = {
      id: 'ludo-1',
      sourceId: '1',
      name: 'Catan',
      image: 'catan.jpg',
      playtime: '90',
      minPlayers: 3,
      maxPlayers: 4,
      observation: 'Edição 2015',
      expansions: [{ id: 'ludo-9', sourceId: '9', name: 'Marinheiros', image: '' }],
    };

    await ludotecaAs('bia').addGameToCollection('bia', catan);
    await ludotecaAs('bia').addGameToCollection('bia', { ...catan, observation: 'Falta 1 peça' });
    expect(await ludotecaAs('caio').fetchUserCollection('bia')).toEqual([
      { ...catan, observation: 'Falta 1 peça' },
    ]);

    await ludotecaAs('bia').removeGameFromCollection('bia', 'ludo-1');
    expect(await ludotecaAs('bia').fetchUserCollection('bia')).toEqual([]);
  });

  // A tela da Ludoteca envia minPlayers/maxPlayers como undefined quando o campo fica vazio
  it('aceita jogo sem número de jogadores', async () => {
    await ludotecaAs('bia').addGameToCollection('bia', {
      id: 'bgg-2',
      sourceId: '2',
      name: 'Azul',
      image: '',
      playtime: '45',
      minPlayers: undefined,
      maxPlayers: undefined,
      observation: '',
    });
    expect(await ludotecaAs('bia').fetchUserCollection('bia')).toHaveLength(1);
  });
});
