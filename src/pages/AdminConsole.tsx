import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, Shield, List, Settings, Monitor, Users, FolderOpen, Calendar } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminEvents, getDeviceInfo } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminConsole() {
  const navigate = useNavigate();
  const { isUnlocked, lock, remainingTime } = useAdmin();
  const events = getAdminEvents();
  const deviceInfo = getDeviceInfo();

  // Protect route - redirect if not unlocked
  useEffect(() => {
    if (!isUnlocked) {
      navigate('/', { replace: true });
    }
  }, [isUnlocked, navigate]);

  const handleLock = () => {
    lock('Déconnexion manuelle');
    navigate('/', { replace: true });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground">IKOMA POSTE</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Session timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 rounded-xl">
            <Clock className={`w-5 h-5 ${remainingTime < 30 ? 'text-destructive' : 'text-warning'}`} />
            <span className={`font-mono text-lg font-bold ${remainingTime < 30 ? 'text-destructive' : 'text-warning'}`}>
              {formatTime(remainingTime)}
            </span>
          </div>
          
          {/* Lock button */}
          <Button 
            onClick={handleLock}
            variant="destructive"
            size="lg"
            className="gap-2"
          >
            <LogOut className="w-5 h-5" />
            Verrouiller
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Appareil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">ID Appareil</p>
              <p className="font-mono text-sm">{deviceInfo?.device_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Créé le</p>
              <p className="text-sm">{deviceInfo?.created_at ? formatTimestamp(deviceInfo.created_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dernière activité</p>
              <p className="text-sm">{deviceInfo?.last_seen ? formatTimestamp(deviceInfo.last_seen) : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Phase 2+ Placeholders */}
        <Card className="lg:col-span-2 opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Modules (Phase 2+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-xl text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Travailleurs</p>
              </div>
              <div className="p-4 bg-muted rounded-xl text-center">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Catégories</p>
              </div>
              <div className="p-4 bg-muted rounded-xl text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Journées</p>
              </div>
              <div className="p-4 bg-muted rounded-xl text-center">
                <List className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pointages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Events Log */}
        <Card className="lg:col-span-3">
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
              <div className="max-h-[400px] overflow-y-auto space-y-2">
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
      </div>

      {/* README/Documentation */}
      <Card className="mt-6">
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
  );
}
