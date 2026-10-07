import { normalize } from './ludotecaFilters';
import type { Game } from './ludotecaService';

export interface GameOwner {
  id: string;
  name: string;
}

export interface GroupGame {
  // Nome normalizado: junta o mesmo jogo vindo da Ludopedia, do BGG ou cadastrado à mão
  key: string;
  name: string;
  image: string;
  playtime?: string;
  minPlayers?: number | string;
  maxPlayers?: number | string;
  owners: GameOwner[];
}

// Junta as ludotecas dos membros: cada jogo aparece uma vez, com quem tem. Os dados do jogo vêm
// da primeira cópia que tem imagem (ou da primeira, se nenhuma tiver).
export const buildGroupGames = (
  collections: { owner: GameOwner; games: Game[] }[],
): GroupGame[] => {
  const byKey = new Map<string, GroupGame>();
  for (const { owner, games } of collections) {
    for (const game of games) {
      const key = normalize(game.name.trim());
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          name: game.name.trim(),
          image: game.image || '',
          playtime: game.playtime,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          owners: [owner],
        });
        continue;
      }
      if (!existing.owners.some((o) => o.id === owner.id)) existing.owners.push(owner);
      if (!existing.image && game.image) existing.image = game.image;
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
  );
};

// Busca pelo nome do jogo ou de quem o tem
export const searchGroupGames = (games: GroupGame[], text: string): GroupGame[] => {
  const query = normalize(text.trim());
  if (!query) return games;
  return games.filter(
    (g) => g.key.includes(query) || g.owners.some((o) => normalize(o.name).includes(query)),
  );
};
