import { vi } from 'vitest';
import type { AppUser } from '../services/authService';

export const testUser: AppUser = {
  uid: 'u-edu',
  displayName: 'Edu',
  email: 'edu@exemplo.test',
  getIdToken: async () => 'token-de-teste',
};

// Estado de login das telas sob teste; cada teste ajusta o que precisa
export const fakeAuth = {
  user: testUser as AppUser | null,
  loading: false,
  isAppAdmin: false,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  updateDisplayName: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
};

// Uso: vi.mock('../context/AuthContext', async () => (await import('../test/auth')).authModuleMock)
export const authModuleMock = { useAuth: () => fakeAuth };

// Avisos (toasts) como funções espiãs, para conferir a mensagem mostrada
export const toastModuleMock = {
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
};

export const resetAuth = () => {
  fakeAuth.user = testUser;
  fakeAuth.isAppAdmin = false;
  for (const value of Object.values(fakeAuth)) {
    if (typeof value === 'function' && 'mockReset' in value)
      (value as ReturnType<typeof vi.fn>).mockReset();
  }
};
