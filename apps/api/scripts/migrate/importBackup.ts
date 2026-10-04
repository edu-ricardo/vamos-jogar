import { randomBytes } from 'node:crypto';
import type PocketBase from 'pocketbase/cjs';
import type { ExportedDoc, ExportedUser } from '../backup/exportData';
import {
  googleUidOf,
  indexBackup,
  toEventGameRecords,
  toEventRecord,
  toGameRecord,
  toUserRecord,
  toVoteRecords,
} from './transform';

export interface Backup {
  documents: ExportedDoc[];
  users: ExportedUser[];
}

export interface ImportReport {
  counts: Record<string, number>;
  warnings: string[];
}

// Ordem que respeita as relações (filhos antes dos pais)
export const APP_COLLECTIONS_IN_DELETE_ORDER = [
  'votes',
  'event_games',
  'events',
  'memberships',
  'groups',
  'games',
  'favorite_locations',
  'users',
];

const ORDERED_COLLECTIONS = ['memberships', 'events', 'event_games'];

export const countAppRecords = async (pb: PocketBase) => {
  let total = 0;
  for (const name of APP_COLLECTIONS_IN_DELETE_ORDER) {
    total += (await pb.collection(name).getList(1, 1, { fields: 'id' })).totalItems;
  }
  return total;
};

// Apaga só os dados do app (coleções e usuários); superusuários e configurações ficam
export const resetAppData = async (pb: PocketBase) => {
  for (const name of APP_COLLECTIONS_IN_DELETE_ORDER) {
    for (const record of await pb.collection(name).getFullList({ fields: 'id' })) {
      await pb.collection(name).delete(record.id);
    }
  }
};

export const importBackup = async (pb: PocketBase, backup: Backup): Promise<ImportReport> => {
  const index = indexBackup(backup.documents);
  const counts: Record<string, number> = {};
  const count = (name: string) => (counts[name] = (counts[name] ?? 0) + 1);
  const warnings = index.unknownPaths.map(
    (path) => `Documento não migrado (tipo desconhecido): ${path}`,
  );
  const create = async (collection: string, data: Record<string, unknown>) => {
    const record = await pb.collection(collection).create(data);
    count(collection);
    // A ordem desses registros vem do "created" (milissegundos); sem a pausa, dois deles podem
    // empatar e a ordem de entrada nos grupos (que decide o próximo admin) ficaria ambígua
    if (ORDERED_COLLECTIONS.includes(collection)) await new Promise((r) => setTimeout(r, 5));
    return record;
  };

  // Usuários, com o login Google já ligado à conta (o primeiro login cai nela)
  const usersCollectionId = (await pb.collections.getOne('users')).id;
  const userIds: Record<string, string> = {};
  for (const user of backup.users) {
    if (!user.email) {
      warnings.push(`Usuário ${user.uid} sem e-mail não foi migrado`);
      continue;
    }
    const record = await create('users', toUserRecord(user, randomBytes(24).toString('base64url')));
    userIds[user.uid] = record.id;
    const googleUid = googleUidOf(user);
    if (googleUid) {
      await create('_externalAuths', {
        collectionRef: usersCollectionId,
        recordRef: record.id,
        provider: 'google',
        providerId: googleUid,
      });
    } else {
      warnings.push(`${user.email} não usa Google: vai precisar criar uma senha nova`);
    }
  }
  const known = (uid: string, context: string) => {
    if (!userIds[uid]) warnings.push(`${context}: usuário ${uid} não existe mais e foi ignorado`);
    return userIds[uid];
  };

  for (const group of index.groups) {
    if (!group.data.name) {
      warnings.push(`Grupo ${group.id} sem documento principal não foi migrado`);
      continue;
    }
    // Ordem do array = ordem de entrada, usada para escolher o próximo admin no futuro
    const memberUids: string[] = (group.data.members ?? []).filter((uid: string) =>
      known(uid, `Grupo "${group.data.name}"`),
    );
    const adminId = userIds[group.data.adminId] ?? userIds[memberUids[0]];
    if (!adminId) {
      warnings.push(`Grupo "${group.data.name}" sem nenhum membro existente não foi migrado`);
      continue;
    }

    const groupRecord = await create('groups', {
      name: group.data.name,
      admin: adminId,
      inviteToken: group.data.inviteToken,
      legacyId: group.id,
    });
    for (const uid of memberUids) {
      await create('memberships', {
        group: groupRecord.id,
        user: userIds[uid],
        nickname: group.memberNames[uid] ?? '',
      });
    }

    for (const event of group.events) {
      const eventRecord = await create(
        'events',
        toEventRecord(groupRecord.id, userIds[event.data.creatorId] ?? '', event.id, event.data),
      );
      for (const game of toEventGameRecords(eventRecord.id, event.data, userIds)) {
        await create('event_games', game);
      }
      for (const vote of toVoteRecords(eventRecord.id, event.data, userIds)) {
        await create('votes', vote);
      }
    }
  }

  for (const [uid, games] of Object.entries(index.gamesByUser)) {
    if (!known(uid, `Ludoteca (${games.length} jogos)`)) continue;
    for (const game of games) await create('games', toGameRecord(userIds[uid], game));
  }

  for (const [uid, favorites] of Object.entries(index.favoritesByUser)) {
    if (!known(uid, 'Locais favoritos')) continue;
    for (const fav of favorites) {
      await create('favorite_locations', {
        owner: userIds[uid],
        name: fav.name,
        address: fav.address,
      });
    }
  }

  return { counts, warnings };
};
