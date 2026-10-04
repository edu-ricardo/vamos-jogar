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

  it('senha errada é recusada', async () => {
    const gateway = createPocketBaseAuthGateway(new PocketBase(url));
    await expect(gateway.signInWithEmail('ninguem@vamosjogar.test', 'errada')).rejects.toThrow();
  });
});
