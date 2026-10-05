import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PocketBase from 'pocketbase';
import { createPushService } from '../apps/api/src/services/pushService';
import { resetAppData } from '../apps/api/scripts/migrate/importBackup';

// Inscrições de notificação (Web Push) no PocketBase real, com o envio simulado.
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
const describeIfPocketBase = url ? describe : describe.skip;

const device = (name: string) => ({
  endpoint: `https://push.exemplo.test/${name}`,
  keys: { p256dh: `chave-${name}`, auth: `auth-${name}` },
});

describeIfPocketBase('Notificações (Web Push)', () => {
  const admin = new PocketBase(url);
  admin.autoCancellation(false);
  const getAdmin = async () => admin;
  const ids = {} as Record<'bia' | 'caio', string>;
  const sessions = {} as Record<'bia' | 'caio', PocketBase>;

  const subscriptions = () =>
    admin.collection('push_subscriptions').getFullList({ sort: 'endpoint' });

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
  });

  beforeEach(async () => {
    // Limpa todos os dados do app (inclusive grupos de outros testes que prendem os usuários)
    await resetAppData(admin);
    for (const person of ['bia', 'caio'] as const) {
      const email = `${person}@vamosjogar.test`;
      ids[person] = (
        await admin
          .collection('users')
          .create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
      ).id;
      sessions[person] = new PocketBase(url);
      sessions[person].autoCancellation(false);
      await sessions[person].collection('users').authWithPassword(email, PASSWORD);
    }
  });

  it('inscreve o aparelho e, num aparelho compartilhado, passa para quem está logado', async () => {
    const push = createPushService(getAdmin, vi.fn());

    await push.subscribe(ids.bia, device('celular'), 'Android');
    await push.subscribe(ids.bia, device('celular'), 'Android');
    expect((await subscriptions()).map((s) => [s.user, s.endpoint])).toEqual([
      [ids.bia, 'https://push.exemplo.test/celular'],
    ]);

    await push.subscribe(ids.caio, device('celular'), 'Android');
    expect((await subscriptions()).map((s) => s.user)).toEqual([ids.caio]);
  });

  it('desinscrever só remove o aparelho da própria pessoa', async () => {
    const push = createPushService(getAdmin, vi.fn());
    await push.subscribe(ids.bia, device('celular'));

    await push.unsubscribe(ids.caio, device('celular').endpoint);
    expect(await subscriptions()).toHaveLength(1);

    await push.unsubscribe(ids.bia, device('celular').endpoint);
    expect(await subscriptions()).toHaveLength(0);
  });

  it('envia para todos os aparelhos, conta pessoas avisadas e apaga aparelhos expirados', async () => {
    const send = vi.fn(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint.endsWith('expirado'))
        throw Object.assign(new Error('Gone'), { statusCode: 410 });
      if (subscription.endpoint.endsWith('instavel'))
        throw Object.assign(new Error('Erro'), { statusCode: 500 });
    });
    const push = createPushService(getAdmin, send);
    await push.subscribe(ids.bia, device('bia-celular'));
    await push.subscribe(ids.bia, device('bia-expirado'));
    await push.subscribe(ids.caio, device('caio-instavel'));

    const message = { title: 'Oi', body: 'Teste', url: '/' };
    expect(await push.sendToUsers([ids.bia, ids.caio], message)).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);
    expect(JSON.parse(send.mock.calls[0][1] as unknown as string)).toEqual(message);
    expect((await subscriptions()).map((s) => s.endpoint)).toEqual([
      'https://push.exemplo.test/bia-celular',
      'https://push.exemplo.test/caio-instavel',
    ]);

    expect(await push.sendToUsers([], message)).toBe(0);
  });

  it('pelas regras, cada pessoa só vê os próprios aparelhos e não grava direto', async () => {
    const push = createPushService(getAdmin, vi.fn());
    await push.subscribe(ids.bia, device('bia'));
    await push.subscribe(ids.caio, device('caio'));

    expect(
      (await sessions.bia.collection('push_subscriptions').getFullList()).map((s) => s.user),
    ).toEqual([ids.bia]);
    await expect(
      sessions.bia
        .collection('push_subscriptions')
        .create({ user: ids.bia, ...device('x'), p256dh: 'a', auth: 'b' }),
    ).rejects.toMatchObject({ status: 403 });
    const [mine] = await sessions.bia.collection('push_subscriptions').getFullList();
    await expect(
      sessions.bia.collection('push_subscriptions').delete(mine.id),
    ).rejects.toBeTruthy();
  });

  it('aparelhos somem junto com a conta', async () => {
    const push = createPushService(getAdmin, vi.fn());
    await push.subscribe(ids.bia, device('bia'));
    await admin.collection('users').delete(ids.bia);
    expect(await subscriptions()).toEqual([]);
  });
});
