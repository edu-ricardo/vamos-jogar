import { describe, it, expect } from 'vitest';
import {
  countChoices,
  countDateVotes,
  countGameVotes,
  findLeaders,
  rankGameOptions,
} from './eventResults';

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

describe('countChoices', () => {
  it('conta quantas pessoas escolheram cada opção', () => {
    expect(countChoices({ ana: 'd1', bia: 'd1', caio: 'd2' })).toEqual({ d1: 2, d2: 1 });
    expect(countChoices(undefined)).toEqual({});
  });
});

describe('countDateVotes', () => {
  it('soma cada data marcada, mesmo quando a pessoa marca várias', () => {
    expect(countDateVotes({ ana: ['d1', 'd2'], bia: ['d1'], caio: ['d3'] })).toEqual({
      d1: 2,
      d2: 1,
      d3: 1,
    });
    expect(countDateVotes(undefined)).toEqual({});
  });
});

describe('findLeaders', () => {
  const ids = ['d1', 'd2', 'd3'];

  it('devolve a opção mais votada', () => {
    expect(findLeaders(ids, { d1: 1, d2: 3, d3: 2 })).toEqual(['d2']);
  });

  it('em empate devolve todas as empatadas, na ordem das opções', () => {
    expect(findLeaders(ids, { d3: 2, d1: 2, d2: 1 })).toEqual(['d1', 'd3']);
  });

  it('sem nenhum voto ninguém lidera (nem todas "empatadas em zero")', () => {
    expect(findLeaders(ids, {})).toEqual([]);
    expect(findLeaders([], { d1: 5 })).toEqual([]);
  });

  it('ignora votos em opções que não existem mais', () => {
    expect(findLeaders(['d1', 'd2'], { d1: 1, removida: 9 })).toEqual(['d1']);
  });
});
