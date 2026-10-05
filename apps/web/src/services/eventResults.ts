import type { Event, EventGameOption } from './eventService';

export const EVENT_STATUS_LABEL: Record<Event['status'], string> = {
  VOTING_DATE: 'Votando data e local',
  VOTING_GAMES: 'Votando jogos',
  CONFIRMED: 'Confirmado',
};

export interface RankedGame {
  game: EventGameOption;
  votes: number;
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

// Jogos do mais ao menos votado; empates mantêm a ordem de sugestão
export const rankGameOptions = (
  gameOptions: EventGameOption[] = [],
  votesGames: Record<string, string[]> = {},
): RankedGame[] => {
  const counts = countGameVotes(votesGames);
  return gameOptions
    .map((game) => ({ game, votes: counts[game.id] || 0 }))
    .sort((a, b) => b.votes - a.votes);
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
