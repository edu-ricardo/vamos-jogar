import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import PocketBase from 'pocketbase';
import { createPocketBaseEventRepository } from '../apps/web/src/services/pocketbase/eventRepository';
import { dateVotesByUser } from '../apps/api/src/services/reminderRules';
import { resetAppData } from '../apps/api/scripts/migrate/importBackup';

// Votos de data com várias datas por pessoa, no PocketBase real: leitura, gravação, voto feito
// pela versão anterior (só com a data única) e o que as regras permitem.
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
type Person = 'ana' | 'bia' | 'caio';
const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('Votos de data com várias datas', () => {
  const admin = new PocketBase(url);
  admin.autoCancellation(false);
  const ids = {} as Record<Person, string>;
  const sessions = {} as Record<Person, PocketBase>;
  let groupId: string;
  let eventId: string;

  const repoFor = (person: Person) => createPocketBaseEventRepository(sessions[person]);
  const voteRecords = () => admin.collection('votes').getFullList({ sort: 'created' });

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
  });

  beforeEach(async () => {
    await resetAppData(admin);
    for (const person of ['ana', 'bia', 'caio'] as const) {
      const email = `${person}@vamosjogar.test`;
      ids[person] = (
        await admin
          .collection('users')
          .create({ email, password: PASSWORD, passwordConfirm: PASSWORD, name: person })
      ).id;
      sessions[person] = new PocketBase(url);
      sessions[person].autoCancellation(false);
      await sessions[person].collection('users').authWithPassword(email, PASSWORD);
    }
    groupId = (
      await admin.collection('groups').create({ name: 'Sexta', admin: ids.ana, inviteToken: 't1' })
    ).id;
    for (const person of ['ana', 'bia', 'caio'] as const) {
      await admin.collection('memberships').create({ group: groupId, user: ids[person] });
    }
    eventId = (
      await admin.collection('events').create({
        group: groupId,
        creator: ids.ana,
        title: 'Jogatina',
        status: 'VOTING_DATE',
        dateOptions: [
          { id: 'd1', date: '2026-10-10', startTime: '19:00' },
          { id: 'd2', date: '2026-10-11', startTime: '14:00' },
          { id: 'd3', date: '2026-10-12', startTime: '19:00' },
        ],
        locationOptions: [{ id: 'l1', name: 'Casa', address: 'Rua A' }],
      })
    ).id;
  });

  it('grava as datas marcadas e as devolve na ordem; o campo antigo guarda a primeira', async () => {
    await repoFor('bia').voteDateLocation(groupId, eventId, ids.bia, ['d2', 'd1'], 'l1');

    const [vote] = await voteRecords();
    expect(vote).toMatchObject({ dateOptionIds: ['d2', 'd1'], dateOptionId: 'd2' });
    const event = await repoFor('caio').getEventDetails(groupId, eventId);
    expect(event.votesDate).toEqual({ [ids.bia]: ['d2', 'd1'] });
    expect(event.votesLocation).toEqual({ [ids.bia]: 'l1' });
  });

  it('votar de novo troca a lista da pessoa, sem duplicar o voto', async () => {
    const bia = repoFor('bia');
    await bia.voteDateLocation(groupId, eventId, ids.bia, ['d1', 'd2', 'd3'], 'l1');
    await bia.voteDateLocation(groupId, eventId, ids.bia, ['d3'], 'l1');

    expect(await voteRecords()).toHaveLength(1);
    expect((await bia.getEventDetails(groupId, eventId)).votesDate[ids.bia]).toEqual(['d3']);
  });

  it('cada pessoa tem a sua lista; os votos de jogos da mesma pessoa continuam intactos', async () => {
    await repoFor('bia').voteGames(groupId, eventId, ids.bia, ['g1']);
    await repoFor('bia').voteDateLocation(groupId, eventId, ids.bia, ['d1', 'd2'], 'l1');
    await repoFor('caio').voteDateLocation(groupId, eventId, ids.caio, ['d2'], 'l1');

    const event = await repoFor('ana').getEventDetails(groupId, eventId);
    expect(event.votesDate).toEqual({ [ids.bia]: ['d1', 'd2'], [ids.caio]: ['d2'] });
    expect(event.votesGames).toEqual({ [ids.bia]: ['g1'] });
  });

  it('voto feito pela versão anterior (só a data única) é lido como lista de uma data', async () => {
    await admin
      .collection('votes')
      .create({ event: eventId, user: ids.caio, dateOptionId: 'd2', locationOptionId: 'l1' });

    const event = await repoFor('ana').getEventDetails(groupId, eventId);

    expect(event.votesDate).toEqual({ [ids.caio]: ['d2'] });
  });

  it('as regras do lembrete também entendem os dois formatos de voto', async () => {
    await repoFor('bia').voteDateLocation(groupId, eventId, ids.bia, ['d1', 'd3'], 'l1');
    await admin
      .collection('votes')
      .create({ event: eventId, user: ids.caio, dateOptionId: 'd2', locationOptionId: 'l1' });

    expect(dateVotesByUser(await voteRecords())).toEqual({
      [ids.bia]: ['d1', 'd3'],
      [ids.caio]: ['d2'],
    });
  });

  it('acrescentar uma data editando o evento mantém os votos já feitos', async () => {
    await repoFor('bia').voteDateLocation(groupId, eventId, ids.bia, ['d1', 'd2'], 'l1');
    const before = await repoFor('ana').getEventDetails(groupId, eventId);

    await repoFor('ana').updateEvent(
      groupId,
      eventId,
      'Jogatina',
      [...before.dateOptions, { id: 'd4', date: '2026-10-13', startTime: '20:00' }],
      before.locationOptions,
    );

    const after = await repoFor('caio').getEventDetails(groupId, eventId);
    expect(after.dateOptions.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(after.votesDate).toEqual({ [ids.bia]: ['d1', 'd2'] });
  });

  it('não dá para votar depois de o evento ser confirmado', async () => {
    await admin.collection('events').update(eventId, { status: 'CONFIRMED' });

    await expect(
      repoFor('bia').voteDateLocation(groupId, eventId, ids.bia, ['d1'], 'l1'),
    ).rejects.toBeTruthy();
  });
});
