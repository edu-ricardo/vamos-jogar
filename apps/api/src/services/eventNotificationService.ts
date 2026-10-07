import type PocketBase from 'pocketbase/cjs';
import type { PushMessage } from './pushService';
import type { NotificationKind } from './notificationPrefs';
import {
  announceMessage,
  eveMessage,
  isInEveWindow,
  STATUS_FOR_KIND,
  type AnnounceKind,
  type EventForMessage,
} from './eventNotificationRules';
import { localDate, zonedTime } from './timezone';

// A versão CommonJS do SDK não exporta o tipo RecordModel
type RecordModel = { id: string; [field: string]: any };

// Envia a mensagem às pessoas do tipo de aviso informado (já respeitando as preferências delas)
type NotifyUsers = (userIds: string[], message: PushMessage) => Promise<number>;

export type AnnounceResult =
  | { ok: true; recipients: number; notified: number }
  | { ok: false; reason: 'EVENT_NOT_FOUND' | 'FORBIDDEN' | 'WRONG_STATE' | 'ALREADY_SENT' };

// event precisa vir com expand do grupo
const toMessageDetails = (event: RecordModel): EventForMessage => {
  const group = event.expand!.group;
  const date = (event.dateOptions || []).find((d: RecordModel) => d.id === event.finalDateId);
  const location = (event.locationOptions || []).find(
    (l: RecordModel) => l.id === event.finalLocationId,
  );
  return {
    id: event.id,
    title: event.title,
    group: group.id,
    groupName: group.name,
    date: date?.date,
    startTime: date?.startTime,
    locationName: location?.name,
    address: location?.address,
  };
};

const announcedOf = (event: RecordModel): string[] =>
  Array.isArray(event.announced) ? event.announced : [];

export const createEventNotificationService = (
  getAdmin: () => Promise<PocketBase>,
  notifyFor: (kind: NotificationKind) => NotifyUsers,
  timeZone: () => string,
) => {
  const memberIds = async (pb: PocketBase, groupId: string): Promise<string[]> =>
    (
      await pb
        .collection('memberships')
        .getFullList({ filter: pb.filter('group = {:groupId}', { groupId }) })
    ).map((m) => m.user);

  // Marca o aviso como enviado ANTES de enviar: dois pedidos ao mesmo tempo não duplicam a
  // notificação. Se o envio falhar, desfaz a marca para poder tentar de novo.
  const sendOnce = async (
    pb: PocketBase,
    event: RecordModel,
    kind: string,
    send: () => Promise<number>,
  ): Promise<number> => {
    const before = announcedOf(event);
    await pb.collection('events').update(event.id, { announced: [...before, kind] });
    try {
      return await send();
    } catch (err) {
      await pb.collection('events').update(event.id, { announced: before });
      throw err;
    }
  };

  return {
    // Chamado pela tela depois que o organizador cria o evento, define a data ou confirma a mesa.
    // A API confere tudo de novo: quem pede, em que etapa o evento está e se já avisou.
    announce: async (
      eventId: string,
      kind: AnnounceKind,
      requesterUid: string,
    ): Promise<AnnounceResult> => {
      const pb = await getAdmin();
      const [event] = await pb
        .collection('events')
        .getFullList({ filter: pb.filter('id = {:eventId}', { eventId }), expand: 'group' });
      if (!event) return { ok: false, reason: 'EVENT_NOT_FOUND' };

      if (requesterUid !== event.creator && requesterUid !== event.expand!.group.admin) {
        return { ok: false, reason: 'FORBIDDEN' };
      }
      if (event.status !== STATUS_FOR_KIND[kind]) return { ok: false, reason: 'WRONG_STATE' };
      if (announcedOf(event).includes(kind)) return { ok: false, reason: 'ALREADY_SENT' };

      const recipients = (await memberIds(pb, event.group)).filter((id) => id !== requesterUid);
      const message = announceMessage(kind, toMessageDetails(event));
      const notified = await sendOnce(pb, event, kind, () => notifyFor(kind)(recipients, message));
      return { ok: true, recipients: recipients.length, notified };
    },

    // Chamado pelo agendador: avisa quem vai quando faltam menos de 24 horas para a jogatina.
    // Quem respondeu "não vou" não recebe. Devolve quantas pessoas foram avisadas.
    processEveReminders: async (now: Date = new Date()): Promise<number> => {
      const pb = await getAdmin();
      const events = await pb.collection('events').getFullList({
        filter: "(status = 'VOTING_GAMES' || status = 'CONFIRMED') && finalDateId != ''",
        expand: 'group',
      });

      let notified = 0;
      for (const event of events) {
        if (announcedOf(event).includes('eve')) continue;
        const details = toMessageDetails(event);
        if (!details.date) continue;
        const start = zonedTime(details.date, details.startTime ?? '00:00', timeZone());
        if (!isInEveWindow(start, now)) continue;

        const declined = (
          await pb.collection('attendances').getFullList({
            filter: pb.filter("event = {:eventId} && status = 'no'", { eventId: event.id }),
          })
        ).map((a) => a.user);
        const recipients = (await memberIds(pb, event.group)).filter(
          (id) => !declined.includes(id),
        );
        const message = eveMessage(details, localDate(now, timeZone()) === details.date);
        notified += await sendOnce(pb, event, 'eve', () => notifyFor('eve')(recipients, message));
      }
      return notified;
    },
  };
};
