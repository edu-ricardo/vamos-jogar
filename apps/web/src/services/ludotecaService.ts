import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Game {
  id: string;
  sourceId: string;
  name: string;
  image: string;
  description?: string;
  playtime?: string;
  observation?: string;
}

export const ludotecaService = {
  fetchUserCollection: async (uid: string): Promise<Game[]> => {
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'collection'));
      return snap.docs.map(doc => doc.data() as Game);
    } catch (err) {
      console.error("Erro ao buscar coleção no Firestore:", err);
      throw err;
    }
  },

  searchExternalGames: async (query: string, source: 'ludopedia' | 'bgg', idToken: string): Promise<Game[]> => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/games/search?query=${encodeURIComponent(query)}&source=${source}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na busca');
      return data.games || [];
    } catch (err) {
      console.error("Erro na busca de jogos via API externa:", err);
      throw err;
    }
  },

  getGameDetails: async (id: string, source: 'ludopedia' | 'bgg', idToken: string): Promise<Game> => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/games/details/${id}?source=${source}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar detalhes');
      return data.game;
    } catch (err) {
      console.error("Erro ao buscar detalhes do jogo via API externa:", err);
      throw err;
    }
  },

  addGameToCollection: async (uid: string, game: Game): Promise<void> => {
    try {
      await setDoc(doc(db, 'users', uid, 'collection', game.id), game);
    } catch (err) {
      console.error("Erro ao salvar jogo na coleção:", err);
      throw err;
    }
  },

  removeGameFromCollection: async (uid: string, gameId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'collection', gameId));
    } catch (err) {
      console.error("Erro ao remover jogo da coleção:", err);
      throw err;
    }
  }
};
