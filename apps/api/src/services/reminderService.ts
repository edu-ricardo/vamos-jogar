import type PocketBase from 'pocketbase/cjs';
import type { PushMessage } from './pushService';
import {
  dateVotesByUser,
  getPendingVoterIds,
  isReminderDue,
  reminderMessage,
} from './reminderRules';

// A versão CommonJS do SDK não exporta o tipo RecordModel
type RecordModel = { id: string; [field: string]: any };

export interface ReminderOutcome {
  // Quem ainda não votou
  pending: number;
  // Quantos desses receberam a notificação em ao menos um aparelho
  notified: number;
}

export type ForceReminderResult =
  | ({ ok: true } & ReminderOutcome)
  | { ok: false; reason: 'EVENT_NOT_FOUND' | 'FORBIDDEN' | 'EVENT_CONFIRMED' };

// Cobrança feita por admin do app: não depende de ser criador do evento ou admin do grupo
export type AdminReminderResult =
  ({ ok: true } & ReminderOutcome) | { ok: false; reason: 'EVENT_NOT_FOUND' | 'EVENT_CONFIRMED' };

type NotifyUsers = (userIds: string[], message: PushMessage) => Promise<number>;

// O PocketBase devolve datas como "2026-10-04 03:00:00.000Z"
const parseDate = (value: string) => (value ? new Date(value.replace(' ', 'T')) : undefined);

export const createReminderService = (getAdmin: () => Promise<PocketBase>, notify: NotifyUsers) => {
  // event precisa vir com expand do grupo
  const remindPendingVoters = async (
    pb: PocketBase,
    event: RecordModel,
  ): Promise<ReminderOutcome> => {
    const group = event.expand!.group;
    const [memberships, votes] = await Promise.all([
      pb
        .collection('memberships')
        .getFullList({ filter: pb.filter('group = {:groupId}', { groupId: group.id }) }),
      pb
        .collection('votes')
        .getFullList({ filter: pb.filter('event = {:eventId}', { eventId: event.id }) }),
    ]);

    const votesFrom = (field: string) =>
      Object.fromEntries(votes.filter((v) => v.user && v[field]).map((v) => [v.user, v[field]]));
    const pendingIds = getPendingVoterIds(
      memberships.map((m) => m.user),
      {
        status: event.status,
        votesDate: dateVotesByUser(votes),
        votesGames: votesFrom('gameIds'),
      },
    );

    const notified = await notify(
      pendingIds,
      reminderMessage({
        id: event.id,
        title: event.title,
        status: event.status,
        group: group.id,
        groupName: group.name,
      }),
    );
    await pb
      .collection('events')
      .update(event.id, { lastReminderSentAt: new Date().toISOString() });
    return { pending: pendingIds.length, notified };
  };

  return {
    // Chamado pelo agendador: no máximo um lembrete a cada 3 dias por evento.
    // Devolve quantas pessoas foram avisadas no total.
    processScheduledReminders: async (now: Date = new Date()): Promise<number> => {
      const pb = await getAdmin();
      const openEvents = await pb.collection('events').getFullList({
        filter: "status = 'VOTING_DATE' || status = 'VOTING_GAMES'",
        expand: 'group',
      });

      let notified = 0;
      for (const event of openEvents) {
        if (!isReminderDue(parseDate(event.lastReminderSentAt), now)) continue;
        notified += (await remindPendingVoters(pb, event)).notified;
      }
      return notified;
    },

    // Chamado pelo painel de admin do app
    remindEventAsAppAdmin: async (eventId: string): Promise<AdminReminderResult> => {
      const pb = await getAdmin();
      const [event] = await pb.collection('events').getFullList({
        filter: pb.filter('id = {:eventId}', { eventId }),
        expand: 'group',
      });
      if (!event) return { ok: false, reason: 'EVENT_NOT_FOUND' };
      if (event.status === 'CONFIRMED') return { ok: false, reason: 'EVENT_CONFIRMED' };
      return { ok: true, ...(await remindPendingVoters(pb, event)) };
    },

    // Chamado pelo botão "Cobrar Atrasados": só o criador do evento ou o admin do grupo
    sendRemindersForEvent: async (
      groupId: string,
      eventId: string,
      requesterUid: string,
    ): Promise<ForceReminderResult> => {
      const pb = await getAdmin();
      const [event] = await pb.collection('events').getFullList({
        filter: pb.filter('id = {:eventId} && group = {:groupId}', { eventId, groupId }),
        expand: 'group',
      });
      if (!event) return { ok: false, reason: 'EVENT_NOT_FOUND' };

      if (requesterUid !== event.creator && requesterUid !== event.expand!.group.admin) {
        return { ok: false, reason: 'FORBIDDEN' };
      }
      if (event.status === 'CONFIRMED') return { ok: false, reason: 'EVENT_CONFIRMED' };

      return { ok: true, ...(await remindPendingVoters(pb, event)) };
    },
  };
};
