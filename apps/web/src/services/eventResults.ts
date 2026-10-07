import type { Event, EventGameOption } from './eventService';

export const EVENT_STATUS_LABEL: Record<Event['status'], string> = {
  VOTING_DATE: 'Votando data e local',
  VOTING_GAMES: 'Votando jogos',
  CONFIRMED: 'Confirmado',
};

export interface RankedGame {
  game: EventGameOption;
  // Quantas pessoas marcaram o jogo
  votes: number;
  // Pontos do ranking (veja countGamePoints)
  points: number;
}

export const countGameVotes = (votesGames: Record<string, string[]> = {}): Record<string, number> =>
  Object.values(votesGames)
    .flat()
    .reduce(
      (acc, gameId) => {
        acc[gameId] = (acc[gameId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

// Pontos de cada jogo no ranking: na lista de cada pessoa (a ordem é a preferência), o 1º vale
// tantos pontos quanto jogos sugeridos, o 2º um a menos, e assim por diante. Quem não foi marcado
// vale 0; ids de jogos que não estão entre as sugestões são ignorados.
export const countGamePoints = (
  gameIds: string[],
  votesGames: Record<string, string[]> = {},
): Record<string, number> => {
  const points: Record<string, number> = {};
  for (const list of Object.values(votesGames)) {
    const ranked = [...new Set(list)].filter((id) => gameIds.includes(id));
    ranked.forEach((id, position) => {
      points[id] = (points[id] || 0) + gameIds.length - position;
    });
  }
  return points;
};

// Jogos do que tem mais pontos ao que tem menos; empate de pontos fica com quem tem mais votos e,
// depois, com a ordem de sugestão
export const rankGameOptions = (
  gameOptions: EventGameOption[] = [],
  votesGames: Record<string, string[]> = {},
): RankedGame[] => {
  const counts = countGameVotes(votesGames);
  const points = countGamePoints(
    gameOptions.map((g) => g.id),
    votesGames,
  );
  return gameOptions
    .map((game) => ({ game, votes: counts[game.id] || 0, points: points[game.id] || 0 }))
    .sort((a, b) => b.points - a.points || b.votes - a.votes);
};

// Sobe (-1) ou desce (1) um jogo na ordem de preferência; nas pontas, não muda nada
export const moveGameVote = (gameIds: string[], gameId: string, direction: -1 | 1): string[] => {
  const from = gameIds.indexOf(gameId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= gameIds.length) return gameIds;
  const moved = [...gameIds];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
};

// Votos por opção de data ou local (cada pessoa escolhe uma opção)
export const countChoices = (votes: Record<string, string> = {}): Record<string, number> =>
  Object.values(votes).reduce(
    (acc, optionId) => {
      acc[optionId] = (acc[optionId] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

// Datas aceitam várias marcas por pessoa (como os jogos); a contagem é a mesma
export const countDateVotes = countGameVotes;

// Opções que lideram a votação: as de mais votos (todas, se empatarem). Sem nenhum voto, ninguém lidera.
export const findLeaders = (optionIds: string[], counts: Record<string, number>): string[] => {
  const top = Math.max(0, ...optionIds.map((id) => counts[id] || 0));
  return top > 0 ? optionIds.filter((id) => (counts[id] || 0) === top) : [];
};
