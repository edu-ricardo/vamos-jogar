import { describe, expect, it } from 'vitest';
import { localDate, zonedTime } from './timezone';

describe('zonedTime', () => {
  it('converte o relógio de Brasília (UTC-3) para o instante real', () => {
    expect(zonedTime('2026-10-11', '14:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-11T17:00:00.000Z',
    );
    expect(zonedTime('2026-10-11', '23:30', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-12T02:30:00.000Z',
    );
  });

  it('em UTC o relógio é o próprio instante', () => {
    expect(zonedTime('2026-10-11', '14:00', 'UTC').toISOString()).toBe('2026-10-11T14:00:00.000Z');
  });

  it('respeita horário de verão do fuso', () => {
    expect(zonedTime('2026-07-01', '12:00', 'America/New_York').toISOString()).toBe(
      '2026-07-01T16:00:00.000Z',
    );
    expect(zonedTime('2026-01-15', '12:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    );
  });
});

describe('localDate', () => {
  it('devolve o dia do fuso, mesmo quando em UTC já é o dia seguinte', () => {
    const lateEvening = new Date('2026-10-11T01:30:00Z');
    expect(localDate(lateEvening, 'America/Sao_Paulo')).toBe('2026-10-10');
    expect(localDate(lateEvening, 'UTC')).toBe('2026-10-11');
  });
});
