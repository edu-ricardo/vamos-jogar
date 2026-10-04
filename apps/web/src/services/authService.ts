import { auth } from '../lib/firebase';
import { createFirebaseAuthGateway } from './firebase/authGateway';

// Usuário como o app enxerga, independente do provedor de login
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  // Token enviado à API própria no header Authorization
  getIdToken(): Promise<string>;
}

export interface AuthGateway {
  // Chama o callback a cada login, logout ou mudança de perfil; retorna a função para parar
  onUserChanged(callback: (user: AppUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  updateDisplayName(displayName: string): Promise<void>;
  logout(): Promise<void>;
}

export const authService: AuthGateway = createFirebaseAuthGateway(auth);
