import { isDeepStrictEqual } from 'node:util';
import type PocketBase from 'pocketbase/cjs';
import type { Backup } from './importBackup';
import { googleUidOf, indexBackup, toGameRecord } from './transform';

type Data = Record<string, any>;

// O PocketBase guarda JSON; campos undefined somem nessa ida e volta
const asStored = (value: unknown) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

// Compara o que está no PocketBase com o backup, campo a campo. Lista vazia = migração fiel.
export const verifyImport = async (pb: PocketBase, backup: Backup): Promise<string[]> => {
  const index = indexBackup(backup.documents);
  const problems: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  const same = (actual: unknown, expected: unknown, message: string) =>
    check(
      isDeepStrictEqual(asStored(actual), asStored(expected)),
      `${message}: esperado ${JSON.stringify(expected)}, encontrado ${JSON.stringify(actual)}`,
    );

  // Usuários
  const pbUsers = await pb.collection('users').getFullList();
  const byLegacy = new Map(pbUsers.map((u) => [u.legacyUid, u]));
  const legacyOf = new Map(pbUsers.map((u) => [u.id, u.legacyUid]));
  const externalAuths = await pb.collection('_externalAuths').getFullList();
  const migratedUsers = backup.users.filter((u) => u.email);
  same(pbUsers.length, migratedUsers.length, 'Quantidade de usuários');
  for (const user of migratedUsers) {
    const pbUser = byLegacy.get(user.uid);
    if (!pbUser) {
      problems.push(`Usuário ${user.email} não encontrado`);
      continue;
    }
    same(pbUser.email, user.email, `E-mail de ${user.email}`);
    same(pbUser.name, user.displayName ?? '', `Nome de ${user.email}`);
    const googleUid = googleUidOf(user);
    if (googleUid) {
      check(
        externalAuths.some(
          (a) => a.recordRef === pbUser.id && a.provider === 'google' && a.providerId === googleUid,
        ),
        `Login Google de ${user.email} não está ligado à conta`,
      );
    }
  }

  // Ludotecas: cada jogo, campo a campo
  const pbGames = await pb.collection('games').getFullList();
  for (const [uid, games] of Object.entries(index.gamesByUser)) {
    const owner = byLegacy.get(uid);
    if (!owner) continue;
    const ownerGames = pbGames.filter((g) => g.owner === owner.id);
    same(ownerGames.length, games.length, `Jogos na ludoteca de ${owner.email}`);
    for (const game of games) {
      const pbGame = ownerGames.find((g) => g.gameId === game.id);
      if (!pbGame) {
        problems.push(
          `Jogo ${game.name} (${game.id}) não encontrado na ludoteca de ${owner.email}`,
        );
        continue;
      }
      const expected: Data = toGameRecord(owner.id, game);
      // Número vazio fica 0 no PocketBase (não existe nulo); o app lê 0 como "não informado"
      const stored = (field: string) =>
        ['minPlayers', 'maxPlayers'].includes(field) && pbGame[field] === 0 ? null : pbGame[field];
      for (const field of Object.keys(expected)) {
        same(
          stored(field) ?? null,
          expected[field] ?? null,
          `${owner.email} / ${game.name} / ${field}`,
        );
      }
    }
  }

  // Grupos, membros, eventos, votos e sugestões
  const pbGroups = await pb.collection('groups').getFullList();
  const memberships = await pb.collection('memberships').getFullList({ sort: 'created' });
  const pbEvents = await pb.collection('events').getFullList();
  const votes = await pb.collection('votes').getFullList();
  const eventGames = await pb.collection('event_games').getFullList({ sort: 'created' });

  for (const group of index.groups.filter((g) => g.data.name)) {
    const pbGroup = pbGroups.find((g) => g.legacyId === group.id);
    if (!pbGroup) {
      problems.push(`Grupo "${group.data.name}" não encontrado`);
      continue;
    }
    const label = `Grupo "${group.data.name}"`;
    same(pbGroup.name, group.data.name, `${label} / nome`);
    same(pbGroup.inviteToken, group.data.inviteToken, `${label} / convite`);
    same(legacyOf.get(pbGroup.admin), group.data.adminId, `${label} / admin`);

    const expectedMembers = (group.data.members ?? []).filter((uid: string) => byLegacy.has(uid));
    const groupMemberships = memberships.filter((m) => m.group === pbGroup.id);
    same(
      groupMemberships.map((m) => legacyOf.get(m.user)),
      expectedMembers,
      `${label} / membros na ordem de entrada`,
    );
    for (const m of groupMemberships) {
      const uid = legacyOf.get(m.user)!;
      same(m.nickname, group.memberNames[uid] ?? '', `${label} / apelido de ${uid}`);
    }

    for (const event of group.events) {
      const pbEvent = pbEvents.find((e) => e.legacyId === event.id);
      if (!pbEvent) {
        problems.push(`${label} / evento "${event.data.title}" não encontrado`);
        continue;
      }
      const e = event.data;
      const eLabel = `${label} / evento "${e.title}"`;
      same(pbEvent.title, e.title, `${eLabel} / título`);
      same(pbEvent.status, e.status, `${eLabel} / status`);
      same(pbEvent.dateOptions, e.dateOptions ?? [], `${eLabel} / datas`);
      same(pbEvent.locationOptions, e.locationOptions ?? [], `${eLabel} / locais`);
      same(pbEvent.finalDateId, e.finalDateId ?? '', `${eLabel} / data escolhida`);
      same(pbEvent.finalLocationId, e.finalLocationId ?? '', `${eLabel} / local escolhido`);
      same(pbEvent.finalGameIds, e.finalGameIds ?? null, `${eLabel} / jogos escolhidos`);
      same(
        legacyOf.get(pbEvent.creator) ?? null,
        byLegacy.has(e.creatorId) ? e.creatorId : null,
        `${eLabel} / criador`,
      );

      const eventVotes = votes.filter((v) => v.event === pbEvent.id);
      const votesMap = (field: string) =>
        Object.fromEntries(
          eventVotes.filter((v) => v[field]).map((v) => [legacyOf.get(v.user), v[field]]),
        );
      const knownOnly = (map: Data = {}) =>
        Object.fromEntries(Object.entries(map).filter(([uid]) => byLegacy.has(uid)));
      same(votesMap('dateOptionId'), knownOnly(e.votesDate), `${eLabel} / votos de data`);
      same(votesMap('locationOptionId'), knownOnly(e.votesLocation), `${eLabel} / votos de local`);
      same(votesMap('gameIds'), knownOnly(e.votesGames), `${eLabel} / votos de jogos`);

      const suggestions = eventGames.filter((g) => g.event === pbEvent.id);
      same(
        suggestions.map((g) => [g.gameId, g.name, legacyOf.get(g.suggester) ?? null]),
        (e.gameOptions ?? []).map((g: Data) => [
          g.id,
          g.name,
          byLegacy.has(g.suggesterId) ? g.suggesterId : null,
        ]),
        `${eLabel} / jogos sugeridos`,
      );
    }
  }

  // Locais favoritos
  const favorites = await pb.collection('favorite_locations').getFullList();
  for (const [uid, favs] of Object.entries(index.favoritesByUser)) {
    const owner = byLegacy.get(uid);
    if (!owner) continue;
    same(
      favorites
        .filter((f) => f.owner === owner.id)
        .map((f) => [f.name, f.address])
        .sort(),
      favs.map((f) => [f.name, f.address]).sort(),
      `Locais favoritos de ${owner.email}`,
    );
  }

  return problems;
};
