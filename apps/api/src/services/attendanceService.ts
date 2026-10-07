import type PocketBase from 'pocketbase/cjs';

export const ATTENDANCE_STATUSES = ['yes', 'no', 'maybe'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  (ATTENDANCE_STATUSES as readonly string[]).includes(value as string);

export interface AttendanceAnswer {
  userId: string;
  name: string;
  // null = ainda não respondeu
  status: AttendanceStatus | null;
}

export type AttendanceFailure = {
  ok: false;
  reason: 'EVENT_NOT_FOUND' | 'NOT_MEMBER' | 'NOT_OPEN';
};

export const createAttendanceService = (getAdmin: () => Promise<PocketBase>) => {
  // Evento existente cujo grupo tem a pessoa como membro
  const loadForMember = async (pb: PocketBase, eventId: string, uid: string) => {
    const [event] = await pb
      .collection('events')
      .getFullList({ filter: pb.filter('id = {:eventId}', { eventId }) });
    if (!event) return { failure: { ok: false, reason: 'EVENT_NOT_FOUND' } as AttendanceFailure };
    const [membership] = await pb.collection('memberships').getFullList({
      filter: pb.filter('group = {:groupId} && user = {:uid}', { groupId: event.group, uid }),
    });
    if (!membership) return { failure: { ok: false, reason: 'NOT_MEMBER' } as AttendanceFailure };
    return { event };
  };

  return {
    // Só faz sentido depois que a data foi definida
    set: async (
      eventId: string,
      uid: string,
      status: AttendanceStatus,
    ): Promise<{ ok: true } | AttendanceFailure> => {
      const pb = await getAdmin();
      const { event, failure } = await loadForMember(pb, eventId, uid);
      if (failure) return failure;
      if (!event.finalDateId) return { ok: false, reason: 'NOT_OPEN' };

      const [existing] = await pb.collection('attendances').getFullList({
        filter: pb.filter('event = {:eventId} && user = {:uid}', { eventId, uid }),
      });
      if (existing) await pb.collection('attendances').update(existing.id, { status });
      else await pb.collection('attendances').create({ event: eventId, user: uid, status });
      return { ok: true };
    },

    // Todos os membros do grupo, na ordem de entrada, com a resposta de cada um
    list: async (
      eventId: string,
      uid: string,
    ): Promise<{ ok: true; answers: AttendanceAnswer[] } | AttendanceFailure> => {
      const pb = await getAdmin();
      const { event, failure } = await loadForMember(pb, eventId, uid);
      if (failure) return failure;

      const [memberships, attendances] = await Promise.all([
        pb.collection('memberships').getFullList({
          filter: pb.filter('group = {:groupId}', { groupId: event.group }),
          sort: 'created',
          expand: 'user',
        }),
        pb
          .collection('attendances')
          .getFullList({ filter: pb.filter('event = {:eventId}', { eventId }) }),
      ]);
      const statusOf = new Map(attendances.map((a) => [a.user, a.status as AttendanceStatus]));
      return {
        ok: true,
        answers: memberships.map((m) => ({
          userId: m.user,
          name: m.nickname || m.expand?.user?.name || m.expand?.user?.email || 'Sem nome',
          status: statusOf.get(m.user) ?? null,
        })),
      };
    },
  };
};
