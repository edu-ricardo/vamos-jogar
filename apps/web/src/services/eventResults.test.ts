import { describe, it, expect } from 'vitest';
import {
  countChoices,
  countDateVotes,
  countGamePoints,
  countGameVotes,
  findLeaders,
  moveGameVote,
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

describe('countGamePoints (ranking)', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('1º vale tantos pontos quanto jogos sugeridos, o 2º um a menos, e assim por diante', () => {
    expect(countGamePoints(ids, { ana: ['c', 'a'] })).toEqual({ c: 4, a: 3 });
  });

  it('soma os pontos de todas as pessoas; jogo não marcado fica sem pontos', () => {
    expect(countGamePoints(ids, { ana: ['c', 'a'], bia: ['a', 'c', 'b'], caio: ['b'] })).toEqual({
      c: 4 + 3,
      a: 3 + 4,
      b: 2 + 4,
    });
  });

  it('a ordem importa: o mesmo conjunto em outra ordem dá outro resultado', () => {
    expect(countGamePoints(ids, { ana: ['a', 'b'] })).not.toEqual(
      countGamePoints(ids, { ana: ['b', 'a'] }),
    );
  });

  it('ignora ids que não são sugestões e repetições na lista da pessoa', () => {
    expect(countGamePoints(['a', 'b'], { ana: ['removido', 'b', 'b', 'a'] })).toEqual({
      b: 2,
      a: 1,
    });
  });

  it('sem votos, ninguém pontua', () => {
    expect(countGamePoints(ids, {})).toEqual({});
    expect(countGamePoints(ids, undefined)).toEqual({});
  });
});

describe('rankGameOptions por pontos', () => {
  const opt = (id: string) => ({ id, name: id, thumb: '', suggesterId: 'ana' });

  it('o jogo mais bem posicionado vence mesmo com menos votos', () => {
    const ranked = rankGameOptions([opt('a'), opt('b'), opt('c')], {
      ana: ['b', 'a'],
      bia: ['b', 'a'],
      caio: ['a', 'c', 'b'],
    });

    // a: 2+2+3 = 7 pontos (3 votos); b: 3+3+1 = 7 pontos (3 votos): empate total, ordem de sugestão
    expect(ranked.map((r) => [r.game.id, r.points, r.votes])).toEqual([
      ['a', 7, 3],
      ['b', 7, 3],
      ['c', 2, 1],
    ]);
  });

  it('um favorito de poucos pode passar um marcado de muitos como último', () => {
    const ranked = rankGameOptions([opt('a'), opt('b')], {
      ana: ['b', 'a'],
      bia: ['b'],
      caio: ['a'],
    });

    // b: 2+2 = 4 (2 votos); a: 1+2 = 3 (2 votos)
    expect(ranked.map((r) => [r.game.id, r.points])).toEqual([
      ['b', 4],
      ['a', 3],
    ]);
  });

  it('com pontos iguais, quem tem mais votos fica na frente (e depois a ordem de sugestão)', () => {
    // 4 jogos (1º lugar = 4 pontos, 2º = 3, 3º = 2, 4º = 1):
    // x: um 1º lugar = 4 pontos, 1 voto. y: dois 3º lugares = 2 + 2 = 4 pontos, 2 votos.
    // z e w: 4 + 3 = 7 pontos cada, 2 votos.
    const ranked = rankGameOptions([opt('x'), opt('y'), opt('z'), opt('w')], {
      ana: ['x'],
      bia: ['z', 'w', 'y'],
      caio: ['w', 'z', 'y'],
    });

    expect(ranked.map((r) => [r.game.id, r.points, r.votes])).toEqual([
      ['z', 7, 2],
      ['w', 7, 2],
      ['y', 4, 2],
      ['x', 4, 1],
    ]);
  });
});

describe('moveGameVote', () => {
  it('sobe e desce um jogo trocando de lugar com o vizinho', () => {
    expect(moveGameVote(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveGameVote(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('nas pontas, ou com jogo que não está na lista, não muda nada', () => {
    const list = ['a', 'b', 'c'];
    expect(moveGameVote(list, 'a', -1)).toBe(list);
    expect(moveGameVote(list, 'c', 1)).toBe(list);
    expect(moveGameVote(list, 'x', 1)).toBe(list);
  });

  it('não altera a lista original', () => {
    const list = ['a', 'b'];
    moveGameVote(list, 'a', 1);
    expect(list).toEqual(['a', 'b']);
  });
});
