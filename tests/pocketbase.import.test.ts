import { beforeAll, describe, expect, it } from 'vitest';
import PocketBase from 'pocketbase';
import {
  countAppRecords,
  importBackup,
  resetAppData,
} from '../apps/api/scripts/migrate/importBackup';
import { verifyImport } from '../apps/api/scripts/migrate/verifyImport';
import { createPocketBaseEventRepository } from '../apps/web/src/services/pocketbase/eventRepository';
import { createPocketBaseGroupRepository } from '../apps/web/src/services/pocketbase/groupRepository';
import { createPocketBaseLudotecaRepository } from '../apps/web/src/services/pocketbase/ludotecaRepository';
import { backupDocuments, backupUsers } from './fixtures/firebaseBackup';

// Migração Firebase → PocketBase com um backup de exemplo. Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const describeIfPocketBase = url ? describe : describe.skip;
const backup = { documents: backupDocuments, users: backupUsers };

describeIfPocketBase('Migração do backup do Firebase', () => {
  const admin = new PocketBase(url);
  admin.autoCancellation(false);
  // Superusuário passa pelas regras: aqui o foco é ler os dados migrados pelos repositórios do app
  const events = createPocketBaseEventRepository(admin);
  const groups = createPocketBaseGroupRepository(admin);
  const ludoteca = createPocketBaseLudotecaRepository(admin);
  const pbId = async (legacyUid: string) =>
    (await admin.collection('users').getFirstListItem(`legacyUid = "${legacyUid}"`)).id;

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
    await resetAppData(admin);
    for (const auth of await admin.collection('_externalAuths').getFullList()) {
      await admin.collection('_externalAuths').delete(auth.id);
    }
  });

  it('importa tudo, avisa o que ficou de fora e a conferência não acha divergência', async () => {
    const report = await importBackup(admin, backup);

    expect(report.counts).toMatchObject({
      users: 3,
      _externalAuths: 3,
      groups: 1,
      memberships: 3,
      events: 2,
      event_games: 2,
      votes: 4,
      games: 3,
      favorite_locations: 1,
    });
    expect(report.warnings.join('\n')).toContain('fb-dani');
    expect(await verifyImport(admin, backup)).toEqual([]);
  });

  it('o app lê os dados migrados como eram no Firebase', async () => {
    const [ana, bia, caio] = await Promise.all(['fb-ana', 'fb-bia', 'fb-caio'].map(pbId));

    const [group] = await groups.fetchUserGroups(bia);
    expect(group).toMatchObject({
      name: 'Jogatina de Sexta',
      adminId: ana,
      inviteToken: 'convite-g1',
    });
    expect(await groups.fetchGroupMembers(group.id)).toEqual([
      { id: ana, name: 'Ana' },
      { id: bia, name: 'Bia Boardgamer' },
      { id: caio, name: 'Caio' },
    ]);

    const [newest, confirmed] = await events.fetchGroupEvents(group.id);
    expect(newest).toMatchObject({
      title: 'Próxima jogatina',
      status: 'VOTING_DATE',
      creatorId: '',
    });
    expect(confirmed).toMatchObject({
      title: 'Sexta de Catan',
      status: 'CONFIRMED',
      creatorId: bia,
      finalGameIds: ['ludo-1'],
      votesDate: { [ana]: 'd1', [bia]: 'd1' },
      votesLocation: { [ana]: 'l1', [bia]: 'l1' },
      votesGames: { [ana]: ['ludo-1'], [caio]: ['ludo-1', 'bgg-7'] },
    });
    expect(confirmed.gameOptions?.map((g) => [g.id, g.suggesterId, g.suggesterName])).toEqual([
      ['ludo-1', ana, 'Ana'],
      ['bgg-7', '', 'Dani'],
    ]);

    const anaGames = await ludoteca.fetchUserCollection(ana);
    expect(anaGames.find((g) => g.id === 'ludo-1')).toEqual({
      id: 'ludo-1',
      sourceId: '1',
      name: 'Catan',
      image: 'https://img/catan.jpg',
      description: '<p>Troca de recursos</p>',
      playtime: '90',
      minPlayers: 3,
      maxPlayers: 4,
      observation: 'Edição 2015',
      expansions: [{ id: 'ludo-9', sourceId: 9, name: 'Marinheiros', image: '' }],
    });
    expect(await events.fetchFavoriteLocations(bia)).toMatchObject([{ name: 'Casa da Bia' }]);
  });

  it('a conferência acusa qualquer diferença', async () => {
    const game = await admin.collection('games').getFirstListItem('gameId = "bgg-2"');
    await admin.collection('games').update(game.id, { name: 'Azul (alterado)' });

    const problems = await verifyImport(admin, backup);
    expect(problems).toEqual([expect.stringContaining('Azul / name')]);

    await admin.collection('games').update(game.id, { name: 'Azul' });
  });

  it('pode ser refeita do zero (ensaio) com o mesmo resultado', async () => {
    expect(await countAppRecords(admin)).toBeGreaterThan(0);
    await resetAppData(admin);
    expect(await countAppRecords(admin)).toBe(0);

    await importBackup(admin, backup);
    expect(await verifyImport(admin, backup)).toEqual([]);
  });
});
