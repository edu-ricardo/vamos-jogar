import { describe, expect, it } from 'vitest';
import { deserialize, excludeUsers, indexBackup, toGameRecord, toVoteRecords } from './transform';

describe('deserialize', () => {
  it('converte datas do backup em texto ISO, inclusive aninhadas', () => {
    expect(
      deserialize({
        a: { __type: 'timestamp', value: '2026-01-01T00:00:00.000Z' },
        b: [1, { c: null }],
      }),
    ).toEqual({ a: '2026-01-01T00:00:00.000Z', b: [1, { c: null }] });
  });
});

describe('indexBackup', () => {
  it('separa grupos, membros, eventos, ludotecas e favoritos; ignora documentos vazios', () => {
    const index = indexBackup([
      { path: 'users/u1', exists: false, data: null },
      { path: 'users/u1/collection/ludo-1', exists: true, data: { id: 'ludo-1' } },
      { path: 'users/u1/favoriteLocations/f1', exists: true, data: { name: 'Casa' } },
      {
        path: 'groups/g1/events/e2',
        exists: true,
        data: { createdAt: { __type: 'timestamp', value: '2026-02-01T00:00:00Z' } },
      },
      { path: 'groups/g1', exists: true, data: { name: 'G' } },
      { path: 'groups/g1/members/u1', exists: true, data: { name: 'Apelido' } },
      {
        path: 'groups/g1/events/e1',
        exists: true,
        data: { createdAt: { __type: 'timestamp', value: '2026-01-01T00:00:00Z' } },
      },
      { path: 'outra/coisa', exists: true, data: {} },
    ]);

    expect(index.gamesByUser).toEqual({ u1: [{ id: 'ludo-1' }] });
    expect(index.favoritesByUser).toEqual({ u1: [{ name: 'Casa' }] });
    expect(index.groups).toHaveLength(1);
    expect(index.groups[0].memberNames).toEqual({ u1: 'Apelido' });
    expect(index.groups[0].events.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(index.unknownPaths).toEqual(['outra/coisa']);
  });
});

describe('toGameRecord', () => {
  it('normaliza números em texto e campos ausentes', () => {
    expect(
      toGameRecord('owner1', {
        id: 'bgg-2',
        sourceId: 2,
        name: 'Azul',
        minPlayers: '2',
        maxPlayers: 'abc',
      }),
    ).toEqual({
      owner: 'owner1',
      gameId: 'bgg-2',
      sourceId: '2',
      name: 'Azul',
      image: '',
      description: '',
      playtime: '',
      minPlayers: 2,
      maxPlayers: null,
      observation: '',
      expansions: null,
    });
  });
});

describe('toVoteRecords', () => {
  it('junta os três mapas em uma linha por pessoa e ignora quem não existe mais', () => {
    const votes = toVoteRecords(
      'ev1',
      {
        votesDate: { a: 'd1', gone: 'd1' },
        votesLocation: { a: 'l1' },
        votesGames: { b: ['ludo-1'] },
      },
      { a: 'pb-a', b: 'pb-b' },
    );
    expect(votes).toEqual([
      { event: 'ev1', user: 'pb-a', dateOptionId: 'd1', locationOptionId: 'l1', gameIds: null },
      { event: 'ev1', user: 'pb-b', dateOptionId: '', locationOptionId: '', gameIds: ['ludo-1'] },
    ]);
  });
});

describe('excludeUsers', () => {
  const user = (uid: string, email: string) => ({
    uid,
    email,
    emailVerified: true,
    disabled: false,
    providers: [],
    providerData: [],
  });
  const backup = { documents: [], users: [user('a', 'ana@x.test'), user('b', 'Bia@X.test')] };

  it('remove as contas pelo e-mail, sem diferenciar maiúsculas', () => {
    expect(excludeUsers(backup, [' bia@x.test ']).users.map((u) => u.uid)).toEqual(['a']);
    expect(excludeUsers(backup, []).users).toHaveLength(2);
  });

  it('e-mail que não está no backup é erro (protege contra erro de digitação)', () => {
    expect(() => excludeUsers(backup, ['bia@x.tst'])).toThrow('bia@x.tst');
  });
});
