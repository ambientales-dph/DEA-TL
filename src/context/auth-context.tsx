'use client';

import * as React from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// Mock a logged-in user to remove restrictions as per user request.
const mockUser: User = {
    uid: 'mock-user-uid',
    displayName: 'Usuario',
    email: 'usuario@ejemplo.com',
    photoURL: null,
};

const AuthContext = React.createContext<AuthContextType>({
  user: mockUser,
  loading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // The provider now simply returns a mock user that is always "logged in"
  // and not in a loading state. This effectively removes all authentication gates.
  const value = {
      user: mockUser,
      loading: false,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);
