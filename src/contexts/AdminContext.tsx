import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AdminSession } from '@/types/ikoma';
import { verifyAdminPin, getAdminSessionDuration, VerifyResult } from '@/lib/admin-auth';
import { appendAdminEvent } from '@/lib/storage';

interface AdminContextType {
  session: AdminSession;
  isUnlocked: boolean;
  attemptUnlock: (pin: string) => Promise<VerifyResult>;
  lock: (reason?: string) => void;
  remainingTime: number;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession>({
    isUnlocked: false,
    unlockedAt: null,
    expiresAt: null,
  });
  const [remainingTime, setRemainingTime] = useState(0);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const lock = useCallback((reason?: string) => {
    if (session.isUnlocked) {
      appendAdminEvent({
        event_type: 'ADMIN_LOCK',
        actor: reason ? 'system' : 'admin',
        optional_reason: reason || 'Manual lock',
      });
    }
    
    setSession({
      isUnlocked: false,
      unlockedAt: null,
      expiresAt: null,
    });
    setRemainingTime(0);
    
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
  }, [session.isUnlocked]);

  const resetInactivityTimer = useCallback(() => {
    if (!session.isUnlocked) return;
    
    const duration = getAdminSessionDuration();
    const expiresAt = new Date(Date.now() + duration).toISOString();
    
    setSession(prev => ({
      ...prev,
      expiresAt,
    }));
    setRemainingTime(Math.floor(duration / 1000));
    
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    activityTimeoutRef.current = setTimeout(() => {
      lock('Inactivité - session expirée automatiquement');
    }, duration);
  }, [session.isUnlocked, lock]);

  const attemptUnlock = useCallback(async (pin: string): Promise<VerifyResult> => {
    const result = await verifyAdminPin(pin);
    
    if (result.success) {
      const now = new Date().toISOString();
      const duration = result.sessionDurationMs;
      const expiresAt = new Date(Date.now() + duration).toISOString();
      
      setSession({
        isUnlocked: true,
        unlockedAt: now,
        expiresAt,
      });
      
      appendAdminEvent({
        event_type: 'ADMIN_UNLOCK',
        actor: 'admin',
      });
      
      setRemainingTime(Math.floor(duration / 1000));
      
      activityTimeoutRef.current = setTimeout(() => {
        lock('Inactivité - session expirée automatiquement');
      }, duration);
    } else {
      console.log('[Admin] Unlock failed:', result.reason);
    }
    
    return result;
  }, [lock]);

  // Countdown timer
  useEffect(() => {
    if (session.isUnlocked) {
      countdownRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [session.isUnlocked]);

  // Listen for activity to reset timer
  useEffect(() => {
    if (!session.isUnlocked) return;
    
    const handleActivity = () => {
      resetInactivityTimer();
    };
    
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [session.isUnlocked, resetInactivityTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  return (
    <AdminContext.Provider value={{
      session,
      isUnlocked: session.isUnlocked,
      attemptUnlock,
      lock,
      remainingTime,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
