import webpush from 'web-push';
import { getAdminClient } from '../lib/pocketbase';
import { createPushService, type SendNotification } from './pushService';
import { createReminderService } from './reminderService';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  // Contato exigido pelos serviços de push: e-mail (mailto:) ou o endereço https do app
  subject: string;
}

// Chaves VAPID identificam este servidor para os serviços de push (Google, Apple, Mozilla).
// Gere uma vez com: npx web-push generate-vapid-keys. Devolve o que falta quando incompleto.
export const readVapidConfig = (
  env: NodeJS.ProcessEnv,
): { config: VapidConfig } | { missing: string[] } => {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || env.FRONTEND_URL;
  const missing = [
    ...(publicKey ? [] : ['VAPID_PUBLIC_KEY']),
    ...(privateKey ? [] : ['VAPID_PRIVATE_KEY']),
    ...(subject && /^(mailto:|https:\/\/)/.test(subject)
      ? []
      : ['VAPID_SUBJECT ou FRONTEND_URL (mailto: ou https://)']),
  ];
  return missing.length > 0
    ? { missing }
    : { config: { publicKey: publicKey!, privateKey: privateKey!, subject: subject! } };
};

// A chave pública só é oferecida ao app quando o envio está realmente configurado
export const getVapidPublicKey = () => {
  const vapid = readVapidConfig(process.env);
  return 'config' in vapid ? vapid.config.publicKey : null;
};

const sendWithWebPush: SendNotification = (subscription, payload) => {
  const vapid = readVapidConfig(process.env);
  if ('missing' in vapid) {
    throw new Error(`Notificações desativadas: falta ${vapid.missing.join(', ')}`);
  }
  return webpush.sendNotification(subscription, payload, {
    vapidDetails: vapid.config,
    // Aparelho desligado recebe ao voltar, se for em até 1 dia
    TTL: 24 * 60 * 60,
  });
};

export const pushService = createPushService(getAdminClient, sendWithWebPush);
export const reminderService = createReminderService(getAdminClient, pushService.sendToUsers);
