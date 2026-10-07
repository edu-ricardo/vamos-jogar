import type { AttendanceStatus, Event, EventDateOption } from './eventService';
import { finalDateOf, todayLocal } from './groupHistory';

export interface DashboardEntry {
  event: Event;
  groupId: string;
  groupName: string;
}

// Ainda vale mostrar: com data definida, a de hoje em diante; em votação, enquanto alguma opção
// de data não tiver passado
export const isActiveEvent = (event: Event, today: string): boolean => {
  const final = finalDateOf(event);
  if (final) return final.date >= today;
  return event.dateOptions.some((d) => d.date >= today);
};

// A data que o app mostra: a definida ou, enquanto se vota, a primeira opção que ainda não passou
export const displayDateOf = (event: Event, today: string): EventDateOption | undefined =>
  finalDateOf(event) ??
  [...event.dateOptions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((d) => d.date >= today) ??
  event.dateOptions[0];

const startKey = (entry: DashboardEntry, today: string) => {
  const date = displayDateOf(entry.event, today);
  return `${date?.date ?? '9999-99-99'} ${date?.startTime ?? '00:00'}`;
};

// Eventos que ainda valem, do mais próximo ao mais distante
export const upcomingEntries = (entries: DashboardEntry[], today: string): DashboardEntry[] =>
  entries
    .filter((e) => isActiveEvent(e.event, today))
    .sort((a, b) => startKey(a, today).localeCompare(startKey(b, today)));

// A próxima jogatina com data definida
export const nextEntry = (entries: DashboardEntry[], today: string): DashboardEntry | undefined =>
  upcomingEntries(entries, today).find((e) => finalDateOf(e.event));

export type Urgency = 'now' | 'today' | 'tomorrow' | 'soon' | 'later';

const dayNumber = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

// "Amanhã às 19:00", "Hoje às 19:00 · em 3h", "Em 4 dias · sábado às 14:00"...
export const describeCountdown = (
  date: string,
  time: string,
  now: Date = new Date(),
): { label: string; urgency: Urgency } => {
  const days = dayNumber(date) - dayNumber(todayLocal(now));
  const start = new Date(`${date}T${time || '00:00'}:00`);

  if (days <= 0) {
    const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
    if (minutes <= 0) return { label: 'Acontecendo hoje', urgency: 'now' };
    const away = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h`;
    return { label: `Hoje às ${time} · em ${away}`, urgency: 'today' };
  }
  if (days === 1) return { label: `Amanhã às ${time}`, urgency: 'tomorrow' };
  if (days < 7) {
    const weekday = start.toLocaleDateString('pt-BR', { weekday: 'long' });
    return { label: `Em ${days} dias · ${weekday} às ${time}`, urgency: 'soon' };
  }
  const [, month, day] = date.split('-');
  return { label: `Em ${days} dias · ${day}/${month}`, urgency: 'later' };
};

export type PendingActionKind = 'vote_date' | 'vote_games' | 'rsvp';

export interface PendingAction {
  key: string;
  kind: PendingActionKind;
  eventId: string;
  groupId: string;
  groupName: string;
  title: string;
  label: string;
}

const ACTION_LABEL: Record<PendingActionKind, string> = {
  vote_date: 'Votar na data e no local',
  vote_games: 'Escolher os jogos',
  rsvp: 'Confirmar presença',
};

const ACTION_ORDER: PendingActionKind[] = ['vote_date', 'vote_games', 'rsvp'];

// O que a pessoa ainda precisa fazer nos eventos que valem: votar na data, escolher jogos (quando já
// há jogos sugeridos) e responder se vai. rsvp traz a resposta só dos eventos que foram consultados
// (null = ainda não respondeu); evento fora dessa lista não gera cobrança de presença.
export const pendingActions = (
  entries: DashboardEntry[],
  uid: string,
  today: string,
  rsvp: Record<string, AttendanceStatus | null> = {},
): PendingAction[] => {
  const actions: (PendingAction & { sort: string })[] = [];
  for (const entry of upcomingEntries(entries, today)) {
    const { event } = entry;
    const kinds: PendingActionKind[] = [];
    if (event.status === 'VOTING_DATE' && !event.votesDate[uid]) kinds.push('vote_date');
    if (event.status === 'VOTING_GAMES' && (event.gameOptions?.length ?? 0) > 0) {
      if (!event.votesGames?.[uid]) kinds.push('vote_games');
    }
    if (finalDateOf(event) && event.id && rsvp[event.id] === null) kinds.push('rsvp');

    for (const kind of kinds) {
      actions.push({
        key: `${event.id}-${kind}`,
        kind,
        eventId: event.id ?? '',
        groupId: entry.groupId,
        groupName: entry.groupName,
        title: event.title,
        label: ACTION_LABEL[kind],
        sort: `${startKey(entry, today)} ${ACTION_ORDER.indexOf(kind)}`,
      });
    }
  }
  return actions
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort: _sort, ...action }) => action);
};
