import type { Game } from './ludotecaService';

export interface CollectionFilters {
  text?: string;
  // Quantidade de pessoas que vão jogar
  players?: number;
  // Duração máxima em minutos
  maxPlaytime?: number;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "60" → 60; "90-120" → 120 (vale o pior caso); vazio ou sem número → undefined
export const parsePlaytime = (playtime: string | undefined): number | undefined => {
  const numbers = (playtime ?? '').match(/\d+/g);
  return numbers ? Math.max(...numbers.map(Number)) : undefined;
};

const fitsPlayers = (game: Game, players: number) => {
  const min = Number(game.minPlayers);
  const max = Number(game.maxPlayers || game.minPlayers);
  return min > 0 && min <= players && players <= max;
};

export const filterCollection = (games: Game[], filters: CollectionFilters): Game[] => {
  const text = normalize(filters.text?.trim() ?? '');
  return games.filter((game) => {
    if (text && !normalize(game.name).includes(text)) return false;
    if (filters.players && !fitsPlayers(game, filters.players)) return false;
    if (filters.maxPlaytime) {
      const playtime = parsePlaytime(game.playtime);
      if (playtime === undefined || playtime > filters.maxPlaytime) return false;
    }
    return true;
  });
};
