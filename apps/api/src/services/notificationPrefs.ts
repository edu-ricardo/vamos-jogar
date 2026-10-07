import type PocketBase from 'pocketbase/cjs';

// Tipos de aviso que cada pessoa pode ligar ou desligar em Conta
export const NOTIFICATION_KINDS = ['created', 'date_set', 'confirmed', 'eve', 'reminder'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationPrefs = Record<NotificationKind, boolean>;

// Valor guardado no usuário (pode estar vazio ou incompleto): o que não foi desligado está ligado
export const resolvePrefs = (stored: unknown): NotificationPrefs => {
  const saved = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  return Object.fromEntries(
    NOTIFICATION_KINDS.map((kind) => [kind, saved[kind] !== false]),
  ) as NotificationPrefs;
};

// Só aceita chaves conhecidas com valor verdadeiro ou falso
export const parsePrefsChange = (body: unknown): Partial<NotificationPrefs> | null => {
  if (!body || typeof body !== 'object') return null;
  const change: Partial<NotificationPrefs> = {};
  for (const kind of NOTIFICATION_KINDS) {
    const value = (body as Record<string, unknown>)[kind];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') return null;
    change[kind] = value;
  }
  return Object.keys(change).length > 0 ? change : null;
};

export const createPrefsService = (getAdmin: () => Promise<PocketBase>) => ({
  get: async (uid: string): Promise<NotificationPrefs> => {
    const pb = await getAdmin();
    return resolvePrefs((await pb.collection('users').getOne(uid)).notificationPrefs);
  },

  set: async (uid: string, change: Partial<NotificationPrefs>): Promise<NotificationPrefs> => {
    const pb = await getAdmin();
    const current = resolvePrefs((await pb.collection('users').getOne(uid)).notificationPrefs);
    const next = { ...current, ...change };
    await pb.collection('users').update(uid, { notificationPrefs: next });
    return next;
  },

  // Tira de uma lista quem desligou esse tipo de aviso
  filterRecipients: async (userIds: string[], kind: NotificationKind): Promise<string[]> => {
    if (userIds.length === 0) return [];
    const pb = await getAdmin();
    const users = await pb.collection('users').getFullList({
      filter: pb.filter(
        userIds.map((_, i) => `id = {:id${i}}`).join(' || '),
        Object.fromEntries(userIds.map((id, i) => [`id${i}`, id])),
      ),
      fields: 'id,notificationPrefs',
    });
    return users.filter((u) => resolvePrefs(u.notificationPrefs)[kind]).map((u) => u.id);
  },
});
