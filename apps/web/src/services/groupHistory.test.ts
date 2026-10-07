import { describe, expect, it } from 'vitest';
import {
  eventWhen,
  isPastEvent,
  rankPlayedGames,
  splitEvents,
  tableGameNames,
  todayLocal,
} from './groupHistory';
import type { Event } from './eventService';

const TODAY = '2026-10-10';

const event = (id: string, date: string | null, extra: Partial<Event> = {}): Event => ({
  id,
  groupId: 'g1',
  creatorId: 'u1',
  title: `Evento ${id}`,
  status: date ? 'CONFIRMED' : 'VOTING_DATE',
  dateOptions: [{ id: 'd1', date: date ?? '2026-12-01', startTime: '19:00' }],
  locationOptions: [{ id: 'l1', name: 'Casa do Edu', address: 'Rua A' }],
  finalDateId: date ? 'd1' : undefined,
  finalLocationId: date ? 'l1' : undefined,
  votesDate: {},
  votesLocation: {},
  createdAt: '',
  ...extra,
});

const game = (id: string, name: string) => ({ id, name, thumb: '', suggesterId: 'u1' });

describe('todayLocal', () => {
  it('usa o dia do relógio local, com zeros à esquerda', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 9, 10, 0, 1))).toBe('2026-10-10');
  });
});

describe('isPastEvent / splitEvents', () => {
  it('passado é só o que tem data definida antes de hoje; o de hoje ainda não passou', () => {
    expect(isPastEvent(event('a', '2026-10-09'), TODAY)).toBe(true);
    expect(isPastEvent(event('b', '2026-10-10'), TODAY)).toBe(false);
    expect(isPastEvent(event('c', '2026-10-11'), TODAY)).toBe(false);
    expect(isPastEvent(event('d', null), TODAY)).toBe(false);
  });

  it('separa próximos e passados; passados do mais recente ao mais antigo', () => {
    const events = [
      event('antigo', '2026-08-01'),
      event('aberto', null),
      event('recente', '2026-10-01'),
      event('futuro', '2026-11-01'),
    ];

    const { upcoming, past } = splitEvents(events, TODAY);

    expect(upcoming.map((e) => e.id)).toEqual(['aberto', 'futuro']);
    expect(past.map((e) => e.id)).toEqual(['recente', 'antigo']);
  });
});

describe('rankPlayedGames', () => {
  const options = [game('c', 'Catan'), game('a', 'Azul'), game('w', 'Wingspan')];

  it('conta em quantas jogatinas passadas e confirmadas cada jogo foi para a mesa', () => {
    const ranked = rankPlayedGames(
      [
        event('1', '2026-08-01', { gameOptions: options, finalGameIds: ['c', 'a'] }),
        event('2', '2026-09-01', { gameOptions: options, finalGameIds: ['c'] }),
        event('3', '2026-10-05', { gameOptions: options, finalGameIds: ['c', 'w'] }),
      ],
      TODAY,
    );

    expect(ranked.map((g) => [g.name, g.times, g.lastDate])).toEqual([
      ['Catan', 3, '2026-10-05'],
      // Empate em 1 vez: o mais recente primeiro
      ['Wingspan', 1, '2026-10-05'],
      ['Azul', 1, '2026-08-01'],
    ]);
  });

  it('empate fica com o mais recente primeiro', () => {
    const ranked = rankPlayedGames(
      [
        event('1', '2026-08-01', { gameOptions: options, finalGameIds: ['a'] }),
        event('2', '2026-10-05', { gameOptions: options, finalGameIds: ['w'] }),
      ],
      TODAY,
    );

    expect(ranked.map((g) => g.name)).toEqual(['Wingspan', 'Azul']);
  });

  it('ignora o que não aconteceu: futuro, sem confirmar e jogos que não foram para a mesa', () => {
    const ranked = rankPlayedGames(
      [
        event('futuro', '2026-11-01', { gameOptions: options, finalGameIds: ['c'] }),
        event('aberto', null, { gameOptions: options, finalGameIds: ['c'] }),
        event('votando', '2026-09-01', {
          status: 'VOTING_GAMES',
          gameOptions: options,
          finalGameIds: ['c'],
        }),
        event('passado', '2026-09-02', { gameOptions: options, finalGameIds: ['a'] }),
      ],
      TODAY,
    );

    expect(ranked.map((g) => g.name)).toEqual(['Azul']);
  });

  it('une o mesmo jogo pelo nome, mesmo com ids de fontes diferentes', () => {
    const ranked = rankPlayedGames(
      [
        event('1', '2026-08-01', {
          gameOptions: [game('ludo-1', 'Ticket to Ride')],
          finalGameIds: ['ludo-1'],
        }),
        event('2', '2026-09-01', {
          gameOptions: [game('bgg-9', 'TICKET TO RIDE')],
          finalGameIds: ['bgg-9'],
        }),
      ],
      TODAY,
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ name: 'Ticket to Ride', times: 2, lastDate: '2026-09-01' });
  });

  it('sem eventos, lista vazia', () => {
    expect(rankPlayedGames([], TODAY)).toEqual([]);
  });
});

describe('tableGameNames / eventWhen', () => {
  it('lista só os jogos da mesa', () => {
    const e = event('1', '2026-08-01', {
      gameOptions: [game('c', 'Catan'), game('a', 'Azul')],
      finalGameIds: ['a'],
    });
    expect(tableGameNames(e)).toEqual(['Azul']);
    expect(tableGameNames(event('2', null))).toEqual([]);
  });

  it('data, hora e local; vazio sem data definida', () => {
    expect(eventWhen(event('1', '2026-10-11'))).toBe('11/10/2026 às 19:00 · Casa do Edu');
    expect(eventWhen(event('2', null))).toBe('');
  });
});
