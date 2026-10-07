import { describe, expect, it } from 'vitest';
import {
  describeCountdown,
  displayDateOf,
  isActiveEvent,
  nextEntry,
  pendingActions,
  upcomingEntries,
  type DashboardEntry,
} from './dashboardInsights';
import type { Event } from './eventService';

const TODAY = '2026-10-10';

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id,
  groupId: 'g1',
  creatorId: 'u-ana',
  title: `Evento ${id}`,
  status: 'VOTING_DATE',
  dateOptions: [{ id: 'd1', date: '2026-10-20', startTime: '19:00' }],
  locationOptions: [{ id: 'l1', name: 'Casa', address: 'Rua A' }],
  votesDate: {},
  votesLocation: {},
  createdAt: '',
  ...extra,
});

const defined = (id: string, date: string, time = '19:00', extra: Partial<Event> = {}): Event =>
  event(id, {
    status: 'CONFIRMED',
    dateOptions: [{ id: 'd1', date, startTime: time }],
    finalDateId: 'd1',
    finalLocationId: 'l1',
    ...extra,
  });

const entry = (e: Event, groupName = 'Sexta'): DashboardEntry => ({
  event: e,
  groupId: 'g1',
  groupName,
});

describe('isActiveEvent / displayDateOf', () => {
  it('com data definida vale de hoje em diante; ontem não', () => {
    expect(isActiveEvent(defined('a', '2026-10-10'), TODAY)).toBe(true);
    expect(isActiveEvent(defined('b', '2026-10-09'), TODAY)).toBe(false);
  });

  it('em votação vale enquanto alguma opção de data não passou', () => {
    const e = event('c', {
      dateOptions: [
        { id: 'd1', date: '2026-10-01', startTime: '19:00' },
        { id: 'd2', date: '2026-10-15', startTime: '19:00' },
      ],
    });
    expect(isActiveEvent(e, TODAY)).toBe(true);
    expect(displayDateOf(e, TODAY)?.id).toBe('d2');
    expect(
      isActiveEvent(
        event('d', { dateOptions: [{ id: 'd1', date: '2026-10-01', startTime: '19:00' }] }),
        TODAY,
      ),
    ).toBe(false);
  });

  it('a data definida tem prioridade sobre as opções', () => {
    expect(displayDateOf(defined('e', '2026-11-02'), TODAY)?.date).toBe('2026-11-02');
  });
});

describe('upcomingEntries / nextEntry', () => {
  const entries = [
    entry(defined('depois', '2026-10-25')),
    entry(event('votando')),
    entry(defined('passado', '2026-10-01')),
    entry(defined('primeiro', '2026-10-12', '18:00')),
    entry(defined('mesmo-dia', '2026-10-12', '20:00')),
  ];

  it('só os que valem, do mais próximo ao mais distante (mesmo dia: pela hora)', () => {
    expect(upcomingEntries(entries, TODAY).map((e) => e.event.id)).toEqual([
      'primeiro',
      'mesmo-dia',
      'votando',
      'depois',
    ]);
  });

  it('a próxima jogatina é a mais próxima com data definida (votação não conta)', () => {
    expect(nextEntry(entries, TODAY)?.event.id).toBe('primeiro');
    expect(nextEntry([entry(event('so-votando'))], TODAY)).toBeUndefined();
    expect(nextEntry([], TODAY)).toBeUndefined();
  });
});

describe('describeCountdown', () => {
  const at = (iso: string) => new Date(iso);

  it('hoje, antes de começar: horas ou minutos que faltam', () => {
    expect(describeCountdown('2026-10-10', '19:00', at('2026-10-10T16:00:00'))).toEqual({
      label: 'Hoje às 19:00 · em 3h',
      urgency: 'today',
    });
    expect(describeCountdown('2026-10-10', '19:00', at('2026-10-10T18:20:00'))).toEqual({
      label: 'Hoje às 19:00 · em 40 min',
      urgency: 'today',
    });
  });

  it('hoje, depois de começar', () => {
    expect(describeCountdown('2026-10-10', '19:00', at('2026-10-10T21:00:00'))).toEqual({
      label: 'Acontecendo hoje',
      urgency: 'now',
    });
  });

  it('amanhã, na semana e mais adiante', () => {
    const now = at('2026-10-10T10:00:00');
    expect(describeCountdown('2026-10-11', '14:00', now)).toEqual({
      label: 'Amanhã às 14:00',
      urgency: 'tomorrow',
    });
    expect(describeCountdown('2026-10-14', '14:00', now)).toEqual({
      label: 'Em 4 dias · quarta-feira às 14:00',
      urgency: 'soon',
    });
    expect(describeCountdown('2026-10-24', '14:00', now)).toEqual({
      label: 'Em 14 dias · 24/10',
      urgency: 'later',
    });
  });

  it('usa o dia do relógio local, mesmo à noite', () => {
    expect(describeCountdown('2026-10-11', '09:00', at('2026-10-10T23:30:00')).urgency).toBe(
      'tomorrow',
    );
  });
});

