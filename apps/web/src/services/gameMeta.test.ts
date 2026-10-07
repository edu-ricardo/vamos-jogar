import { describe, expect, it } from 'vitest';
import { gameMeta } from './gameMeta';

describe('gameMeta', () => {
  it('junta duração e jogadores', () => {
    expect(gameMeta({ playtime: '60', minPlayers: 3, maxPlayers: 4 })).toBe('⏱ 60 min · 👥 3-4');
  });

  it('jogadores fixos aparecem sem faixa', () => {
    expect(gameMeta({ minPlayers: 2, maxPlayers: 2 })).toBe('👥 2');
    expect(gameMeta({ minPlayers: '2' })).toBe('👥 2');
  });

  it('só o máximo conhecido mostra ? no mínimo', () => {
    expect(gameMeta({ maxPlayers: 5 })).toBe('👥 ?-5');
  });

  it('só um dos dados, ou nenhum', () => {
    expect(gameMeta({ playtime: '45' })).toBe('⏱ 45 min');
    expect(gameMeta({})).toBe('');
  });
});
