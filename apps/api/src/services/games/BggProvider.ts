import { XMLParser } from 'fast-xml-parser';
import type {
  GameDetails,
  GameProvider,
  GameSearchParams,
  GameSummary,
  HttpGet,
} from './GameProvider';

const BASE_URL = 'https://boardgamegeek.com/xmlapi2';

const nameOf = (item: any) => (Array.isArray(item.name) ? item.name[0]?.value : item.name?.value);

export class BggProvider implements GameProvider {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  constructor(
    private readonly httpGet: HttpGet,
    private readonly getToken: () => string | undefined,
  ) {}

  // A XML API2 do BGG responde 401 sem o token da aplicação
  private authHeaders() {
    return { Authorization: `Bearer ${this.getToken()}` };
  }

  async search({ query, gameType }: GameSearchParams): Promise<GameSummary[]> {
    // O /search do BGG não aceita texto vazio; listar expansões pelo jogo base exigiria o /thing
    if (!query) return [];

    const bggType = gameType === 'expansion' ? 'boardgameexpansion' : 'boardgame';
    const response = await this.httpGet(
      `${BASE_URL}/search?query=${encodeURIComponent(query)}&type=${bggType}`,
      this.authHeaders(),
    );
    const data = this.parser.parse(response.data);

    let items = data.items?.item || [];
    if (!Array.isArray(items)) items = [items];

    return items.slice(0, 10).map((item: any) => ({
      id: `bgg-${item.id}`,
      sourceId: item.id,
      name: nameOf(item),
      image: '', // A busca básica do BGG XML2 não retorna thumb, pegaremos no details
    }));
  }

  async getDetails(id: string): Promise<GameDetails | null> {
    const cleanId = id.replace('bgg-', '');
    const response = await this.httpGet(`${BASE_URL}/thing?id=${cleanId}`, this.authHeaders());
    const item = this.parser.parse(response.data).items?.item;
    if (!item) return null;

    return {
      id: `bgg-${item.id}`,
      sourceId: item.id,
      name: nameOf(item),
      image: item.image || item.thumbnail || '',
      description: item.description || '',
      playtime: item.playingtime?.value || 'N/A',
      minPlayers: item.minplayers?.value || null,
      maxPlayers: item.maxplayers?.value || null,
    };
  }
}
