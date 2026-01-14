import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCategories } from '@/hooks/useCategories';
import { useWorkers } from '@/hooks/useWorkers';
import { useTodayEvents } from '@/hooks/useWorkEvents';
import { getAdminEvents, getDeviceInfo } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Monitor,
  Users,
  Tags,
  List,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  Shield,
} from 'lucide-react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminUnlockModal } from '@/components/AdminUnlockModal';
import { supabase } from '@/integrations/supabase/client';

function AdminConsoleUnlocked() {
  const navigate = useNavigate();
  const events = getAdminEvents();
  const deviceInfo = getDeviceInfo();

  const { data: categories = [] } = useCategories(true);
  const { data: workers = [] } = useWorkers({ includeInactive: true });
  const { data: todayEvents = [] } = useTodayEvents('all');

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const activeWorkers = workers.filter((w) => w.actif).length;
  const activeCategories = categories.filter((c) => c.actif).length;
  const trustedEvents = todayEvents.filter((e) => e.trust_status === 'trusted').length;
  const untrustedEvents = todayEvents.filter((e) => e.trust_status === 'untrusted').length;

  return (
    <AdminLayout title="Tableau de bord">
      <div className="space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/workers')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{activeWorkers}</p>
                  <p className="text-sm text-muted-foreground">
                    Travailleurs actifs
                    {workers.length > activeWorkers && (
                      <span className="text-xs ml-1">({workers.length} total)</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/categories')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent/10">
                  <Tags className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{activeCategories}</p>
                  <p className="text-sm text-muted-foreground">
                    Catégories actives
                    {categories.length > activeCategories && (
                      <span className="text-xs ml-1">({categories.length} total)</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/events')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <Clock className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{todayEvents.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Pointages aujourd'hui
                    <span className="text-xs ml-1">
                      ({trustedEvents} <ShieldCheck className="inline w-3 h-3 text-success" /> /
                      {untrustedEvents}{' '}
                      <ShieldAlert className="inline w-3 h-3 text-destructive" />)
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-secondary">
                  <Monitor className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-mono truncate max-w-[150px]">
                    {deviceInfo?.device_id?.substring(0, 12)}...
                  </p>
                  <p className="text-sm text-muted-foreground">ID Appareil</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Events Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5 text-primary" />
              Journal Admin
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {events.length} événement{events.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun événement enregistré</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {[...events].reverse().map((event) => (
                  <div key={event.id} className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        event.event_type === 'ADMIN_UNLOCK' ? 'bg-success' : 'bg-warning'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            event.event_type === 'ADMIN_UNLOCK' ? 'text-success' : 'text-warning'
                          }`}
                        >
                          {event.event_type === 'ADMIN_UNLOCK' ? 'Déverrouillage' : 'Verrouillage'}
                        </span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded">
                          {event.actor}
                        </span>
                      </div>
                      {event.optional_reason && (
                        <p className="text-sm text-muted-foreground mt-1">{event.optional_reason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{formatTimestamp(event.timestamp)}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {event.device_id.substring(0, 16)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* README/Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>📖 Mode d'emploi Admin</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none">
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Entrer en mode Admin</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Sur l'écran Scan, appuyez longuement (5 sec) sur le coin supérieur gauche</li>
                  <li>Une modale de déverrouillage apparaît</li>
                  <li>Entrez le code PIN administrateur</li>
                  <li>Vous accédez à la Console Admin</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Sortir du mode Admin</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Cliquez sur le bouton "Verrouiller" en haut à droite</li>
                  <li>Ou attendez 2 minutes d'inactivité (verrouillage auto)</li>
                  <li>L'application revient automatiquement à l'écran Scan</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function AdminConsoleLocked() {
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const { data } = await supabase.functions.invoke('verify-admin-pin', {
          body: { pin: '0000', device_id: 'status-check', scope: 'global' },
        });
        if (!alive) return;
        setPinConfigured(data?.reason !== 'NO_PIN_CONFIGURED');
      } catch {
        // If we can't determine, stay neutral and allow user to try the unlock.
        if (!alive) return;
        setPinConfigured(null);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const showInitPin = useMemo(() => pinConfigured === false, [pinConfigured]);

  return (
    <AdminAuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Console admin verrouillée
            </CardTitle>
            <CardDescription>
              Pour accéder à l'administration, vous devez déverrouiller la session avec le PIN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showInitPin && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>PIN non configuré</AlertTitle>
                <AlertDescription>
                  Aucun PIN n'est encore défini. Allez dans « Sécurité » pour initialiser le premier PIN.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              {!showInitPin && (
                <Button className="w-full" onClick={() => setUnlockOpen(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Entrer le PIN
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/admin/security')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Sécurité (initialiser / changer le PIN)
              </Button>

              <Button variant="ghost" className="w-full" onClick={() => navigate('/')}
              >
                Retour au scan
              </Button>
            </div>
          </CardContent>
        </Card>

        <AdminUnlockModal open={unlockOpen} onOpenChange={setUnlockOpen} />
      </div>
    </AdminAuthGuard>
  );
}

export default function AdminConsole() {
  const { isUnlocked } = useAdmin();

  if (!isUnlocked) {
    return <AdminConsoleLocked />;
  }

  return <AdminConsoleUnlocked />;
}
