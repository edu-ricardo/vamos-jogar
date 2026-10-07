import { backend } from './backend';
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

export type AttendanceStatus = 'yes' | 'no' | 'maybe';

// Resposta de um membro do grupo à pergunta "você vai?"; null = ainda não respondeu
export interface AttendanceAnswer {
  userId: string;
  name: string;
  status: AttendanceStatus | null;
}

// Avisos que o app pede à API depois de uma ação do organizador
export type AnnounceKind = 'created' | 'date_set' | 'confirmed';

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
  ...backend.events,

  // Avisa o grupo por notificação. Nunca atrapalha a ação que o originou: falha só vai ao console
  // (a API recusa o que já foi avisado, não é organizador ou está fora da etapa).
  notifyGroup: async (eventId: string, kind: AnnounceKind, idToken: string): Promise<void> => {
    try {
      await apiRequest(`/api/events/${eventId}/announce`, {
        method: 'POST',
        idToken,
        body: { kind },
        fallbackError: 'Erro ao avisar o grupo.',
      });
    } catch (err) {
      console.warn('Aviso ao grupo não enviado:', err);
    }
  },

  getAttendance: async (eventId: string, idToken: string): Promise<AttendanceAnswer[]> =>
    (
      await apiRequest<{ answers: AttendanceAnswer[] }>(`/api/events/${eventId}/attendance`, {
        idToken,
        fallbackError: 'Erro ao carregar as presenças.',
      })
    ).answers,

  setAttendance: (eventId: string, status: AttendanceStatus, idToken: string) =>
    apiRequest(`/api/events/${eventId}/attendance`, {
      method: 'PUT',
      idToken,
      body: { status },
      fallbackError: 'Erro ao salvar a sua resposta.',
    }),

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
