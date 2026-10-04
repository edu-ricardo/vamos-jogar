import type PocketBase from 'pocketbase/cjs';
import { getAdminClient } from '../lib/pocketbase';
import { emailService } from './emailService';
import { getPendingVoterIds, isReminderDue } from './reminderRules';

// A versão CommonJS do SDK não exporta o tipo RecordModel
type RecordModel = { id: string; [field: string]: any };

export type ForceReminderResult =
  | { ok: true; sent: number }
  | { ok: false; reason: 'EVENT_NOT_FOUND' | 'FORBIDDEN' | 'EVENT_CONFIRMED' };

type SendReminder = (toEmail: string, eventTitle: string, groupName: string) => Promise<unknown>;

// O PocketBase devolve datas como "2026-10-04 03:00:00.000Z"
const parseDate = (value: string) => (value ? new Date(value.replace(' ', 'T')) : undefined);

export const createReminderService = (
  getAdmin: () => Promise<PocketBase>,
  sendReminder: SendReminder,
) => {
  // event precisa vir com expand do grupo
  const remindPendingVoters = async (pb: PocketBase, event: RecordModel): Promise<number> => {
    const group = event.expand!.group;
    const [memberships, votes] = await Promise.all([
      pb.collection('memberships').getFullList({
        filter: pb.filter('group = {:groupId}', { groupId: group.id }),
        expand: 'user',
      }),
      pb
        .collection('votes')
        .getFullList({ filter: pb.filter('event = {:eventId}', { eventId: event.id }) }),
    ]);

    const votesFrom = (field: string) =>
      Object.fromEntries(votes.filter((v) => v.user && v[field]).map((v) => [v.user, v[field]]));
    const pendingIds = new Set(
      getPendingVoterIds(
        memberships.map((m) => m.user),
        {
          status: event.status,
          votesDate: votesFrom('dateOptionId'),
          votesGames: votesFrom('gameIds'),
        },
      ),
    );
    const emails = memberships
      .filter((m) => pendingIds.has(m.user))
      .map((m) => m.expand?.user?.email as string | undefined)
      .filter((email): email is string => !!email);

    for (const email of emails) {
      await sendReminder(email, event.title, group.name || 'Grupo de Jogatina');
    }
    await pb
      .collection('events')
      .update(event.id, { lastReminderSentAt: new Date().toISOString() });
    return emails.length;
  };

  return {
    // Chamado pelo agendador: no máximo um lembrete a cada 3 dias por evento
    processScheduledReminders: async (now: Date = new Date()): Promise<number> => {
      const pb = await getAdmin();
      const openEvents = await pb.collection('events').getFullList({
        filter: "status = 'VOTING_DATE' || status = 'VOTING_GAMES'",
        expand: 'group',
      });

      let sent = 0;
      for (const event of openEvents) {
        if (!isReminderDue(parseDate(event.lastReminderSentAt), now)) continue;
        sent += await remindPendingVoters(pb, event);
      }
      return sent;
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

      return { ok: true, sent: await remindPendingVoters(pb, event) };
    },
  };
};

export const reminderService = createReminderService(
  getAdminClient,
  emailService.sendReminderEmail,
);
