import { describe, expect, it } from 'vitest';
import { readVapidConfig } from './notifications';

describe('readVapidConfig', () => {
  const keys = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };

  it('usa VAPID_SUBJECT e, sem ele, o FRONTEND_URL como contato', () => {
    expect(readVapidConfig({ ...keys, VAPID_SUBJECT: 'mailto:eu@exemplo.com' })).toEqual({
      config: { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:eu@exemplo.com' },
    });
    expect(readVapidConfig({ ...keys, FRONTEND_URL: 'https://vamosjogar.exemplo.com' })).toEqual({
      config: { publicKey: 'pub', privateKey: 'priv', subject: 'https://vamosjogar.exemplo.com' },
    });
  });

  // Caso real da produção: chaves preenchidas, FRONTEND_URL vazio
  it('lista o que falta, inclusive contato vazio ou sem mailto:/https://', () => {
    expect(readVapidConfig({ ...keys, FRONTEND_URL: '' })).toEqual({
      missing: ['VAPID_SUBJECT ou FRONTEND_URL (mailto: ou https://)'],
    });
    expect(readVapidConfig({ ...keys, FRONTEND_URL: 'http://localhost:3080' })).toHaveProperty(
      'missing',
    );
    expect(readVapidConfig({})).toEqual({
      missing: [
        'VAPID_PUBLIC_KEY',
        'VAPID_PRIVATE_KEY',
        'VAPID_SUBJECT ou FRONTEND_URL (mailto: ou https://)',
      ],
    });
  });
});
