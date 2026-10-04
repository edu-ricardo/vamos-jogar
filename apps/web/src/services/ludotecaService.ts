import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from './apiClient';

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

export const ludotecaService = {
  fetchUserCollection: async (uid: string): Promise<Game[]> => {
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'collection'));
      return snap.docs.map((doc) => doc.data() as Game);
    } catch (err) {
      console.error('Erro ao buscar coleção no Firestore:', err);
      throw err;
    }
  },

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

  addGameToCollection: async (uid: string, game: Game): Promise<void> => {
    try {
      await setDoc(doc(db, 'users', uid, 'collection', game.id), game);
    } catch (err) {
      console.error('Erro ao salvar jogo na coleção:', err);
      throw err;
    }
  },

  removeGameFromCollection: async (uid: string, gameId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'collection', gameId));
    } catch (err) {
      console.error('Erro ao remover jogo da coleção:', err);
      throw err;
    }
  },
};
