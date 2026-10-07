import { describe, expect, it } from 'vitest';
import { isManualGame, newManualGameId } from './manualGame';

describe('jogo cadastrado à mão', () => {
  it('o id tem prefixo próprio e cada cadastro recebe um id diferente', () => {
    const ids = Array.from({ length: 50 }, () => newManualGameId());

    expect(ids.every((id) => id.startsWith('manual-'))).toBe(true);
    expect(new Set(ids).size).toBe(50);
  });

  it('reconhece só os ids manuais, não os da Ludopedia nem do BGG', () => {
    expect(isManualGame(newManualGameId())).toBe(true);
    expect(isManualGame('ludo-123')).toBe(false);
    expect(isManualGame('bgg-13')).toBe(false);
  });
});
