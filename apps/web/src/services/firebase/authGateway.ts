import {
  type Auth,
  type User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import type { AppUser, AuthGateway } from '../authService';

const toAppUser = (user: User | null): AppUser | null =>
  user && {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    getIdToken: () => user.getIdToken(),
  };

export const createFirebaseAuthGateway = (auth: Auth): AuthGateway => {
  // O Firebase não avisa mudança de perfil; avisamos nós mesmos após updateDisplayName
  const profileListeners = new Set<(user: AppUser | null) => void>();

  return {
    onUserChanged: (callback) => {
      profileListeners.add(callback);
      const unsubscribe = onAuthStateChanged(auth, (user) => callback(toAppUser(user)));
      return () => {
        profileListeners.delete(callback);
        unsubscribe();
      };
    },

    signInWithGoogle: async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (error) {
        console.error('Erro ao fazer login com Google:', error);
        throw error;
      }
    },

    signInWithEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },

    changePassword: async (currentPassword, newPassword) => {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Nenhum usuário logado');
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, newPassword);
    },

    signUpWithEmail: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },

    updateDisplayName: async (displayName) => {
      if (!auth.currentUser) throw new Error('Nenhum usuário logado');
      await updateProfile(auth.currentUser, { displayName });
      const updated = toAppUser(auth.currentUser);
      profileListeners.forEach((listener) => listener(updated));
    },

    logout: async () => {
      await signOut(auth);
    },
  };
};
