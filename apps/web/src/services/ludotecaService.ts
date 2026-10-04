import { db } from '../lib/firebase';
import { apiRequest } from './apiClient';
import { createFirebaseLudotecaRepository } from './firebase/ludotecaRepository';

export interface Game {
  id: string;
  sourceId: string;
  name: string;
  image: string;
  description?: string;
  playtime?: string;
  minPlayers?: number | string;
  maxPlayers?: number | string;
  observation?: string;
  expansions?: Game[];
}

export type GameSource = 'ludopedia' | 'bgg';

// A origem do jogo está no prefixo do id gerado pela API ('bgg-' ou 'ludo-')
export const getGameSource = (gameId: string): GameSource =>
  gameId.startsWith('bgg-') ? 'bgg' : 'ludopedia';

// Acesso à ludoteca de cada usuário; a implementação atual é o Firestore
export interface LudotecaRepository {
  fetchUserCollection(uid: string): Promise<Game[]>;
  addGameToCollection(uid: string, game: Game): Promise<void>;
  removeGameFromCollection(uid: string, gameId: string): Promise<void>;
}

export const ludotecaService = {
  ...createFirebaseLudotecaRepository(db),

  searchExternalGames: async (
    query: string,
    source: 'ludopedia' | 'bgg',
    idToken: string,
    gameType: 'base' | 'expansion' = 'base',
    baseGameId?: string,
  ): Promise<Game[]> => {
    try {
      let path = `/api/games/search?query=${encodeURIComponent(query)}&source=${source}&gameType=${gameType}`;
      if (baseGameId) path += `&baseGameId=${encodeURIComponent(baseGameId)}`;
      const data = await apiRequest<{ games?: Game[] }>(path, {
        idToken,
        fallbackError: 'Erro na busca',
      });
      return data.games || [];
    } catch (err) {
      console.error('Erro na busca de jogos via API externa:', err);
      throw err;
    }
  },

  getGameDetails: async (
    id: string,
    source: 'ludopedia' | 'bgg',
    idToken: string,
  ): Promise<Game> => {
    try {
      const data = await apiRequest<{ game: Game }>(`/api/games/details/${id}?source=${source}`, {
        idToken,
        fallbackError: 'Erro ao buscar detalhes',
      });
      return data.game;
    } catch (err) {
      console.error('Erro ao buscar detalhes do jogo via API externa:', err);
      throw err;
    }
  },
};
