import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type AppUser } from '../services/authService';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onUserChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle: authService.signInWithGoogle,
        signInWithEmail: authService.signInWithEmail,
        signUpWithEmail: authService.signUpWithEmail,
        updateDisplayName: authService.updateDisplayName,
        logout: authService.logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
