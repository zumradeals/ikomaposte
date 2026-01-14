import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginForm } from './AdminLoginForm';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { repairSession } from '@/lib/session-repair';

interface AdminAuthGuardProps {
  children: ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showRepairButton, setShowRepairButton] = useState(false);

  // Show repair button after 4 seconds of loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowRepairButton(true);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setShowRepairButton(false);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Vérification des autorisations...</p>
          
          {showRepairButton && (
            <div className="mt-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                Chargement trop long ?
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => repairSession()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réparer la session
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not logged in - show login form
  if (!user) {
    return <AdminLoginForm />;
  }

  // Logged in but not admin - silently return to kiosk (keeps security, avoids disruptive blocking screen)
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Accès administrateur requis.</p>
          <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
            Retour au scan
          </Button>
        </div>
      </div>
    );
  }

  // User is authenticated and is admin
  return <>{children}</>;
}
