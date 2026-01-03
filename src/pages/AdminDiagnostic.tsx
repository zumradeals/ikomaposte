/**
 * Admin Diagnostic Page - Phase 4.5
 * Debug panel for troubleshooting auth, device trust, and app state
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, Download, Trash2, AlertTriangle, CheckCircle, 
  XCircle, Wifi, WifiOff, Shield, ShieldOff, Upload,
  HardDrive, User, Clock
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getDeviceSecret, getDeviceInfo } from '@/lib/storage';
import { repairSession, clearAppCache, checkSessionHealth } from '@/lib/session-repair';
import { checkDeviceTrust } from '@/hooks/useDevices';
import { useTodayEvents } from '@/hooks/useWorkEvents';

interface DiagnosticData {
  timestamp: string;
  auth: {
    hasSession: boolean;
    hasUser: boolean;
    userId: string | null;
    email: string | null;
    isAdmin: boolean;
    tokenExpired: boolean;
    errorMessage: string | null;
  };
  device: {
    deviceId: string;
    deviceSecret: string;
    createdAt: string | null;
    lastSeen: string | null;
    trustStatus: 'trusted' | 'untrusted' | 'checking';
    trustReason: string;
  };
  app: {
    isOnline: boolean;
    serviceWorkerActive: boolean;
    cacheVersion: string;
  };
  events: {
    todayTotal: number;
    todayTrusted: number;
    todayUntrusted: number;
  };
  errors: string[];
}

export default function AdminDiagnostic() {
  const navigate = useNavigate();
  const { isUnlocked } = useAdmin();
  const { user, session, isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [uploadTestResult, setUploadTestResult] = useState<string | null>(null);
  const [isTestingUpload, setIsTestingUpload] = useState(false);

  const { data: todayEvents } = useTodayEvents('all');

  // Redirect if not unlocked
  useEffect(() => {
    if (!isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  const runDiagnostic = async () => {
    setIsRunning(true);
    const errors: string[] = [];

    try {
      // 1. Check session health
      const sessionHealth = await checkSessionHealth();

      // 2. Get device info
      const deviceId = getDeviceId();
      const deviceSecret = getDeviceSecret();
      const deviceInfo = getDeviceInfo();

      // 3. Check device trust
      let trustStatus: 'trusted' | 'untrusted' | 'checking' = 'checking';
      let trustReason = 'Checking...';
      try {
        const trustResult = await checkDeviceTrust(deviceId, deviceSecret);
        trustStatus = trustResult.trusted ? 'trusted' : 'untrusted';
        trustReason = trustResult.reason;
      } catch (err) {
        trustStatus = 'untrusted';
        trustReason = err instanceof Error ? err.message : 'Trust check failed';
        errors.push(`Trust check error: ${trustReason}`);
      }

      // 4. Check service worker
      let swActive = false;
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        swActive = !!registration?.active;
      }

      // 5. Count events
      const trusted = todayEvents?.filter(e => e.trust_status === 'trusted').length || 0;
      const untrusted = todayEvents?.filter(e => e.trust_status === 'untrusted').length || 0;

      setDiagnostic({
        timestamp: new Date().toISOString(),
        auth: {
          hasSession: sessionHealth.hasSession,
          hasUser: sessionHealth.hasUser,
          userId: user?.id || null,
          email: user?.email || null,
          isAdmin,
          tokenExpired: sessionHealth.tokenExpired,
          errorMessage: sessionHealth.errorMessage,
        },
        device: {
          deviceId,
          deviceSecret: deviceSecret.substring(0, 8) + '...',
          createdAt: deviceInfo?.created_at || null,
          lastSeen: deviceInfo?.last_seen || null,
          trustStatus,
          trustReason,
        },
        app: {
          isOnline: navigator.onLine,
          serviceWorkerActive: swActive,
          cacheVersion: 'ikoma-poste-v1',
        },
        events: {
          todayTotal: (todayEvents?.length || 0),
          todayTrusted: trusted,
          todayUntrusted: untrusted,
        },
        errors,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Diagnostic failed');
      toast({
        title: 'Erreur diagnostic',
        description: 'Impossible de compléter le diagnostic',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestUpload = async () => {
    setIsTestingUpload(true);
    setUploadTestResult(null);

    try {
      const testBlob = new Blob(['IKOMA TEST ' + Date.now()], { type: 'text/plain' });
      const testPath = `_diagnostic/${getDeviceId()}/test-${Date.now()}.txt`;

      const { error } = await supabase.storage
        .from('work-snapshots')
        .upload(testPath, testBlob, { upsert: true });

      if (error) {
        setUploadTestResult(`❌ Échec: ${error.message}`);
      } else {
        setUploadTestResult('✅ Upload réussi');
        // Clean up test file
        await supabase.storage.from('work-snapshots').remove([testPath]);
      }
    } catch (err) {
      setUploadTestResult(`❌ Erreur: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsTestingUpload(false);
    }
  };

  const handleExportLogs = () => {
    if (!diagnostic) {
      toast({ title: 'Lancez d\'abord un diagnostic' });
      return;
    }

    const exportData = {
      ...diagnostic,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ikoma-diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Logs exportés' });
  };

  const handleRepairSession = async () => {
    toast({ title: 'Réparation en cours...', description: 'La page va se recharger.' });
    await repairSession();
  };

  const handleClearCache = async () => {
    toast({ title: 'Vidage cache...', description: 'La page va se recharger.' });
    await clearAppCache();
  };

  // Auto-run diagnostic on mount
  useEffect(() => {
    if (isUnlocked && !authLoading) {
      runDiagnostic();
    }
  }, [isUnlocked, authLoading, todayEvents]);

  if (!isUnlocked) return null;

  return (
    <AdminLayout title="Diagnostic" showBack>
      <div className="space-y-6">
        {/* Actions bar */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={runDiagnostic} disabled={isRunning}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            Relancer diagnostic
          </Button>
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Exporter JSON
          </Button>
          <Button variant="destructive" onClick={handleRepairSession}>
            <Trash2 className="w-4 h-4 mr-2" />
            Réparer session
          </Button>
          <Button variant="secondary" onClick={handleClearCache}>
            <HardDrive className="w-4 h-4 mr-2" />
            Vider cache app
          </Button>
        </div>

        {/* Diagnostic results */}
        {diagnostic && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Auth Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Authentification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Session</span>
                  <Badge variant={diagnostic.auth.hasSession ? 'default' : 'destructive'}>
                    {diagnostic.auth.hasSession ? 'Active' : 'Aucune'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Admin</span>
                  <Badge variant={diagnostic.auth.isAdmin ? 'default' : 'secondary'}>
                    {diagnostic.auth.isAdmin ? 'Oui' : 'Non'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Token expiré</span>
                  {diagnostic.auth.tokenExpired ? (
                    <Badge variant="destructive">Oui</Badge>
                  ) : (
                    <Badge variant="outline">Non</Badge>
                  )}
                </div>
                {diagnostic.auth.email && (
                  <div className="text-sm text-muted-foreground">
                    Email: {diagnostic.auth.email}
                  </div>
                )}
                {diagnostic.auth.userId && (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    ID: {diagnostic.auth.userId}
                  </div>
                )}
                {diagnostic.auth.errorMessage && (
                  <div className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {diagnostic.auth.errorMessage}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {diagnostic.device.trustStatus === 'trusted' ? (
                    <Shield className="w-5 h-5 text-success" />
                  ) : (
                    <ShieldOff className="w-5 h-5 text-destructive" />
                  )}
                  Appareil
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trust Status</span>
                  <Badge variant={diagnostic.device.trustStatus === 'trusted' ? 'default' : 'destructive'}>
                    {diagnostic.device.trustStatus === 'trusted' ? 'ENRÔLÉ' : 'NON ENRÔLÉ'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Raison: {diagnostic.device.trustReason}
                </div>
                <Separator />
                <div className="text-xs font-mono">
                  <div>ID: {diagnostic.device.deviceId}</div>
                  <div>Secret: {diagnostic.device.deviceSecret}</div>
                </div>
              </CardContent>
            </Card>

            {/* App Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {diagnostic.app.isOnline ? (
                    <Wifi className="w-5 h-5 text-success" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-destructive" />
                  )}
                  Application
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Connexion</span>
                  <Badge variant={diagnostic.app.isOnline ? 'default' : 'destructive'}>
                    {diagnostic.app.isOnline ? 'En ligne' : 'Hors ligne'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Service Worker</span>
                  <Badge variant={diagnostic.app.serviceWorkerActive ? 'default' : 'secondary'}>
                    {diagnostic.app.serviceWorkerActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Cache: {diagnostic.app.cacheVersion}
                </div>
              </CardContent>
            </Card>

            {/* Events Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Events du jour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold">{diagnostic.events.todayTotal}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <div className="text-2xl font-bold text-success">{diagnostic.events.todayTrusted}</div>
                    <div className="text-xs text-muted-foreground">Trusted</div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <div className="text-2xl font-bold text-destructive">{diagnostic.events.todayUntrusted}</div>
                    <div className="text-xs text-muted-foreground">Untrusted</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upload Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Test Upload Snapshot
            </CardTitle>
            <CardDescription>
              Teste la capacité d'upload vers le bucket work-snapshots
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleTestUpload} disabled={isTestingUpload}>
              {isTestingUpload ? 'Test en cours...' : 'Lancer test upload'}
            </Button>
            {uploadTestResult && (
              <div className={`text-sm p-3 rounded-lg ${
                uploadTestResult.startsWith('✅') 
                  ? 'bg-success/10 text-success' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {uploadTestResult}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors */}
        {diagnostic && diagnostic.errors.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                Erreurs détectées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {diagnostic.errors.map((err, i) => (
                  <li key={i} className="text-sm text-destructive">• {err}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Timestamp */}
        {diagnostic && (
          <p className="text-xs text-muted-foreground text-center">
            Diagnostic effectué le {new Date(diagnostic.timestamp).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
