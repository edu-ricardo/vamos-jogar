import type { PushMessage } from './pushService';

// Avisos que a tela pede depois de uma ação do organizador (cada um sai uma única vez por evento)
export const ANNOUNCE_KINDS = ['created', 'date_set', 'confirmed'] as const;
export type AnnounceKind = (typeof ANNOUNCE_KINDS)[number];

export const isAnnounceKind = (value: unknown): value is AnnounceKind =>
  (ANNOUNCE_KINDS as readonly string[]).includes(value as string);

// Em que etapa o evento precisa estar para o aviso fazer sentido
export const STATUS_FOR_KIND: Record<AnnounceKind, string> = {
  created: 'VOTING_DATE',
  date_set: 'VOTING_GAMES',
  confirmed: 'CONFIRMED',
};

const HOUR_MS = 60 * 60 * 1000;

// Lembrete da véspera: de 24 horas antes até o começo da jogatina
export const isInEveWindow = (start: Date, now: Date): boolean => {
  const untilStart = start.getTime() - now.getTime();
  return untilStart > 0 && untilStart <= 24 * HOUR_MS;
};

// "2026-10-11" → "11/10"
const shortDate = (date: string) => date.split('-').reverse().slice(0, 2).join('/');

export interface EventForMessage {
  id: string;
  title: string;
  group: string;
  groupName: string;
  // Só depois que data e local foram definidos
  date?: string;
  startTime?: string;
  locationName?: string;
  address?: string;
}

const eventUrl = (event: EventForMessage) => `/event/${event.group}/${event.id}`;
const whenAndWhere = (event: EventForMessage) =>
  `${shortDate(event.date ?? '')} às ${event.startTime} · ${event.locationName}`;

export const announceMessage = (kind: AnnounceKind, event: EventForMessage): PushMessage => {
  const base = { url: eventUrl(event), tag: `evento-${event.id}-${kind}` };
  if (kind === 'created') {
    return {
      ...base,
      title: `Evento novo: ${event.title}`,
      body: `${event.groupName}: vote na data e no local.`,
    };
  }
  if (kind === 'date_set') {
    return {
      ...base,
      title: `Data definida: ${event.title}`,
      body: `${whenAndWhere(event)}. Confirme se você vai e vote nos jogos.`,
    };
  }
  return {
    ...base,
    title: `Jogatina confirmada: ${event.title}`,
    body: `${whenAndWhere(event)}. Os jogos da mesa já estão definidos.`,
  };
};

// "Amanhã" quando a jogatina é no dia seguinte; "Hoje" quando já é no mesmo dia
export const eveMessage = (event: EventForMessage, sameDay: boolean): PushMessage => ({
  title: `${sameDay ? 'Hoje' : 'Amanhã'} tem jogatina: ${event.title}`,
  body: `${event.startTime} · ${event.locationName} (${event.address})`,
  url: eventUrl(event),
  tag: `evento-${event.id}-eve`,
});
