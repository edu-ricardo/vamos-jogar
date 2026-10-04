import { describe, it, expect } from 'vitest';
import { getPendingVoterIds, isReminderDue, REMINDER_INTERVAL_MS } from './reminderRules';

describe('getPendingVoterIds', () => {
  const members = ['ana', 'bia', 'caio'];

  it('retorna quem não votou na data durante VOTING_DATE', () => {
    const event = { status: 'VOTING_DATE', votesDate: { ana: 'd1' }, votesGames: { bia: ['g1'] } };
    expect(getPendingVoterIds(members, event)).toEqual(['bia', 'caio']);
  });

  it('retorna quem não votou nos jogos durante VOTING_GAMES', () => {
    const event = {
      status: 'VOTING_GAMES',
      votesDate: { ana: 'd1', bia: 'd1', caio: 'd1' },
      votesGames: { bia: ['g1'] },
    };
    expect(getPendingVoterIds(members, event)).toEqual(['ana', 'caio']);
  });

  it('considera todos pendentes quando ainda não há mapa de votos', () => {
    expect(getPendingVoterIds(members, { status: 'VOTING_DATE' })).toEqual(members);
  });

  it('não cobra ninguém em evento confirmado', () => {
    expect(getPendingVoterIds(members, { status: 'CONFIRMED' })).toEqual([]);
  });
});

describe('isReminderDue', () => {
  const now = new Date('2026-10-03T12:00:00Z');

  it('envia quando nunca houve lembrete', () => {
    expect(isReminderDue(undefined, now)).toBe(true);
  });

  it('não envia antes de 3 dias', () => {
    const lastSent = new Date(now.getTime() - REMINDER_INTERVAL_MS + 60_000);
    expect(isReminderDue(lastSent, now)).toBe(false);
  });

  it('envia a partir de 3 dias', () => {
    const lastSent = new Date(now.getTime() - REMINDER_INTERVAL_MS);
    expect(isReminderDue(lastSent, now)).toBe(true);
  });
});
