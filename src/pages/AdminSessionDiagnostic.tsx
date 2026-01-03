import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Wrench, ShieldAlert, HardDrive, ArrowLeft, AlertTriangle, Copy, Check } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { repairSession, checkSessionHealth } from '@/lib/session-repair';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeviceInconsistency {
  device_id: string;
  event_count: number;
  last_seen: string;
}

export default function AdminSessionDiagnostic() {
  const navigate = useNavigate();
  const { isUnlocked, lock } = useAdmin();
  const { session, user, isAdmin, isLoading } = useAuth();

  const { toast } = useToast();

  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkSessionHealth>> | null>(null);
  const [inconsistencies, setInconsistencies] = useState<DeviceInconsistency[]>([]);
  const [loadingInconsistencies, setLoadingInconsistencies] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fetchInconsistencies = async () => {
    setLoadingInconsistencies(true);
    try {
      // Get all unique device_ids from work_events
      const { data: events, error: eventsError } = await supabase
        .from('work_events')
        .select('device_id, occurred_at')
        .order('occurred_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Get all enrolled device_ids
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('device_id');

      if (devicesError) throw devicesError;

      const enrolledIds = new Set(devices?.map(d => d.device_id) || []);

      // Find device_ids in events but not in devices
      const eventsByDevice = new Map<string, { count: number; lastSeen: string }>();
      
      for (const event of events || []) {
        if (!enrolledIds.has(event.device_id)) {
          const existing = eventsByDevice.get(event.device_id);
          if (existing) {
            existing.count++;
          } else {
            eventsByDevice.set(event.device_id, { 
              count: 1, 
              lastSeen: event.occurred_at 
            });
          }
        }
      }

      const result: DeviceInconsistency[] = Array.from(eventsByDevice.entries())
        .map(([device_id, { count, lastSeen }]) => ({
          device_id,
          event_count: count,
          last_seen: lastSeen
        }))
        .sort((a, b) => b.event_count - a.event_count);

      setInconsistencies(result);
    } catch (error) {
      console.error('Error fetching inconsistencies:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les incohérences',
        variant: 'destructive'
      });
    } finally {
      setLoadingInconsistencies(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchInconsistencies();
    }
  }, [isUnlocked]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Incohérences device
                </CardTitle>
                <CardDescription>
                  Device_id vus dans work_events mais absents de la table devices (non enrôlés)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInconsistencies}
                disabled={loadingInconsistencies}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingInconsistencies ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingInconsistencies ? (
              <div className="text-center py-4 text-muted-foreground">Chargement...</div>
            ) : inconsistencies.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Aucune incohérence détectée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead className="text-right">Événements</TableHead>
                    <TableHead>Dernier vu</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inconsistencies.map((inc) => (
                    <TableRow key={inc.device_id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {inc.device_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{inc.event_count}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inc.last_seen).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(inc.device_id)}
                          title="Copier pour enrôlement"
                        >
                          {copiedId === inc.device_id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {inconsistencies.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                💡 Copiez le device_id puis allez dans Admin → Appareils pour enrôler l'appareil manuellement.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
