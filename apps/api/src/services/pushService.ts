import type PocketBase from 'pocketbase/cjs';

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  // Caminho do app aberto ao tocar na notificação
  url: string;
  // Notificações com a mesma tag substituem a anterior no aparelho
  tag?: string;
}

// Mesmo contrato do web-push: em falha, o erro traz o statusCode devolvido pelo serviço de push
export type SendNotification = (
  subscription: BrowserSubscription,
  payload: string,
) => Promise<unknown>;

// Serviço de push respondeu que a inscrição não existe mais (app desinstalado, permissão revogada)
const isExpired = (err: unknown) =>
  [404, 410].includes((err as { statusCode?: number }).statusCode ?? 0);

export const isValidSubscription = (value: unknown): value is BrowserSubscription => {
  const s = value as BrowserSubscription;
  return (
    typeof s?.endpoint === 'string' &&
    s.endpoint.startsWith('https://') &&
    typeof s.keys?.p256dh === 'string' &&
    typeof s.keys?.auth === 'string'
  );
};

export const createPushService = (getAdmin: () => Promise<PocketBase>, send: SendNotification) => ({
  // Grava o aparelho para a pessoa logada; num aparelho compartilhado, ele passa para ela
  subscribe: async (userId: string, subscription: BrowserSubscription, userAgent = '') => {
    const pb = await getAdmin();
    const data = {
      user: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent.slice(0, 500),
    };
    const [existing] = await pb.collection('push_subscriptions').getFullList({
      filter: pb.filter('endpoint = {:endpoint}', { endpoint: subscription.endpoint }),
    });
    if (existing) await pb.collection('push_subscriptions').update(existing.id, data);
    else await pb.collection('push_subscriptions').create(data);
  },

  // Só remove se o aparelho for da própria pessoa
  unsubscribe: async (userId: string, endpoint: string) => {
    const pb = await getAdmin();
    const mine = await pb.collection('push_subscriptions').getFullList({
      filter: pb.filter('endpoint = {:endpoint} && user = {:userId}', { endpoint, userId }),
    });
    for (const record of mine) await pb.collection('push_subscriptions').delete(record.id);
  },

  // Envia para todos os aparelhos das pessoas; devolve quantas pessoas receberam em ao menos um
  sendToUsers: async (userIds: string[], message: PushMessage): Promise<number> => {
    if (userIds.length === 0) return 0;
    const pb = await getAdmin();
    const filter = userIds.map((_, i) => `user = {:u${i}}`).join(' || ');
    const params = Object.fromEntries(userIds.map((id, i) => [`u${i}`, id]));
    const subscriptions = await pb
      .collection('push_subscriptions')
      .getFullList({ filter: pb.filter(filter, params) });

    const reached = new Set<string>();
    const payload = JSON.stringify(message);
    for (const sub of subscriptions) {
      try {
        await send(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        reached.add(sub.user);
      } catch (err) {
        if (isExpired(err)) await pb.collection('push_subscriptions').delete(sub.id);
        else console.error('Falha ao enviar notificação:', (err as Error).message);
      }
    }
    return reached.size;
  },
});
