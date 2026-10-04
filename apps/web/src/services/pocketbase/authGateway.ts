import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { AppUser, AuthGateway } from '../authService';

const toAppUser = (pb: PocketBase, record: RecordModel): AppUser => ({
  uid: record.id,
  displayName: record.name || null,
  email: record.email || null,
  // A API própria valida este mesmo token no PocketBase
  getIdToken: async () => pb.authStore.token,
});

export const createPocketBaseAuthGateway = (pb: PocketBase): AuthGateway => {
  const currentUser = () =>
    pb.authStore.isValid && pb.authStore.record ? toAppUser(pb, pb.authStore.record) : null;

  return {
    onUserChanged: (callback) => {
      // O SDK avisa login, logout e também alterações no próprio registro (ex.: apelido)
      const unsubscribe = pb.authStore.onChange(() => callback(currentUser()));
      callback(currentUser());
      // A sessão guardada pode não valer mais (conta apagada, banco reimportado): confirma com
      // o servidor e, se recusada, sai. De quebra, renova o token de quem continua válido.
      if (pb.authStore.isValid) {
        pb.collection('users')
          .authRefresh()
          .catch(() => pb.authStore.clear());
      }
      return unsubscribe;
    },

    signInWithGoogle: async () => {
      try {
        await pb.collection('users').authWithOAuth2({ provider: 'google' });
      } catch (error) {
        console.error('Erro ao fazer login com Google:', error);
        throw error;
      }
    },

    signInWithEmail: async (email, password) => {
      await pb.collection('users').authWithPassword(email, password);
    },

    signUpWithEmail: async (email, password) => {
      await pb.collection('users').create({ email, password, passwordConfirm: password });
      await pb.collection('users').authWithPassword(email, password);
    },

    updateDisplayName: async (displayName) => {
      const record = pb.authStore.record;
      if (!record) throw new Error('Nenhum usuário logado');
      await pb.collection('users').update(record.id, { name: displayName });
    },

    logout: async () => {
      pb.authStore.clear();
    },
  };
};
