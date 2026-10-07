import { apiRequest } from './apiClient';

// Tipos de aviso que cada pessoa liga ou desliga (vale em todos os aparelhos)
export type NotificationKind = 'created' | 'date_set' | 'confirmed' | 'eve' | 'reminder';
export type NotificationPrefs = Record<NotificationKind, boolean>;

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  created: 'Evento novo no grupo',
  date_set: 'Data e local definidos',
  confirmed: 'Jogatina confirmada',
  eve: 'Lembrete na véspera da jogatina',
  reminder: 'Lembrete quando falta o meu voto',
};

export type NotificationStatus =
  | 'unsupported' // navegador sem Web Push
  | 'install-required' // iPhone/iPad: só funciona com o app instalado na tela inicial
  | 'denied' // permissão bloqueada nas configurações do navegador
  | 'enabled'
  | 'disabled';

// A chave pública VAPID vem em base64url; o navegador espera os bytes
export const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export const isAppleMobile = (nav: Navigator) =>
  /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const currentSubscription = async () => {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const notificationService = {
  getStatus: async (): Promise<NotificationStatus> => {
    if (isAppleMobile(navigator) && !isStandalone()) return 'install-required';
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return (await currentSubscription()) ? 'enabled' : 'disabled';
  },

  // Pede a permissão, inscreve este aparelho e registra no servidor
  enable: async (idToken: string): Promise<NotificationStatus> => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';

    const { publicKey } = await apiRequest<{ publicKey: string }>('/api/push/public-key', {
      fallbackError: 'Notificações indisponíveis no servidor.',
    });
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      }));

    await apiRequest('/api/push/subscriptions', {
      method: 'POST',
      idToken,
      body: { subscription: subscription.toJSON() },
      fallbackError: 'Erro ao ativar as notificações.',
    });
    return 'enabled';
  },

  getPreferences: (idToken: string) =>
    apiRequest<NotificationPrefs>('/api/push/preferences', {
      idToken,
      fallbackError: 'Erro ao carregar as preferências.',
    }),

  setPreferences: (idToken: string, change: Partial<NotificationPrefs>) =>
    apiRequest<NotificationPrefs>('/api/push/preferences', {
      method: 'PUT',
      idToken,
      body: change,
      fallbackError: 'Erro ao salvar as preferências.',
    }),

  // Remove o aparelho no servidor e cancela a inscrição no navegador
  disable: async (idToken: string): Promise<NotificationStatus> => {
    const subscription = await currentSubscription();
    if (subscription) {
      await apiRequest('/api/push/subscriptions', {
        method: 'DELETE',
        idToken,
        body: { endpoint: subscription.endpoint },
        fallbackError: 'Erro ao desativar as notificações.',
      });
      await subscription.unsubscribe();
    }
    return 'disabled';
  },
};
