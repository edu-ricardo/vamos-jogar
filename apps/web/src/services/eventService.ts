import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from './apiClient';

export interface EventDateOption {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface EventLocationOption {
  id: string;
  name: string;
  address: string;
}

export interface FavoriteLocation {
  id?: string;
  name: string;
  address: string;
}

export interface EventGameOption {
  id: string; // The game's ID (e.g., Ludopedia ID or BGG ID)
  name: string;
  thumb: string;
  suggesterId: string; // User ID who suggested it
  suggesterName?: string; // Optional name to display
}

export interface Event {
  id?: string;
  groupId: string;
  creatorId: string;
  title: string;
  status: 'VOTING_DATE' | 'VOTING_GAMES' | 'CONFIRMED';
  dateOptions: EventDateOption[];
  locationOptions: EventLocationOption[];
  gameOptions?: EventGameOption[];
  finalDateId?: string;
  finalLocationId?: string;
  finalGameIds?: string[];
  votesDate: { [userId: string]: string }; // userId -> dateOption.id
  votesLocation: { [userId: string]: string }; // userId -> locationOption.id
  votesGames?: { [userId: string]: string[] }; // userId -> array of gameOption.id
  createdAt: any;
}

export const eventService = {
  createEvent: async (
    groupId: string,
    creatorId: string,
    title: string,
    dateOptions: EventDateOption[],
    locationOptions: EventLocationOption[],
  ): Promise<string> => {
    try {
      const eventRef = await addDoc(collection(db, `groups/${groupId}/events`), {
        groupId,
        creatorId,
        title,
        status: 'VOTING_DATE',
        dateOptions,
        locationOptions,
        gameOptions: [],
        votesDate: {},
        votesLocation: {},
        votesGames: {},
        createdAt: serverTimestamp(),
      });
      return eventRef.id;
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      throw err;
    }
  },

  fetchGroupEvents: async (groupId: string): Promise<Event[]> => {
    try {
      const q = query(collection(db, `groups/${groupId}/events`), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Event);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
      throw err;
    }
  },

  getEventDetails: async (groupId: string, eventId: string): Promise<Event> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) throw new Error('Evento não encontrado');
      return { id: snapshot.id, ...snapshot.data() } as Event;
    } catch (err) {
      console.error('Erro ao buscar detalhes do evento:', err);
      throw err;
    }
  },

  voteDateLocation: async (
    groupId: string,
    eventId: string,
    userId: string,
    dateOptionId: string,
    locationOptionId: string,
  ): Promise<void> => {
    try {
      // Atualiza só o voto deste usuário para não sobrescrever votos simultâneos
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      await updateDoc(docRef, {
        [`votesDate.${userId}`]: dateOptionId,
        [`votesLocation.${userId}`]: locationOptionId,
      });
    } catch (err) {
      console.error('Erro ao computar voto:', err);
      throw err;
    }
  },

  fetchFavoriteLocations: async (uid: string): Promise<FavoriteLocation[]> => {
    try {
      const snapshot = await getDocs(collection(db, `users/${uid}/favoriteLocations`));
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FavoriteLocation);
    } catch (err) {
      console.error('Erro ao buscar locais favoritos:', err);
      return [];
    }
  },

  saveFavoriteLocation: async (
    uid: string,
    location: Omit<FavoriteLocation, 'id'>,
  ): Promise<void> => {
    try {
      await addDoc(collection(db, `users/${uid}/favoriteLocations`), location);
    } catch (err) {
      console.error('Erro ao salvar local favorito:', err);
      throw err;
    }
  },

  deleteEvent: async (groupId: string, eventId: string): Promise<void> => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, `groups/${groupId}/events`, eventId));
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      throw err;
    }
  },

  updateEvent: async (
    groupId: string,
    eventId: string,
    title: string,
    dateOptions: EventDateOption[],
    locationOptions: EventLocationOption[],
  ): Promise<void> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      await updateDoc(docRef, {
        title,
        dateOptions,
        locationOptions,
      });
    } catch (err) {
      console.error('Erro ao atualizar evento:', err);
      throw err;
    }
  },

  advanceToGamesVoting: async (
    groupId: string,
    eventId: string,
    finalDateId: string,
    finalLocationId: string,
  ): Promise<void> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      await updateDoc(docRef, {
        status: 'VOTING_GAMES',
        finalDateId,
        finalLocationId,
      });
    } catch (err) {
      console.error('Erro ao avançar votação:', err);
      throw err;
    }
  },

  suggestGames: async (
    groupId: string,
    eventId: string,
    games: EventGameOption[],
  ): Promise<void> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      // Transação: se outra pessoa sugerir ao mesmo tempo, a leitura é refeita e nada se perde
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists()) throw new Error('Evento não encontrado');

        const existingGames: EventGameOption[] = snapshot.data().gameOptions || [];
        // Combine avoiding duplicates by game ID
        const newGamesMap = new Map(existingGames.map((g) => [g.id, g]));
        for (const g of games) {
          if (!newGamesMap.has(g.id)) {
            newGamesMap.set(g.id, g);
          }
        }

        transaction.update(docRef, {
          gameOptions: Array.from(newGamesMap.values()),
        });
      });
    } catch (err) {
      console.error('Erro ao sugerir jogos:', err);
      throw err;
    }
  },

  confirmEvent: async (groupId: string, eventId: string, finalGameIds: string[]): Promise<void> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      await updateDoc(docRef, {
        status: 'CONFIRMED',
        finalGameIds,
      });
    } catch (err) {
      console.error('Erro ao encerrar votação de jogos:', err);
      throw err;
    }
  },

  voteGames: async (
    groupId: string,
    eventId: string,
    userId: string,
    gameIds: string[],
  ): Promise<void> => {
    try {
      const docRef = doc(db, `groups/${groupId}/events`, eventId);
      await updateDoc(docRef, {
        [`votesGames.${userId}`]: gameIds,
      });
    } catch (err) {
      console.error('Erro ao votar em jogos:', err);
      throw err;
    }
  },

  forceReminders: async (
    groupId: string,
    eventId: string,
    idToken: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      return await apiRequest<{ success: boolean; message: string }>(
        '/api/cron/force-event-reminders',
        {
          method: 'POST',
          idToken,
          body: { groupId, eventId },
          fallbackError: 'Erro ao notificar atrasados',
        },
      );
    } catch (err) {
      console.error('Erro ao notificar:', err);
      throw err;
    }
  },
};
