import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { Game, LudotecaRepository } from '../ludotecaService';

// Campos vazios no PocketBase voltam como "" ou 0; no app, ausente é undefined
const optionalText = (value: string) => value || undefined;
const optionalNumber = (value: number) => value || undefined;
const toNumberOrNull = (value: Game['minPlayers']) => {
  const n = Number(value);
  return value === undefined || value === '' || Number.isNaN(n) ? null : n;
};

const toGame = (r: RecordModel): Game => ({
  id: r.gameId,
  sourceId: r.sourceId,
  name: r.name,
  image: r.image,
  description: optionalText(r.description),
  playtime: optionalText(r.playtime),
  minPlayers: optionalNumber(r.minPlayers),
  maxPlayers: optionalNumber(r.maxPlayers),
  observation: optionalText(r.observation),
  expansions: r.expansions || undefined,
});

export const createPocketBaseLudotecaRepository = (pb: PocketBase): LudotecaRepository => {
  const findOwned = (uid: string, gameId: string) =>
    pb.collection('games').getFullList({
      filter: pb.filter('owner = {:uid} && gameId = {:gameId}', { uid, gameId }),
    });

  return {
    fetchUserCollection: async (uid) => {
      const records = await pb.collection('games').getFullList({
        filter: pb.filter('owner = {:uid}', { uid }),
        sort: 'created',
      });
      return records.map(toGame);
    },

    // Mesmo comportamento do Firestore: salvar um jogo existente substitui os dados dele
    addGameToCollection: async (uid, game) => {
      const data = {
        owner: uid,
        gameId: game.id,
        sourceId: String(game.sourceId ?? ''),
        name: game.name,
        image: game.image || '',
        description: game.description || '',
        playtime: game.playtime ? String(game.playtime) : '',
        minPlayers: toNumberOrNull(game.minPlayers),
        maxPlayers: toNumberOrNull(game.maxPlayers),
        observation: game.observation || '',
        expansions: game.expansions ?? null,
      };
      const [existing] = await findOwned(uid, game.id);
      if (existing) await pb.collection('games').update(existing.id, data);
      else await pb.collection('games').create(data);
    },

    removeGameFromCollection: async (uid, gameId) => {
      const [existing] = await findOwned(uid, gameId);
      if (existing) await pb.collection('games').delete(existing.id);
    },
  };
};
