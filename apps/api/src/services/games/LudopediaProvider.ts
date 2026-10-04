import type {
  GameDetails,
  GameProvider,
  GameSearchParams,
  GameSummary,
  HttpGet,
} from './GameProvider';

const BASE_URL = 'https://ludopedia.com.br/api/v1';

export class LudopediaProvider implements GameProvider {
  constructor(
    private readonly httpGet: HttpGet,
    private readonly getToken: () => string | undefined,
  ) {}

  private authHeaders() {
    return { Authorization: `Bearer ${this.getToken()}` };
  }

  async search({ query, gameType, baseGameId }: GameSearchParams): Promise<GameSummary[]> {
    const ludopediaTipo = gameType === 'expansion' ? 'e' : 'b';

    let url = `${BASE_URL}/jogos?tp_jogo=${ludopediaTipo}`;
    if (query) url += `&search=${encodeURIComponent(query)}`;
    if (baseGameId) url += `&id_jogo_base=${baseGameId}`;

    const response = await this.httpGet(url, this.authHeaders());

    return (response.data.jogos || []).map((jogo: any) => ({
      id: `ludo-${jogo.id_jogo}`,
      sourceId: jogo.id_jogo,
      name: jogo.nm_jogo,
      image: jogo.thumb || jogo.link_imagem || '',
    }));
  }

  async getDetails(id: string): Promise<GameDetails | null> {
    const cleanId = id.replace('ludo-', '');
    const response = await this.httpGet(`${BASE_URL}/jogos/${cleanId}`, this.authHeaders());
    const jogo = response.data.jogo || response.data;

    return {
      id: `ludo-${jogo.id_jogo}`,
      sourceId: jogo.id_jogo,
      name: jogo.nm_jogo,
      image: jogo.link_imagem || jogo.thumb || '',
      description: jogo.ds_jogo || '',
      playtime: jogo.vl_tempo_jogo || 'N/A',
      minPlayers: jogo.qt_jogadores_min || null,
      maxPlayers: jogo.qt_jogadores_max || null,
    };
  }
}
