import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginForm } from './AdminLoginForm';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { repairSession } from '@/lib/session-repair';

interface AdminAuthGuardProps {
  children: ReactNode;
}

/**
 * Garde d'accès admin.
 * - Les pages admin standards exigent le rôle admin.
 * - La page /admin/security/setup est un cas spécial :
 *   un utilisateur connecté mais non-admin peut y accéder pour "bootstrap" le premier admin.
 */
export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRepairButton, setShowRepairButton] = useState(false);

  const isSecuritySetupRoute = location.pathname.startsWith('/admin/security/setup');

  // Show repair button after 4 seconds of loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowRepairButton(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
    setShowRepairButton(false);
  }, [isLoading]);

  // If user is logged in but not admin, keep UX smooth:
  // - allow security setup route (bootstrap)
  // - otherwise redirect away from admin area.
  useEffect(() => {
    if (!isLoading && user && !isAdmin && !isSecuritySetupRoute) {
      navigate('/', { replace: true });
    }
  }, [isLoading, user, isAdmin, isSecuritySetupRoute, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Vérification des autorisations...</p>

          {showRepairButton && (
            <div className="mt-6 space-y-2">
              <p className="text-sm text-muted-foreground">Chargement trop long ?</p>
              <Button variant="outline" size="sm" onClick={() => repairSession()}>
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

  // Logged in but not admin
  if (!isAdmin) {
    // Allow the bootstrap page to render (stability fix: never return null here on setup route)
    if (isSecuritySetupRoute) {
      return <>{children}</>;
    }

    // Redirect handled by effect above
    return null;
  }

  // User is authenticated and is admin
  return <>{children}</>;
}

