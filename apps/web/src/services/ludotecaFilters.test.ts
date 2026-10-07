import { describe, it, expect } from 'vitest';
import { filterCollection, parsePlaytime, sortCollection } from './ludotecaFilters';
import type { Game } from './ludotecaService';

const game = (name: string, extra: Partial<Game> = {}): Game => ({
  id: name,
  sourceId: name,
  name,
  image: '',
  ...extra,
});

const catan = game('Catan', { playtime: '60', minPlayers: 3, maxPlayers: 4 });
const duel = game('7 Wonders Duel', { playtime: '30', minPlayers: 2, maxPlayers: 2 });
const mars = game('Terraforming Mars', { playtime: '90-120', minPlayers: '1', maxPlayers: '5' });
const unknown = game('Sem dados');
const all = [catan, duel, mars, unknown];

describe('parsePlaytime', () => {
  it('lê minutos, faixas (usa o maior) e ignora o que não é número', () => {
    expect(parsePlaytime('60')).toBe(60);
    expect(parsePlaytime('90-120')).toBe(120);
    expect(parsePlaytime('45 min')).toBe(45);
    expect(parsePlaytime('')).toBeUndefined();
    expect(parsePlaytime(undefined)).toBeUndefined();
  });
});

describe('filterCollection', () => {
  it('sem filtros devolve tudo', () => {
    expect(filterCollection(all, {})).toEqual(all);
  });

  it('busca pelo nome sem diferenciar maiúsculas e acentos', () => {
    expect(filterCollection(all, { text: 'mars' })).toEqual([mars]);
    expect(filterCollection([game('Ação')], { text: 'acao' })).toHaveLength(1);
  });

  it('jogadores: só jogos que comportam a quantidade (aceita número em texto)', () => {
    expect(filterCollection(all, { players: 2 })).toEqual([duel, mars]);
    expect(filterCollection(all, { players: 5 })).toEqual([mars]);
  });

  it('duração máxima em minutos; jogo sem duração fica de fora', () => {
    expect(filterCollection(all, { maxPlaytime: 60 })).toEqual([catan, duel]);
    expect(filterCollection(all, { maxPlaytime: 30 })).toEqual([duel]);
  });

  it('combina os filtros', () => {
    expect(filterCollection(all, { players: 3, maxPlaytime: 60 })).toEqual([catan]);
  });
});

describe('sortCollection', () => {
  const zeta = game('Zeta', { playtime: '30', minPlayers: 2, maxPlayers: 4 });
  const alfa = game('alfa', { playtime: '90-120', minPlayers: 1, maxPlayers: 5 });
  const beta = game('Beta', { playtime: '30', minPlayers: 2, maxPlayers: 2 });
  const sem = game('Sem dados');
  const all = [zeta, alfa, beta, sem];

  it('ordem de adição mantém a lista como veio, sem alterar a original', () => {
    const sorted = sortCollection(all, 'added');
    expect(sorted).toEqual(all);
    expect(sorted).not.toBe(all);
  });

  it('mais recentes inverte a ordem de adição', () => {
    expect(sortCollection(all, 'recent').map((g) => g.name)).toEqual([
      'Sem dados',
      'Beta',
      'alfa',
      'Zeta',
    ]);
  });

  it('nome: alfabética sem diferenciar maiúsculas e acentos', () => {
    expect(
      sortCollection([game('Ótimo'), game('zebra'), game('Alfa')], 'name').map((g) => g.name),
    ).toEqual(['Alfa', 'Ótimo', 'zebra']);
  });

  it('mais rápidos primeiro: faixa vale o maior tempo, empate por nome e sem duração por último', () => {
    expect(sortCollection(all, 'playtime').map((g) => g.name)).toEqual([
      'Beta',
      'Zeta',
      'alfa',
      'Sem dados',
    ]);
  });

  it('mais jogadores primeiro: pelo máximo, empate por nome e sem dado por último', () => {
    expect(sortCollection(all, 'players').map((g) => g.name)).toEqual([
      'alfa',
      'Zeta',
      'Beta',
      'Sem dados',
    ]);
  });
});
