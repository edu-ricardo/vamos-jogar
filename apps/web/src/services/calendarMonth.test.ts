import { describe, expect, it } from 'vitest';
import { buildMonthGrid, eventsByDay, monthLabel, shiftMonth } from './calendarMonth';
import type { Event } from './eventService';
import type { DashboardEntry } from './dashboardInsights';

describe('monthLabel / shiftMonth', () => {
  it('escreve o mês por extenso', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('outubro de 2026');
    expect(monthLabel({ year: 2027, month: 2 })).toBe('março de 2027');
  });

  it('avança e volta, virando o ano', () => {
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('buildMonthGrid', () => {
  it('outubro de 2026 (começa numa quinta): 5 semanas, completando com dias vizinhos', () => {
    const grid = buildMonthGrid({ year: 2026, month: 9 });

    expect(grid).toHaveLength(5);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0][0]).toEqual({ date: '2026-09-27', day: 27, inMonth: false });
    expect(grid[0][4]).toEqual({ date: '2026-10-01', day: 1, inMonth: true });
    expect(grid[4][6]).toEqual({ date: '2026-10-31', day: 31, inMonth: true });
  });

  it('fevereiro de 2026 começa num domingo e acaba num sábado: só 4 semanas, todas do mês', () => {
    const grid = buildMonthGrid({ year: 2026, month: 1 });

    expect(grid).toHaveLength(4);
    expect(grid.flat().every((cell) => cell.inMonth)).toBe(true);
    expect(grid[3][6].date).toBe('2026-02-28');
  });

  it('mês que precisa de 6 semanas', () => {
    // Março de 2025 começa num sábado e tem 31 dias
    expect(buildMonthGrid({ year: 2025, month: 2 })).toHaveLength(6);
  });

  it('virada de ano: dezembro termina com dias de janeiro', () => {
    const grid = buildMonthGrid({ year: 2026, month: 11 });
    const last = grid[grid.length - 1][6];

    expect(last).toEqual({ date: '2027-01-02', day: 2, inMonth: false });
  });

  it('cada dia aparece uma vez e em sequência', () => {
    const dates = buildMonthGrid({ year: 2026, month: 9 })
      .flat()
      .map((c) => c.date);

    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });
});

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id,
  groupId: 'g1',
  creatorId: 'u1',
  title: `Evento ${id}`,
  status: 'VOTING_DATE',
  dateOptions: [{ id: 'd1', date: '2026-10-20', startTime: '19:00' }],
  locationOptions: [{ id: 'l1', name: 'Casa', address: 'Rua A' }],
  votesDate: {},
  votesLocation: {},
  createdAt: '',
  ...extra,
});
const entry = (e: Event): DashboardEntry => ({ event: e, groupId: 'g1', groupName: 'Sexta' });

describe('eventsByDay', () => {
  it('evento com data definida aparece só no dia definido, como confirmado', () => {
    const e = event('a', {
      status: 'CONFIRMED',
      dateOptions: [
        { id: 'd1', date: '2026-10-20', startTime: '19:00' },
        { id: 'd2', date: '2026-10-22', startTime: '14:00' },
      ],
      finalDateId: 'd2',
    });

    const days = eventsByDay([entry(e)]);

    expect(Object.keys(days)).toEqual(['2026-10-22']);
    expect(days['2026-10-22'][0]).toMatchObject({ kind: 'confirmed', startTime: '14:00' });
  });

  it('evento em votação aparece em cada opção de data, como opção', () => {
    const e = event('b', {
      dateOptions: [
        { id: 'd1', date: '2026-10-20', startTime: '19:00' },
        { id: 'd2', date: '2026-10-22', startTime: '14:00' },
      ],
    });

    const days = eventsByDay([entry(e)]);

    expect(Object.keys(days).sort()).toEqual(['2026-10-20', '2026-10-22']);
    expect(days['2026-10-20'][0].kind).toBe('option');
  });

  it('vários eventos no mesmo dia ficam em ordem de horário', () => {
    const late = event('tarde', {
      status: 'CONFIRMED',
      dateOptions: [{ id: 'd1', date: '2026-10-20', startTime: '20:00' }],
      finalDateId: 'd1',
    });
    const early = event('cedo', {
      status: 'CONFIRMED',
      dateOptions: [{ id: 'd1', date: '2026-10-20', startTime: '09:00' }],
      finalDateId: 'd1',
    });

    const days = eventsByDay([entry(late), entry(early)]);

    expect(days['2026-10-20'].map((d) => d.entry.event.id)).toEqual(['cedo', 'tarde']);
  });

  it('sem eventos, nenhum dia', () => {
    expect(eventsByDay([])).toEqual({});
  });
});
