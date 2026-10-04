import { describe, it, expect } from 'vitest';
import { countGameVotes, rankGameOptions } from './eventResults';

const game = (id: string) => ({ id, name: id, thumb: '', suggesterId: 'ana' });

describe('countGameVotes', () => {
  it('soma os votos de todos os membros por jogo', () => {
    expect(countGameVotes({ ana: ['a', 'b'], bia: ['b'] })).toEqual({ a: 1, b: 2 });
  });

  it('retorna vazio sem votos', () => {
    expect(countGameVotes(undefined)).toEqual({});
  });
});

describe('rankGameOptions', () => {
  it('ordena do mais votado e mantém jogos sem voto com zero', () => {
    const ranked = rankGameOptions([game('a'), game('b'), game('c')], {
      ana: ['b'],
      bia: ['b', 'c'],
    });
    expect(ranked.map((r) => [r.game.id, r.votes])).toEqual([
      ['b', 2],
      ['c', 1],
      ['a', 0],
    ]);
  });

  it('em empate mantém a ordem de sugestão', () => {
    const ranked = rankGameOptions([game('a'), game('b')], { ana: ['b'], bia: ['a'] });
    expect(ranked.map((r) => r.game.id)).toEqual(['a', 'b']);
  });
});
