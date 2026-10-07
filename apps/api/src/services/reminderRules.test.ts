import { describe, it, expect } from 'vitest';
import {
  dateVotesByUser,
  datesOfVote,
  describeReminderOutcome,
  getPendingVoterIds,
  isReminderDue,
  REMINDER_INTERVAL_MS,
} from './reminderRules';

describe('getPendingVoterIds', () => {
  const members = ['ana', 'bia', 'caio'];

  it('retorna quem não votou na data durante VOTING_DATE', () => {
    const event = {
      status: 'VOTING_DATE',
      votesDate: { ana: ['d1', 'd2'] },
      votesGames: { bia: ['g1'] },
    };
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

describe('describeReminderOutcome', () => {
  it('avisa quando todo mundo já votou', () => {
    expect(describeReminderOutcome(0, 0)).toBe('Todo mundo já votou.');
  });

  it('informa quantos foram avisados e lembra de quem não ativou as notificações', () => {
    expect(describeReminderOutcome(2, 2)).toBe(
      'Notificação enviada para 2 de 2 pessoa(s) que ainda não votaram.',
    );
    expect(describeReminderOutcome(3, 1)).toBe(
      'Notificação enviada para 1 de 3 pessoa(s) que ainda não votaram. Quem não ativou as notificações não recebe.',
    );
  });
});

describe('datesOfVote', () => {
  it('usa a lista de datas quando existe', () => {
    expect(datesOfVote({ dateOptionIds: ['d1', 'd2'], dateOptionId: 'd1' })).toEqual(['d1', 'd2']);
  });

  it('em voto da versão anterior, usa a data única', () => {
    expect(datesOfVote({ dateOptionId: 'd2' })).toEqual(['d2']);
    expect(datesOfVote({ dateOptionIds: [], dateOptionId: 'd2' })).toEqual(['d2']);
  });

  it('sem data nenhuma, lista vazia', () => {
    expect(datesOfVote({})).toEqual([]);
    expect(datesOfVote({ dateOptionIds: [], dateOptionId: '' })).toEqual([]);
  });
});

describe('dateVotesByUser', () => {
  it('lista as datas de quem já marcou alguma e ignora voto vazio ou sem dono', () => {
    expect(
      dateVotesByUser([
        { user: 'ana', dateOptionIds: ['d1', 'd2'] },
        { user: 'bia', dateOptionId: 'd3' },
        { user: 'caio', dateOptionIds: [], dateOptionId: '' },
        { user: '', dateOptionIds: ['d1'] },
      ]),
    ).toEqual({ ana: ['d1', 'd2'], bia: ['d3'] });
  });
});
