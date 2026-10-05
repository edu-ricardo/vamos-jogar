import webpush from 'web-push';
import { getAdminClient } from '../lib/pocketbase';
import { createPushService, type SendNotification } from './pushService';
import { createReminderService } from './reminderService';

// Chaves VAPID identificam este servidor para os serviços de push (Google, Apple, Mozilla).
// Gere uma vez com: npx web-push generate-vapid-keys
export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

const sendWithWebPush: SendNotification = (subscription, payload) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('Notificações desativadas: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY');
  }
  return webpush.sendNotification(subscription, payload, {
    // Contato exigido pelos serviços de push: e-mail (mailto:) ou o endereço do app
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || '',
      publicKey,
      privateKey,
    },
    // Aparelho desligado recebe ao voltar, se for em até 1 dia
    TTL: 24 * 60 * 60,
  });
};

export const pushService = createPushService(getAdminClient, sendWithWebPush);
export const reminderService = createReminderService(getAdminClient, pushService.sendToUsers);
