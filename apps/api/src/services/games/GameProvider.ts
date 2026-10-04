export type GameType = 'base' | 'expansion';

export interface GameSummary {
  id: string;
  sourceId: string | number;
  name: string;
  image: string;
}

export interface GameDetails extends GameSummary {
  description: string;
  playtime: string | number;
  minPlayers: string | number | null;
  maxPlayers: string | number | null;
}

export interface GameSearchParams {
  query?: string;
  gameType: GameType;
  baseGameId?: string;
}

// Cada catálogo externo (Ludopedia, BGG...) implementa esta interface; uma fonte nova é uma classe nova
export interface GameProvider {
  search(params: GameSearchParams): Promise<GameSummary[]>;
  getDetails(id: string): Promise<GameDetails | null>;
}

export type HttpGet = (url: string, headers?: Record<string, string>) => Promise<{ data: any }>;
