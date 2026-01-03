import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCategories } from '@/hooks/useCategories';
import { useWorkers } from '@/hooks/useWorkers';
import { useTodayEvents } from '@/hooks/useWorkEvents';
import { getAdminEvents, getDeviceInfo } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Users, Tags, List, Clock, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function AdminConsole() {
  const navigate = useNavigate();
  const { isUnlocked } = useAdmin();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const events = getAdminEvents();
  const deviceInfo = getDeviceInfo();
  
  const { data: categories = [] } = useCategories(true);
  const { data: workers = [] } = useWorkers({ includeInactive: true });
  const { data: todayEvents = [] } = useTodayEvents('all');

  // Protect route - redirect if not unlocked
  useEffect(() => {
    if (!isUnlocked) {
      navigate('/', { replace: true });
    }
  }, [isUnlocked, navigate]);

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

  if (!isUnlocked) {
    return null;
  }

  const activeWorkers = workers.filter(w => w.actif).length;
  const activeCategories = categories.filter(c => c.actif).length;
  const trustedEvents = todayEvents.filter(e => e.trust_status === 'trusted').length;
  const untrustedEvents = todayEvents.filter(e => e.trust_status === 'untrusted').length;

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
                       {untrustedEvents} <ShieldAlert className="inline w-3 h-3 text-destructive" />)
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
                  <div 
                    key={event.id} 
                    className="flex items-center gap-4 p-4 bg-muted rounded-xl"
                  >
                    <div className={`w-3 h-3 rounded-full ${
                      event.event_type === 'ADMIN_UNLOCK' ? 'bg-success' : 'bg-warning'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${
                          event.event_type === 'ADMIN_UNLOCK' ? 'text-success' : 'text-warning'
                        }`}>
                          {event.event_type === 'ADMIN_UNLOCK' ? 'Déverrouillage' : 'Verrouillage'}
                        </span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded">
                          {event.actor}
                        </span>
                      </div>
                      {event.optional_reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.optional_reason}
                        </p>
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
                  <li>Entrez le code PIN (défaut: 1234)</li>
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
