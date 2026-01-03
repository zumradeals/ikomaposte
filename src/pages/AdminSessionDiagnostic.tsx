import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Wrench, ShieldAlert, HardDrive, ArrowLeft } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { repairSession, checkSessionHealth } from '@/lib/session-repair';

export default function AdminSessionDiagnostic() {
  const navigate = useNavigate();
  const { isUnlocked, lock } = useAdmin();
  const { session, user, isAdmin, isLoading } = useAuth();

  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkSessionHealth>> | null>(null);

  useEffect(() => {
    if (!isUnlocked) {
      navigate('/', { replace: true });
    }
  }, [isUnlocked, navigate]);

  useEffect(() => {
    let alive = true;
    checkSessionHealth().then((h) => {
      if (alive) setHealth(h);
    });
    return () => {
      alive = false;
    };
  }, []);

  const storageSummary = useMemo(() => {
    const sbKeys: string[] = [];
    const otherKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || key.includes('supabase')) sbKeys.push(key);
      else otherKeys.push(key);
    }

    sbKeys.sort();
    otherKeys.sort();

    return {
      sbKeys,
      otherKeys,
    };
  }, []);

  if (!isUnlocked) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Diagnostic session (Chrome)</h1>
              <p className="text-sm text-muted-foreground">Accessible après PIN, sans connexion</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                lock('Manual lock');
                navigate('/', { replace: true });
              }}
            >
              Sortir
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>État Auth</CardTitle>
            <CardDescription>Ce panneau explique pourquoi Chrome peut afficher « Accès refusé ».</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Session (SDK)</div>
                <div className="font-medium">
                  {session ? 'Présente' : 'Aucune'} {isLoading ? '(chargement...)' : ''}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Admin (role)</div>
                <div className="font-medium">{user ? (isAdmin ? 'Oui' : 'Non') : '—'}</div>
              </div>
            </div>

            <div className="text-sm">
              <div className="text-muted-foreground">User</div>
              <div className="font-mono text-xs break-all">{user?.id || '—'}</div>
              <div className="text-muted-foreground mt-1">Email</div>
              <div className="text-xs">{user?.email || '—'}</div>
            </div>

            <Separator />

            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">Origin</div>
                <div className="font-mono text-xs break-all">{window.location.origin}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">UA</div>
                <div className="text-xs break-all">{navigator.userAgent}</div>
              </div>
            </div>

            {health && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-start gap-2">
                  {health.tokenExpired ? (
                    <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
                  ) : (
                    <HardDrive className="h-5 w-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="text-sm">
                    <div className="font-medium">
                      Token expiré: {health.tokenExpired ? 'Oui' : 'Non'}
                    </div>
                    {health.errorMessage && (
                      <div className="text-destructive text-xs mt-1">{health.errorMessage}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate('/admin')}>
                Aller à /admin
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.reload();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recharger
              </Button>
              <Button
                variant="destructive"
                onClick={() => repairSession()}
              >
                <Wrench className="h-4 w-4 mr-2" />
                Réparer session (Chrome)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clés de stockage</CardTitle>
            <CardDescription>Un « device » = navigateur + origin + storage. Ces clés expliquent les différences Chrome/Edge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Clés sb-* / supabase</div>
              <div className="font-medium">{storageSummary.sbKeys.length}</div>
              {storageSummary.sbKeys.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs font-mono">
                  {storageSummary.sbKeys.slice(0, 12).map((k) => (
                    <li key={k} className="break-all">• {k}</li>
                  ))}
                  {storageSummary.sbKeys.length > 12 && (
                    <li className="text-muted-foreground">… +{storageSummary.sbKeys.length - 12} autres</li>
                  )}
                </ul>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Autres clés (hors sb-*)</div>
              <div className="font-medium">{storageSummary.otherKeys.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
