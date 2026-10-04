import { describe, it, expect } from 'vitest';
import { planGroupDeparture } from './accountRules';

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
