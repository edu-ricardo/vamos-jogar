import { collection, doc, setDoc, deleteDoc, getDocs, type Firestore } from 'firebase/firestore';
import type { Game, LudotecaRepository } from '../ludotecaService';

export const createFirebaseLudotecaRepository = (db: Firestore): LudotecaRepository => ({
  fetchUserCollection: async (uid: string): Promise<Game[]> => {
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'collection'));
      return snap.docs.map((doc) => doc.data() as Game);
    } catch (err) {
      console.error('Erro ao buscar coleção no Firestore:', err);
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
});
