import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  refreshAdminStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    try {
      // Prefer direct table check (fast + predictable) with RLS: users can read their own roles
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .limit(1);

      if (error) {
        console.error('Error checking admin role (user_roles):', error);
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  };

  useEffect(() => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);
    };

    // Hard stop: never keep the UI stuck in "Vérification des autorisations..."
    // IMPORTANT: do NOT downgrade isAdmin here (it causes random admin lockouts).
    const hardStop = window.setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Any auth change means the app is alive; cancel the initial hard-stop.
      clearTimeout(hardStop);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setIsLoading(true);
        // Defer role check to avoid auth callback deadlocks
        setTimeout(() => {
          withTimeout(checkAdminRole(session.user.id), 4000, false)
            .then(setIsAdmin)
            .finally(() => setIsLoading(false));
        }, 0);
      } else {
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(hardStop);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setIsLoading(true);
          return withTimeout(checkAdminRole(session.user.id), 4000, false)
            .then((isAdminUser) => {
              setIsAdmin(isAdminUser);
            })
            .finally(() => setIsLoading(false));
        }

        setIsLoading(false);
      })
      .catch(() => {
        clearTimeout(hardStop);
        setIsAdmin(false);
        setIsLoading(false);
      });

    return () => {
      clearTimeout(hardStop);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const refreshAdminStatus = async () => {
    const currentUser = user;
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }

    setIsLoading(true);
    try {
      const next = await checkAdminRole(currentUser.id);
      setIsAdmin(next);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAdmin,
      isLoading,
      refreshAdminStatus,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
