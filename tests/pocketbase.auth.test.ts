import { describe, expect, it, vi } from 'vitest';
import PocketBase from 'pocketbase';
import { createPocketBaseAuthGateway } from '../apps/web/src/services/pocketbase/authGateway';

// Login com e-mail e senha no PocketBase real. Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('AuthGateway PocketBase', () => {
  it('cadastra, avisa login, troca apelido, entrega token e sai', async () => {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);
    const gateway = createPocketBaseAuthGateway(pb);
    const email = `auth-${Date.now()}@vamosjogar.test`;

    const callback = vi.fn();
    const stop = gateway.onUserChanged(callback);
    expect(callback).toHaveBeenLastCalledWith(null);

    await gateway.signUpWithEmail(email, 'senha-de-teste-123');
    const user = callback.mock.lastCall![0];
    expect(user).toMatchObject({ email, displayName: null });
    expect(await user.getIdToken()).toBe(pb.authStore.token);

    await gateway.updateDisplayName('Bia Boardgamer');
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: user.uid, displayName: 'Bia Boardgamer' }),
    );

    await gateway.logout();
    expect(callback).toHaveBeenLastCalledWith(null);

    await gateway.signInWithEmail(email, 'senha-de-teste-123');
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ uid: user.uid }));

    stop();
    await gateway.logout();
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ uid: user.uid }));
  });

  it('sessão guardada de uma conta que não existe mais leva de volta ao login', async () => {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);
    const email = `apagada-${Date.now()}@vamosjogar.test`;
    await pb
      .collection('users')
      .create({ email, password: 'senha-de-teste-123', passwordConfirm: 'senha-de-teste-123' });
    await pb.collection('users').authWithPassword(email, 'senha-de-teste-123');
    const { token, record } = pb.authStore;

    // Simula o banco reimportado: a conta some, mas o navegador ainda guarda o token
    const admin = new PocketBase(url);
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
    await admin.collection('users').delete(record!.id);

    const reopened = new PocketBase(url);
    reopened.authStore.save(token, record);
    const callback = vi.fn();
    createPocketBaseAuthGateway(reopened).onUserChanged(callback);

    expect(callback).toHaveBeenNthCalledWith(1, expect.objectContaining({ uid: record!.id }));
    await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith(null));
  });

  it('senha errada é recusada', async () => {
    const gateway = createPocketBaseAuthGateway(new PocketBase(url));
    await expect(gateway.signInWithEmail('ninguem@vamosjogar.test', 'errada')).rejects.toThrow();
  });
});
