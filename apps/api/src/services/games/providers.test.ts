import { describe, it, expect, vi } from 'vitest';
import { LudopediaProvider } from './LudopediaProvider';
import { BggProvider } from './BggProvider';

describe('LudopediaProvider', () => {
  const setup = (data: unknown) => {
    const httpGet = vi.fn().mockResolvedValue({ data });
    return { httpGet, provider: new LudopediaProvider(httpGet, () => 'tok') };
  };

  it('busca jogos base com token e mapeia os campos', async () => {
    const { httpGet, provider } = setup({
      jogos: [{ id_jogo: 7, nm_jogo: 'Catan', thumb: 't.jpg', link_imagem: 'i.jpg' }],
    });

    const games = await provider.search({ query: 'catan vs', gameType: 'base' });

    expect(httpGet).toHaveBeenCalledWith(
      'https://ludopedia.com.br/api/v1/jogos?tp_jogo=b&search=catan%20vs',
      { Authorization: 'Bearer tok' },
    );
    expect(games).toEqual([{ id: 'ludo-7', sourceId: 7, name: 'Catan', image: 't.jpg' }]);
  });

  it('busca expansões pelo jogo base', async () => {
    const { httpGet, provider } = setup({ jogos: [] });
    await provider.search({ gameType: 'expansion', baseGameId: '7' });
    expect(httpGet.mock.calls[0][0]).toBe(
      'https://ludopedia.com.br/api/v1/jogos?tp_jogo=e&id_jogo_base=7',
    );
  });

  it('detalhes removem o prefixo e usam padrões quando faltam campos', async () => {
    const { httpGet, provider } = setup({ jogo: { id_jogo: 7, nm_jogo: 'Catan', thumb: 't.jpg' } });

    const game = await provider.getDetails('ludo-7');

    expect(httpGet.mock.calls[0][0]).toBe('https://ludopedia.com.br/api/v1/jogos/7');
    expect(game).toEqual({
      id: 'ludo-7',
      sourceId: 7,
      name: 'Catan',
      image: 't.jpg',
      description: '',
      playtime: 'N/A',
      minPlayers: null,
      maxPlayers: null,
    });
  });
});

describe('BggProvider', () => {
  const setup = (xml: string) => {
    const httpGet = vi.fn().mockResolvedValue({ data: xml });
    return { httpGet, provider: new BggProvider(httpGet) };
  };

  it('busca no tipo certo e aceita um ou vários nomes', async () => {
    const { httpGet, provider } = setup(
      `<items>
        <item id="13"><name type="primary" value="Catan"/><name value="Colonizadores"/></item>
        <item id="14"><name type="primary" value="Azul"/></item>
      </items>`,
    );

    const games = await provider.search({ query: 'cat', gameType: 'expansion' });

    expect(httpGet.mock.calls[0][0]).toBe(
      'https://boardgamegeek.com/xmlapi2/search?query=cat&type=boardgameexpansion',
    );
    expect(games).toEqual([
      { id: 'bgg-13', sourceId: '13', name: 'Catan', image: '' },
      { id: 'bgg-14', sourceId: '14', name: 'Azul', image: '' },
    ]);
  });

  it('busca sem texto retorna vazio sem chamar o BGG', async () => {
    const { httpGet, provider } = setup('');
    expect(await provider.search({ gameType: 'expansion', baseGameId: '13' })).toEqual([]);
    expect(httpGet).not.toHaveBeenCalled();
  });

  // Atributos do XML chegam como texto: é o que o app recebe hoje
  it('detalhes mapeiam imagem, tempo e jogadores', async () => {
    const { provider } = setup(
      `<items><item id="13">
        <name type="primary" value="Catan"/>
        <image>img.jpg</image><description>Troca</description>
        <playingtime value="90"/><minplayers value="3"/><maxplayers value="4"/>
      </item></items>`,
    );

    expect(await provider.getDetails('bgg-13')).toEqual({
      id: 'bgg-13',
      sourceId: '13',
      name: 'Catan',
      image: 'img.jpg',
      description: 'Troca',
      playtime: '90',
      minPlayers: '3',
      maxPlayers: '4',
    });
  });

  it('detalhes de jogo inexistente retornam null', async () => {
    const { provider } = setup('<items></items>');
    expect(await provider.getDetails('bgg-999')).toBeNull();
  });
});
