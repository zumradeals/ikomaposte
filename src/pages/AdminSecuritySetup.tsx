import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, AlertTriangle, CheckCircle, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { initAdminPin } from '@/lib/admin-auth';

/**
 * Page de configuration initiale du PIN admin
 * Cette page est accessible SANS PIN (juste login email admin)
 * pour permettre le bootstrap initial du système
 */
export default function AdminSecuritySetup() {
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const navigate = useNavigate();
  
  // PIN initialization form
  const [newPin, setNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  
  const { toast } = useToast();

  // Check if PIN is configured
  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data } = await supabase.functions.invoke('verify-admin-pin', {
        body: { pin: '0000', device_id: 'check', scope: 'global' },
      });

      setPinConfigured(data?.reason !== 'NO_PIN_CONFIGURED');
    } catch (err) {
      console.error('Failed to check PIN status:', err);
      // If the status can't be determined, default to "configured" to avoid showing init UI to non-admins.
      setPinConfigured(true);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleInitPin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ title: 'Erreur', description: 'Le PIN doit être 4 chiffres', variant: 'destructive' });
      return;
    }

    setInitLoading(true);
    const result = await initAdminPin(newPin, true);
    setInitLoading(false);

    if (result.success) {
      toast({ title: 'Succès', description: 'PIN administrateur initialisé ! Vous pouvez maintenant accéder à la console.' });
      setPinConfigured(true);
      setNewPin('');

      // Redirect to admin console after successful setup
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } else {
      toast({
        title: 'Erreur',
        description: `Échec: ${result.reason}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Configuration Sécurité</h1>
            <p className="text-muted-foreground">IKOMA POSTE - Administration</p>
          </div>

          {checkingStatus ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Vérification du statut...</p>
              </CardContent>
            </Card>
          ) : pinConfigured ? (
            // PIN already configured - redirect to main admin
            <Card>
              <CardHeader className="text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                <CardTitle>PIN déjà configuré</CardTitle>
                <CardDescription>
                  Le PIN administrateur est actif. Vous pouvez accéder à la console admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/admin')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Accéder à la console admin
                </Button>
                
                <p className="text-sm text-center text-muted-foreground">
                  Pour changer le PIN, déverrouillez d'abord la console puis allez dans Sécurité.
                </p>
              </CardContent>
            </Card>
          ) : (
            // PIN not configured - show initialization form
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuration requise</AlertTitle>
                <AlertDescription>
                  Aucun PIN administrateur n'est configuré. Définissez-en un pour sécuriser l'accès à la console.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Initialiser le PIN administrateur
                  </CardTitle>
                  <CardDescription>
                    Ce PIN sera requis pour accéder à la console d'administration.
                    Il est stocké de manière sécurisée (hashé bcrypt).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInitPin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPin">Nouveau PIN (4 chiffres)</Label>
                      <div className="relative">
                        <Input
                          id="newPin"
                          type={showNewPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="text-center text-2xl tracking-widest font-mono"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPin(!showNewPin)}
                        >
                          {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={initLoading || newPin.length !== 4}
                    >
                      {initLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Initialisation...
                        </>
                      ) : (
                        'Définir le PIN et continuer'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Security Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Informations de sécurité
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>• Le PIN est stocké sous forme de hash bcrypt (irréversible)</p>
                  <p>• Chaque tentative de connexion est enregistrée</p>
                  <p>• La vérification se fait côté serveur uniquement</p>
                  <p>• La session admin expire après 10 minutes d'inactivité</p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Back to kiosk */}
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au kiosque
            </Button>
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
