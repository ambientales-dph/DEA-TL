'use client';

import * as React from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { User } from '@/types';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!auth) {
      console.warn("Firebase config is missing or invalid. Authentication features are disabled. Please check your .env file.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const authorizedEmailsEnv = process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '';
        // Only enforce allowlist if it's not empty
        if (authorizedEmailsEnv) {
          const authorizedEmails = authorizedEmailsEnv.split(',').map(email => email.trim().toLowerCase());
          const userEmail = firebaseUser.email?.toLowerCase();

          if (userEmail && authorizedEmails.includes(userEmail)) {
            // User is on the allowlist, grant access
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
            });
          } else {
            // User is NOT on the allowlist, deny access
            setUser(null);
            await signOut(auth);
            toast({
              variant: "destructive",
              title: "Acceso denegado",
              description: "No tienes permiso para acceder a esta aplicación.",
              duration: 5000,
            });
          }
        } else {
          // No allowlist configured, allow any authenticated user
           setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);