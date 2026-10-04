import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from 'firebase/auth';

const firebaseAuth = vi.hoisted(() => ({
  authStateCallback: null as null | ((user: unknown) => void),
  unsubscribe: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    firebaseAuth.authStateCallback = callback;
    return firebaseAuth.unsubscribe;
  },
  updateProfile: vi.fn(async (user: { displayName: string }, profile: { displayName: string }) => {
    user.displayName = profile.displayName;
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

import { createFirebaseAuthGateway } from './authGateway';

const firebaseUser = {
  uid: 'bia',
  displayName: 'Bia',
  email: 'bia@example.com',
  getIdToken: vi.fn().mockResolvedValue('token-bia'),
};

describe('createFirebaseAuthGateway', () => {
  beforeEach(() => {
    firebaseUser.displayName = 'Bia';
    firebaseAuth.unsubscribe.mockClear();
  });

  it('converte o usuário do Firebase para AppUser e repassa o token', async () => {
    const gateway = createFirebaseAuthGateway({ currentUser: firebaseUser } as unknown as Auth);
    const callback = vi.fn();
    gateway.onUserChanged(callback);

    firebaseAuth.authStateCallback?.(firebaseUser);
    const appUser = callback.mock.calls[0][0];
    expect(appUser).toMatchObject({ uid: 'bia', displayName: 'Bia', email: 'bia@example.com' });
    await expect(appUser.getIdToken()).resolves.toBe('token-bia');

    firebaseAuth.authStateCallback?.(null);
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it('avisa o app quando o apelido muda e para de avisar após cancelar', async () => {
    const gateway = createFirebaseAuthGateway({ currentUser: firebaseUser } as unknown as Auth);
    const callback = vi.fn();
    const stop = gateway.onUserChanged(callback);

    await gateway.updateDisplayName('Bia Boardgamer');
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({ uid: 'bia', displayName: 'Bia Boardgamer' }),
    );

    stop();
    expect(firebaseAuth.unsubscribe).toHaveBeenCalled();
    await gateway.updateDisplayName('Outro');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
