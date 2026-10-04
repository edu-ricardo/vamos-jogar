import { db } from '../lib/firebase';
import { apiRequest } from './apiClient';
import { createFirebaseEventRepository } from './firebase/eventRepository';

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

// Acesso aos dados de eventos e locais favoritos; a implementação atual é o Firestore
export interface EventRepository {
  createEvent(
    groupId: string,
    creatorId: string,
    title: string,
    dateOptions: EventDateOption[],
    locationOptions: EventLocationOption[],
  ): Promise<string>;
  fetchGroupEvents(groupId: string): Promise<Event[]>;
  getEventDetails(groupId: string, eventId: string): Promise<Event>;
  voteDateLocation(
    groupId: string,
    eventId: string,
    userId: string,
    dateOptionId: string,
    locationOptionId: string,
  ): Promise<void>;
  fetchFavoriteLocations(uid: string): Promise<FavoriteLocation[]>;
  saveFavoriteLocation(uid: string, location: Omit<FavoriteLocation, 'id'>): Promise<void>;
  deleteEvent(groupId: string, eventId: string): Promise<void>;
  updateEvent(
    groupId: string,
    eventId: string,
    title: string,
    dateOptions: EventDateOption[],
    locationOptions: EventLocationOption[],
  ): Promise<void>;
  advanceToGamesVoting(
    groupId: string,
    eventId: string,
    finalDateId: string,
    finalLocationId: string,
  ): Promise<void>;
  suggestGames(groupId: string, eventId: string, games: EventGameOption[]): Promise<void>;
  confirmEvent(groupId: string, eventId: string, finalGameIds: string[]): Promise<void>;
  voteGames(groupId: string, eventId: string, userId: string, gameIds: string[]): Promise<void>;
}

export const eventService = {
  ...createFirebaseEventRepository(db),

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
