import { afterEach, describe, expect, it, vi } from 'vitest';
import { startReminderScheduler } from './reminderScheduler';
import { isValidSubscription } from './pushService';

describe('startReminderScheduler', () => {
  afterEach(() => vi.useRealTimers());

  it('verifica um minuto depois de subir e depois a cada intervalo, sem parar em erro', async () => {
    vi.useFakeTimers();
    const process = vi
      .fn()
      .mockRejectedValueOnce(new Error('PocketBase fora'))
      .mockResolvedValue(0);
    const stop = startReminderScheduler(process, 60 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(59 * 1000);
    expect(process).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(process).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(process).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(process).toHaveBeenCalledTimes(2);
  });
});

describe('isValidSubscription', () => {
  it('aceita só inscrições HTTPS com as duas chaves', () => {
    const ok = { endpoint: 'https://push.test/1', keys: { p256dh: 'a', auth: 'b' } };
    expect(isValidSubscription(ok)).toBe(true);
    expect(isValidSubscription({ ...ok, endpoint: 'http://push.test/1' })).toBe(false);
    expect(isValidSubscription({ ...ok, keys: { p256dh: 'a' } })).toBe(false);
    expect(isValidSubscription(null)).toBe(false);
  });
});
