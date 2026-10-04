import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { Event, EventGameOption, EventRepository, FavoriteLocation } from '../eventService';

// No PocketBase votos e sugestões são coleções próprias; aqui elas voltam ao formato Event do app
const toEvent = (record: RecordModel, votes: RecordModel[], games: RecordModel[]): Event => {
  const votesDate: Record<string, string> = {};
  const votesLocation: Record<string, string> = {};
  const votesGames: Record<string, string[]> = {};
  for (const vote of votes) {
    if (vote.dateOptionId) votesDate[vote.user] = vote.dateOptionId;
    if (vote.locationOptionId) votesLocation[vote.user] = vote.locationOptionId;
    if (Array.isArray(vote.gameIds)) votesGames[vote.user] = vote.gameIds;
  }

  return {
    id: record.id,
    groupId: record.group,
    creatorId: record.creator,
    title: record.title,
    status: record.status,
    dateOptions: record.dateOptions || [],
    locationOptions: record.locationOptions || [],
    gameOptions: games.map((g): EventGameOption => ({
      id: g.gameId,
      name: g.name,
      thumb: g.thumb,
      suggesterId: g.suggester,
      suggesterName: g.suggesterName,
    })),
    finalDateId: record.finalDateId || undefined,
    finalLocationId: record.finalLocationId || undefined,
    finalGameIds: record.finalGameIds || undefined,
    votesDate,
    votesLocation,
    votesGames,
    createdAt: record.created,
  };
};

export const createPocketBaseEventRepository = (pb: PocketBase): EventRepository => {
  const relatedRecords = (eventFilter: string) =>
    Promise.all([
      pb.collection('votes').getFullList({ filter: eventFilter }),
      pb.collection('event_games').getFullList({ filter: eventFilter, sort: 'created' }),
    ]);

  // Um voto por pessoa e evento: atualiza o existente ou cria
  const upsertVote = async (eventId: string, userId: string, data: Record<string, unknown>) => {
    const existing = await pb.collection('votes').getFullList({
      filter: pb.filter('event = {:eventId} && user = {:userId}', { eventId, userId }),
    });
    if (existing.length > 0) {
      await pb.collection('votes').update(existing[0].id, data);
    } else {
      await pb.collection('votes').create({ event: eventId, user: userId, ...data });
    }
  };

  return {
    createEvent: async (groupId, creatorId, title, dateOptions, locationOptions) => {
      const record = await pb.collection('events').create({
        group: groupId,
        creator: creatorId,
        title,
        status: 'VOTING_DATE',
        dateOptions,
        locationOptions,
      });
      return record.id;
    },

    fetchGroupEvents: async (groupId) => {
      const events = await pb.collection('events').getFullList({
        filter: pb.filter('group = {:groupId}', { groupId }),
        sort: '-created',
      });
      const [votes, games] = await relatedRecords(
        pb.filter('event.group = {:groupId}', { groupId }),
      );
      return events.map((e) =>
        toEvent(
          e,
          votes.filter((v) => v.event === e.id),
          games.filter((g) => g.event === e.id),
        ),
      );
    },

    getEventDetails: async (_groupId, eventId) => {
      const event = await pb.collection('events').getOne(eventId);
      const [votes, games] = await relatedRecords(pb.filter('event = {:eventId}', { eventId }));
      return toEvent(event, votes, games);
    },

    voteDateLocation: (_groupId, eventId, userId, dateOptionId, locationOptionId) =>
      upsertVote(eventId, userId, { dateOptionId, locationOptionId }),

    voteGames: (_groupId, eventId, userId, gameIds) => upsertVote(eventId, userId, { gameIds }),

    fetchFavoriteLocations: async (uid) => {
      try {
        const records = await pb.collection('favorite_locations').getFullList({
          filter: pb.filter('owner = {:uid}', { uid }),
        });
        return records.map((r): FavoriteLocation => ({
          id: r.id,
          name: r.name,
          address: r.address,
        }));
      } catch (err) {
        console.error('Erro ao buscar locais favoritos:', err);
        return [];
      }
    },

    saveFavoriteLocation: async (uid, location) => {
      await pb.collection('favorite_locations').create({ owner: uid, ...location });
    },

    deleteEvent: async (_groupId, eventId) => {
      await pb.collection('events').delete(eventId);
    },

    updateEvent: async (_groupId, eventId, title, dateOptions, locationOptions) => {
      await pb.collection('events').update(eventId, { title, dateOptions, locationOptions });
    },

    advanceToGamesVoting: async (_groupId, eventId, finalDateId, finalLocationId) => {
      await pb
        .collection('events')
        .update(eventId, { status: 'VOTING_GAMES', finalDateId, finalLocationId });
    },

    // O índice único (evento, jogo) mantém só a primeira sugestão de cada jogo
    suggestGames: async (_groupId, eventId, games) => {
      for (const game of games) {
        try {
          await pb.collection('event_games').create({
            event: eventId,
            gameId: game.id,
            name: game.name,
            thumb: game.thumb,
            suggester: game.suggesterId,
            suggesterName: game.suggesterName,
          });
        } catch (err) {
          const alreadySuggested = await pb.collection('event_games').getFullList({
            filter: pb.filter('event = {:eventId} && gameId = {:gameId}', {
              eventId,
              gameId: game.id,
            }),
          });
          if (alreadySuggested.length === 0) throw err;
        }
      }
    },

    confirmEvent: async (_groupId, eventId, finalGameIds) => {
      await pb.collection('events').update(eventId, { status: 'CONFIRMED', finalGameIds });
    },
  };
};
