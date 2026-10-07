import { describe, expect, it } from 'vitest';
import { buildGroupGames, searchGroupGames } from './groupGames';
import type { Game } from './ludotecaService';

const game = (id: string, name: string, extra: Partial<Game> = {}): Game => ({
  id,
  sourceId: id,
  name,
  image: '',
  ...extra,
});

const ana = { id: 'ana', name: 'Ana' };
const bia = { id: 'bia', name: 'Bia' };
const caio = { id: 'caio', name: 'Caio' };

describe('buildGroupGames', () => {
  it('lista cada jogo uma vez, com quem tem, em ordem alfabética', () => {
    const games = buildGroupGames([
      { owner: ana, games: [game('1', 'Catan'), game('2', 'Azul')] },
      { owner: bia, games: [game('1', 'Catan')] },
      { owner: caio, games: [] },
    ]);

    expect(games.map((g) => [g.name, g.owners.map((o) => o.name)])).toEqual([
      ['Azul', ['Ana']],
      ['Catan', ['Ana', 'Bia']],
    ]);
  });

  it('junta o mesmo jogo de fontes diferentes, sem diferenciar acento, caixa e espaços', () => {
    const games = buildGroupGames([
      { owner: ana, games: [game('ludo-1', 'Ticket to Ride')] },
      { owner: bia, games: [game('bgg-9', ' TICKET to ride ')] },
      { owner: caio, games: [game('manual-x', 'Pão-de-ló')] },
      { owner: ana, games: [game('manual-y', 'pao-de-lo')] },
    ]);

    expect(games.map((g) => [g.name, g.owners.map((o) => o.name)])).toEqual([
      ['Pão-de-ló', ['Caio', 'Ana']],
      ['Ticket to Ride', ['Ana', 'Bia']],
    ]);
  });

  it('a mesma pessoa com duas cópias não aparece duas vezes', () => {
    const [catan] = buildGroupGames([
      { owner: ana, games: [game('1', 'Catan'), game('manual-1', 'catan')] },
    ]);

    expect(catan.owners).toEqual([ana]);
  });

  it('usa os dados e a imagem da primeira cópia que tiver imagem', () => {
    const [catan] = buildGroupGames([
      { owner: ana, games: [game('1', 'Catan', { playtime: '60', minPlayers: 3 })] },
      { owner: bia, games: [game('2', 'Catan', { image: 'capa.jpg', playtime: '90' })] },
    ]);

    expect(catan).toMatchObject({ image: 'capa.jpg', playtime: '60', minPlayers: 3 });
  });

  it('sem ludotecas ou com nome vazio, nada na lista', () => {
    expect(buildGroupGames([])).toEqual([]);
    expect(buildGroupGames([{ owner: ana, games: [game('1', '   ')] }])).toEqual([]);
  });
});

describe('searchGroupGames', () => {
  const games = buildGroupGames([
    { owner: ana, games: [game('1', 'Catan'), game('2', 'Azul')] },
    { owner: bia, games: [game('3', 'Código Secreto')] },
  ]);

  it('sem texto devolve tudo', () => {
    expect(searchGroupGames(games, '  ')).toEqual(games);
  });

  it('busca pelo nome do jogo, sem acento nem caixa', () => {
    expect(searchGroupGames(games, 'CODIGO').map((g) => g.name)).toEqual(['Código Secreto']);
  });

  it('busca também pelo nome de quem tem o jogo', () => {
    expect(searchGroupGames(games, 'ana').map((g) => g.name)).toEqual(['Azul', 'Catan']);
  });

  it('sem resultado devolve lista vazia', () => {
    expect(searchGroupGames(games, 'xyz')).toEqual([]);
  });
});
