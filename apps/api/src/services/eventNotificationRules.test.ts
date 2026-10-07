import { describe, expect, it } from 'vitest';
import {
  announceMessage,
  eveMessage,
  isAnnounceKind,
  isInEveWindow,
  STATUS_FOR_KIND,
} from './eventNotificationRules';

const event = {
  id: 'e1',
  title: 'Noite dos euros',
  group: 'g1',
  groupName: 'Sexta',
  date: '2026-10-11',
  startTime: '14:00',
  locationName: 'Casa do Edu',
  address: 'Rua das Flores, 100',
};

describe('announceMessage', () => {
  it('evento novo convida a votar e abre o evento', () => {
    expect(announceMessage('created', event)).toEqual({
      title: 'Evento novo: Noite dos euros',
      body: 'Sexta: vote na data e no local.',
      url: '/event/g1/e1',
      tag: 'evento-e1-created',
    });
  });

  it('data definida traz data, hora e local e pede a confirmação de presença', () => {
    expect(announceMessage('date_set', event)).toEqual({
      title: 'Data definida: Noite dos euros',
      body: '11/10 às 14:00 · Casa do Edu. Confirme se você vai e vote nos jogos.',
      url: '/event/g1/e1',
      tag: 'evento-e1-date_set',
    });
  });

  it('confirmada avisa que os jogos da mesa estão definidos', () => {
    expect(announceMessage('confirmed', event).body).toBe(
      '11/10 às 14:00 · Casa do Edu. Os jogos da mesa já estão definidos.',
    );
  });
});

describe('eveMessage', () => {
  it('diz "Amanhã" ou "Hoje" e leva o endereço', () => {
    expect(eveMessage(event, false)).toEqual({
      title: 'Amanhã tem jogatina: Noite dos euros',
      body: '14:00 · Casa do Edu (Rua das Flores, 100)',
      url: '/event/g1/e1',
      tag: 'evento-e1-eve',
    });
    expect(eveMessage(event, true).title).toBe('Hoje tem jogatina: Noite dos euros');
  });
});

describe('isInEveWindow', () => {
  const start = new Date('2026-10-11T17:00:00Z');

  it('vale a partir de 24 horas antes até o começo', () => {
    expect(isInEveWindow(start, new Date('2026-10-10T17:00:00Z'))).toBe(true);
    expect(isInEveWindow(start, new Date('2026-10-11T16:59:00Z'))).toBe(true);
  });

  it('não vale antes das 24 horas nem depois de começar', () => {
    expect(isInEveWindow(start, new Date('2026-10-10T16:59:00Z'))).toBe(false);
    expect(isInEveWindow(start, new Date('2026-10-11T17:00:00Z'))).toBe(false);
    expect(isInEveWindow(start, new Date('2026-10-12T00:00:00Z'))).toBe(false);
  });
});

describe('tipos de aviso', () => {
  it('só aceita os três avisos disparados pela tela, cada um ligado a uma etapa', () => {
    expect(isAnnounceKind('created')).toBe(true);
    expect(isAnnounceKind('eve')).toBe(false);
    expect(isAnnounceKind(undefined)).toBe(false);
    expect(STATUS_FOR_KIND).toEqual({
      created: 'VOTING_DATE',
      date_set: 'VOTING_GAMES',
      confirmed: 'CONFIRMED',
    });
  });
});
