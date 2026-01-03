import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLoginForm } from './AdminLoginForm';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface AdminAuthGuardProps {
  children: ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { user, isAdmin, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification des autorisations...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show login form
  if (!user) {
    return <AdminLoginForm />;
  }

  // Logged in but not admin - show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-destructive/10 w-fit mb-4">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Accès refusé</CardTitle>
            <CardDescription>
              Votre compte n'a pas les droits administrateur.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-sm text-muted-foreground mb-2">Connecté en tant que:</p>
              <p className="font-medium">{user.email}</p>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              Contactez un administrateur pour obtenir les droits nécessaires, puis reconnectez-vous.
            </p>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated and is admin
  return <>{children}</>;
}
