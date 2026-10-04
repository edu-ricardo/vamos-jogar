import { DocumentReference, DocumentData, FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../lib/firebase-admin';
import { emailService } from './emailService';
import { getPendingVoterIds, isReminderDue } from './reminderRules';

export type ForceReminderResult =
  | { ok: true; sent: number }
  | { ok: false; reason: 'GROUP_NOT_FOUND' | 'EVENT_NOT_FOUND' | 'FORBIDDEN' | 'EVENT_CONFIRMED' };

const fetchEmails = async (uids: string[]): Promise<string[]> => {
  if (uids.length === 0) return [];
  // getUsers aceita até 100 identificadores por chamada, suficiente para um grupo de jogatina
  const { users } = await auth.getUsers(uids.map((uid) => ({ uid })));
  return users.map((u) => u.email).filter((email): email is string => !!email);
};

const remindPendingVoters = async (
  groupData: DocumentData,
  eventRef: DocumentReference,
  eventData: DocumentData,
): Promise<number> => {
  const pendingIds = getPendingVoterIds(groupData.members || [], eventData);
  const emails = await fetchEmails(pendingIds);

  for (const email of emails) {
    await emailService.sendReminderEmail(
      email,
      eventData.title,
      groupData.name || 'Grupo de Jogatina',
    );
  }

  await eventRef.update({ lastReminderSentAt: FieldValue.serverTimestamp() });
  return emails.length;
};

export const reminderService = {
  // Chamado pelo agendador: envia no máximo um lembrete a cada 3 dias por evento
  processScheduledReminders: async (now: Date = new Date()): Promise<number> => {
    let sent = 0;
    const groupsSnapshot = await db.collection('groups').get();

    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      const openEvents = await groupDoc.ref
        .collection('events')
        .where('status', 'in', ['VOTING_DATE', 'VOTING_GAMES'])
        .get();

      for (const eventDoc of openEvents.docs) {
        const eventData = eventDoc.data();
        if (!isReminderDue(eventData.lastReminderSentAt?.toDate(), now)) continue;
        sent += await remindPendingVoters(groupData, eventDoc.ref, eventData);
      }
    }

    return sent;
  },

  // Chamado pelo botão "Cobrar Atrasados": só o criador do evento ou o admin do grupo
  sendRemindersForEvent: async (
    groupId: string,
    eventId: string,
    requesterUid: string,
  ): Promise<ForceReminderResult> => {
    const groupDoc = await db.doc(`groups/${groupId}`).get();
    if (!groupDoc.exists) return { ok: false, reason: 'GROUP_NOT_FOUND' };
    const groupData = groupDoc.data()!;

    const eventDoc = await db.doc(`groups/${groupId}/events/${eventId}`).get();
    if (!eventDoc.exists) return { ok: false, reason: 'EVENT_NOT_FOUND' };
    const eventData = eventDoc.data()!;

    if (requesterUid !== eventData.creatorId && requesterUid !== groupData.adminId) {
      return { ok: false, reason: 'FORBIDDEN' };
    }
    if (eventData.status === 'CONFIRMED') return { ok: false, reason: 'EVENT_CONFIRMED' };

    const sent = await remindPendingVoters(groupData, eventDoc.ref, eventData);
    return { ok: true, sent };
  },
};
