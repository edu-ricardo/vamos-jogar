import type { ExportedDoc, ExportedUser } from '../backup/exportData';

// Conversão do backup do Firebase (JSON) para os registros do PocketBase. Funções puras:
// não falam com nenhum banco, só traduzem formatos.

type Data = Record<string, any>;

// Desfaz a serialização do backup: datas voltam como texto ISO, que o PocketBase aceita
export const deserialize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === 'object') {
    const v = value as Data;
    if (v.__type === 'timestamp') return v.value;
    if (v.__type === 'reference') return v.path;
    if (v.__type === 'geopoint') return { latitude: v.latitude, longitude: v.longitude };
    return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, deserialize(inner)]));
  }
  return value;
};

export interface BackupGroup {
  id: string;
  data: Data;
  memberNames: Record<string, string>;
  events: { id: string; data: Data }[];
}

export interface BackupIndex {
  groups: BackupGroup[];
  gamesByUser: Record<string, Data[]>;
  favoritesByUser: Record<string, Data[]>;
  // Caminhos que a migração não conhece (avisados no relatório, nunca ignorados em silêncio)
  unknownPaths: string[];
}

// Organiza a lista plana de documentos do backup por tipo
export const indexBackup = (docs: ExportedDoc[]): BackupIndex => {
  const groups = new Map<string, BackupGroup>();
  const groupOf = (id: string) => {
    if (!groups.has(id)) groups.set(id, { id, data: {}, memberNames: {}, events: [] });
    return groups.get(id)!;
  };
  const index: BackupIndex = { groups: [], gamesByUser: {}, favoritesByUser: {}, unknownPaths: [] };

  for (const doc of docs) {
    if (!doc.exists) continue;
    const data = deserialize(doc.data) as Data;
    const p = doc.path.split('/');

    if (p[0] === 'groups' && p.length === 2) groupOf(p[1]).data = data;
    else if (p[0] === 'groups' && p[2] === 'members' && p.length === 4)
      groupOf(p[1]).memberNames[p[3]] = data.name;
    else if (p[0] === 'groups' && p[2] === 'events' && p.length === 4)
      groupOf(p[1]).events.push({ id: p[3], data });
    else if (p[0] === 'users' && p[2] === 'collection' && p.length === 4)
      (index.gamesByUser[p[1]] ??= []).push(data);
    else if (p[0] === 'users' && p[2] === 'favoriteLocations' && p.length === 4)
      (index.favoritesByUser[p[1]] ??= []).push(data);
    else index.unknownPaths.push(doc.path);
  }

  // Eventos na ordem de criação: o PocketBase ordena pela data de importação
  for (const group of groups.values()) {
    group.events.sort((a, b) =>
      String(a.data.createdAt ?? '').localeCompare(String(b.data.createdAt ?? '')),
    );
  }
  index.groups = [...groups.values()];
  return index;
};

export const googleUidOf = (user: ExportedUser) =>
  user.providerData?.find((p) => p.providerId === 'google.com')?.uid;

const toNumberOrNull = (value: unknown) => {
  const n = Number(value);
  return value === undefined || value === null || value === '' || Number.isNaN(n) ? null : n;
};

export const toUserRecord = (user: ExportedUser, randomPassword: string) => ({
  email: user.email,
  emailVisibility: false,
  // Contas do Firebase já tinham o e-mail confirmado pelo Google
  verified: true,
  name: user.displayName ?? '',
  legacyUid: user.uid,
  password: randomPassword,
  passwordConfirm: randomPassword,
});

export const toGameRecord = (ownerId: string, game: Data) => ({
  owner: ownerId,
  gameId: game.id,
  sourceId: String(game.sourceId ?? ''),
  name: game.name,
  image: game.image ?? '',
  description: game.description ?? '',
  playtime: game.playtime != null ? String(game.playtime) : '',
  minPlayers: toNumberOrNull(game.minPlayers),
  maxPlayers: toNumberOrNull(game.maxPlayers),
  observation: game.observation ?? '',
  expansions: game.expansions ?? null,
});

export const toEventRecord = (
  groupId: string,
  creatorId: string,
  legacyId: string,
  event: Data,
) => ({
  group: groupId,
  creator: creatorId,
  title: event.title,
  status: event.status,
  dateOptions: event.dateOptions ?? [],
  locationOptions: event.locationOptions ?? [],
  finalDateId: event.finalDateId ?? '',
  finalLocationId: event.finalLocationId ?? '',
  finalGameIds: event.finalGameIds ?? null,
  lastReminderSentAt: event.lastReminderSentAt ?? '',
  legacyId,
});

// Mapas de votos do Firestore viram uma linha por pessoa
export const toVoteRecords = (eventId: string, event: Data, userIds: Record<string, string>) => {
  const voters = new Set([
    ...Object.keys(event.votesDate ?? {}),
    ...Object.keys(event.votesLocation ?? {}),
    ...Object.keys(event.votesGames ?? {}),
  ]);
  return [...voters]
    .filter((uid) => userIds[uid])
    .map((uid) => ({
      event: eventId,
      user: userIds[uid],
      dateOptionId: event.votesDate?.[uid] ?? '',
      locationOptionId: event.votesLocation?.[uid] ?? '',
      gameIds: event.votesGames?.[uid] ?? null,
    }));
};

export const toEventGameRecords = (eventId: string, event: Data, userIds: Record<string, string>) =>
  (event.gameOptions ?? []).map((game: Data) => ({
    event: eventId,
    gameId: game.id,
    name: game.name,
    thumb: game.thumb ?? '',
    suggester: userIds[game.suggesterId] ?? '',
    suggesterName: game.suggesterName ?? '',
  }));
