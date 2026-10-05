import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type AppUser } from '../services/authService';
import { adminService } from '../services/adminService';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  // Admin do app (painel /admin); a API confere de novo em cada ação
  isAppAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.onUserChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsAppAdmin(false);
    if (!user) return;
    user
      .getIdToken()
      .then(adminService.isAdmin)
      .then(setIsAppAdmin, () => setIsAppAdmin(false));
  }, [user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAppAdmin,
        signInWithGoogle: authService.signInWithGoogle,
        signInWithEmail: authService.signInWithEmail,
        signUpWithEmail: authService.signUpWithEmail,
        updateDisplayName: authService.updateDisplayName,
        changePassword: authService.changePassword,
        logout: authService.logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
