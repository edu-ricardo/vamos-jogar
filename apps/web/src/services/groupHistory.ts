import type { Event, EventDateOption, EventLocationOption } from './eventService';
import { normalize } from './ludotecaFilters';

// "2026-10-11" no relógio de quem está usando o app (não em UTC)
export const todayLocal = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export const finalDateOf = (event: Event): EventDateOption | undefined =>
  event.dateOptions.find((d) => d.id === event.finalDateId);

export const finalLocationOf = (event: Event): EventLocationOption | undefined =>
  event.locationOptions.find((l) => l.id === event.finalLocationId);

// Já aconteceu: a data definida ficou para trás. Evento sem data definida ainda está em aberto.
export const isPastEvent = (event: Event, today: string): boolean => {
  const date = finalDateOf(event)?.date;
  return !!date && date < today;
};

// Próximos mantêm a ordem recebida; passados vêm do mais recente para o mais antigo
export const splitEvents = (
  events: Event[],
  today: string,
): { upcoming: Event[]; past: Event[] } => ({
  upcoming: events.filter((e) => !isPastEvent(e, today)),
  past: events
    .filter((e) => isPastEvent(e, today))
    .sort((a, b) => (finalDateOf(b)?.date ?? '').localeCompare(finalDateOf(a)?.date ?? '')),
});

export interface PlayedGame {
  name: string;
  thumb: string;
  // Em quantas jogatinas foi para a mesa
  times: number;
  // Data (YYYY-MM-DD) da última vez
  lastDate: string;
}

// Jogos que foram para a mesa em jogatinas confirmadas que já aconteceram, do mais ao menos
// jogado (empate: o mais recente primeiro). O mesmo jogo é unido pelo nome.
export const rankPlayedGames = (events: Event[], today: string): PlayedGame[] => {
  const byName = new Map<string, PlayedGame>();
  for (const event of events) {
    if (event.status !== 'CONFIRMED' || !isPastEvent(event, today)) continue;
    const date = finalDateOf(event)!.date;
    for (const game of event.gameOptions ?? []) {
      if (!event.finalGameIds?.includes(game.id)) continue;
      const key = normalize(game.name.trim());
      const played = byName.get(key);
      if (!played) {
        byName.set(key, { name: game.name, thumb: game.thumb, times: 1, lastDate: date });
        continue;
      }
      played.times += 1;
      if (date > played.lastDate) played.lastDate = date;
      if (!played.thumb && game.thumb) played.thumb = game.thumb;
    }
  }
  return [...byName.values()].sort(
    (a, b) =>
      b.times - a.times || b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name),
  );
};

// Nomes dos jogos que foram para a mesa de um evento confirmado
export const tableGameNames = (event: Event): string[] =>
  (event.gameOptions ?? []).filter((g) => event.finalGameIds?.includes(g.id)).map((g) => g.name);

// "11/10/2026 às 14:00 · Casa do Edu" (vazio enquanto a data não foi definida)
export const eventWhen = (event: Event): string => {
  const date = finalDateOf(event);
  if (!date) return '';
  const [year, month, day] = date.date.split('-');
  const location = finalLocationOf(event);
  return `${day}/${month}/${year} às ${date.startTime}${location ? ` · ${location.name}` : ''}`;
};
