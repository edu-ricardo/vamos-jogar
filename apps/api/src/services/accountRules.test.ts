import { describe, it, expect } from 'vitest';
import { planGroupDeparture, isRecentLogin, RECENT_LOGIN_WINDOW_MS } from './accountRules';

describe('planGroupDeparture', () => {
  it('apaga o grupo quando a pessoa é o único membro', () => {
    expect(planGroupDeparture({ adminId: 'ana', members: ['ana'] }, 'ana')).toEqual({
      action: 'delete',
    });
  });

  it('transfere o admin para o membro mais antigo restante', () => {
    expect(planGroupDeparture({ adminId: 'ana', members: ['ana', 'bia', 'caio'] }, 'ana')).toEqual({
      action: 'leave',
      members: ['bia', 'caio'],
      adminId: 'bia',
    });
  });

  it('mantém o admin quando quem sai é um membro comum', () => {
    expect(planGroupDeparture({ adminId: 'ana', members: ['ana', 'bia', 'caio'] }, 'caio')).toEqual(
      {
        action: 'leave',
        members: ['ana', 'bia'],
        adminId: 'ana',
      },
    );
  });
});

describe('isRecentLogin', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const toSeconds = (ms: number) => Math.floor(ms / 1000);

  it('aceita login dentro da janela', () => {
    expect(isRecentLogin(toSeconds(now.getTime() - 60_000), now)).toBe(true);
  });

  it('recusa login fora da janela', () => {
    expect(isRecentLogin(toSeconds(now.getTime() - RECENT_LOGIN_WINDOW_MS - 1000), now)).toBe(
      false,
    );
  });
});
