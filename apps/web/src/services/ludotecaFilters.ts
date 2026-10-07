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

export type GameSort = 'added' | 'recent' | 'name' | 'playtime' | 'players';

export const GAME_SORT_LABELS: Record<GameSort, string> = {
  added: 'Ordem de adição',
  recent: 'Mais recentes',
  name: 'Nome (A–Z)',
  playtime: 'Mais rápidos primeiro',
  players: 'Mais jogadores primeiro',
};

const byName = (a: Game, b: Game) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

// Jogos sem o dado (duração, jogadores) vão para o fim; empates ficam em ordem alfabética
const byNumber =
  (value: (game: Game) => number | undefined, direction: 1 | -1) => (a: Game, b: Game) => {
    const x = value(a);
    const y = value(b);
    if (x === undefined && y === undefined) return byName(a, b);
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return x === y ? byName(a, b) : (x - y) * direction;
  };

const maxPlayersOf = (game: Game): number | undefined => {
  const max = Number(game.maxPlayers || game.minPlayers);
  return max > 0 ? max : undefined;
};

// A lista chega na ordem de adição (a mais antiga primeiro)
export const sortCollection = (games: Game[], sort: GameSort): Game[] => {
  const copy = [...games];
  if (sort === 'recent') return copy.reverse();
  if (sort === 'name') return copy.sort(byName);
  if (sort === 'playtime') return copy.sort(byNumber((g) => parsePlaytime(g.playtime), 1));
  if (sort === 'players') return copy.sort(byNumber(maxPlayersOf, -1));
  return copy;
};