describe('pendingActions', () => {
  it('pede o voto de data a quem ainda não votou e não pede a quem já votou', () => {
    const entries = [entry(event('a')), entry(event('b', { votesDate: { 'u-edu': ['d1'] } }))];

    expect(pendingActions(entries, 'u-edu', TODAY).map((a) => [a.eventId, a.kind])).toEqual([
      ['a', 'vote_date'],
    ]);
  });

  it('pede os jogos só quando já há jogos sugeridos e a pessoa ainda não votou neles', () => {
    const games = [{ id: 'g1', name: 'Catan', thumb: '', suggesterId: 'u-ana' }];
    const entries = [
      entry(defined('sem-jogos', '2026-10-20', '19:00', { status: 'VOTING_GAMES' })),
      entry(
        defined('com-jogos', '2026-10-21', '19:00', { status: 'VOTING_GAMES', gameOptions: games }),
      ),
      entry(
        defined('ja-votou', '2026-10-22', '19:00', {
          status: 'VOTING_GAMES',
          gameOptions: games,
          votesGames: { 'u-edu': ['g1'] },
        }),
      ),
    ];

    expect(pendingActions(entries, 'u-edu', TODAY).map((a) => [a.eventId, a.kind])).toEqual([
      ['com-jogos', 'vote_games'],
    ]);
  });

  it('cobra a presença só dos eventos consultados em que a pessoa não respondeu', () => {
    const entries = [
      entry(defined('sem-resposta', '2026-10-20')),
      entry(defined('respondeu', '2026-10-21')),
      entry(defined('nao-consultado', '2026-10-22')),
    ];

    expect(
      pendingActions(entries, 'u-edu', TODAY, { 'sem-resposta': null, respondeu: 'yes' }).map(
        (a) => [a.eventId, a.kind],
      ),
    ).toEqual([['sem-resposta', 'rsvp']]);
  });

  it('ignora eventos que já passaram e ordena por data e depois pelo tipo', () => {
    const games = [{ id: 'g1', name: 'Catan', thumb: '', suggesterId: 'u-ana' }];
    const entries = [
      entry(
        defined('passado', '2026-10-01', '19:00', { status: 'VOTING_GAMES', gameOptions: games }),
      ),
      entry(
        defined('tarde', '2026-10-30', '19:00', { status: 'VOTING_GAMES', gameOptions: games }),
      ),
      entry(event('cedo', { dateOptions: [{ id: 'd1', date: '2026-10-12', startTime: '19:00' }] })),
    ];

    expect(pendingActions(entries, 'u-edu', TODAY).map((a) => a.eventId)).toEqual([
      'cedo',
      'tarde',
    ]);
  });

  it('traz o grupo, o título e o texto de cada ação', () => {
    const [action] = pendingActions([entry(event('a'), 'Família')], 'u-edu', TODAY);

    expect(action).toEqual({
      key: 'a-vote_date',
      kind: 'vote_date',
      eventId: 'a',
      groupId: 'g1',
      groupName: 'Família',
      title: 'Evento a',
      label: 'Votar na data e no local',
    });
  });

  it('um evento pode pedir mais de uma coisa (data confirmada: jogos e presença)', () => {
    const games = [{ id: 'g1', name: 'Catan', thumb: '', suggesterId: 'u-ana' }];
    const entries = [
      entry(defined('x', '2026-10-20', '19:00', { status: 'VOTING_GAMES', gameOptions: games })),
    ];

    expect(pendingActions(entries, 'u-edu', TODAY, { x: null }).map((a) => a.kind)).toEqual([
      'vote_games',
      'rsvp',
    ]);
  });
});
