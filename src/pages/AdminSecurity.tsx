import { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { initAdminPin, rotateAdminPin } from '@/lib/admin-auth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminAuditLog {
  id: string;
  device_id: string;
  event: string;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AdminSecurity() {
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  
  // PIN initialization form
  const [newPin, setNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  
  // PIN rotation form
  const [currentPin, setCurrentPin] = useState('');
  const [rotateNewPin, setRotateNewPin] = useState('');
  const [confirmRotatePin, setConfirmRotatePin] = useState('');
  const [showRotatePin, setShowRotatePin] = useState(false);
  const [rotateLoading, setRotateLoading] = useState(false);
  
  const { toast } = useToast();

  // Check if PIN is configured
  useEffect(() => {
    checkPinStatus();
    fetchAuditLogs();
  }, []);

  const checkPinStatus = async () => {
    // Call verify with dummy data - if NO_PIN_CONFIGURED, we need to set one.
    // verify-admin-pin returns 200 for NO_PIN_CONFIGURED (expected state).
    const { data, error } = await supabase.functions.invoke('verify-admin-pin', {
      body: { pin: '0000', device_id: 'check', scope: 'global' },
    });

    if (data?.reason === 'NO_PIN_CONFIGURED') {
      setPinConfigured(false);
      return;
    }

    // If something else failed, stay conservative and assume configured to avoid exposing init UI incorrectly.
    if (error) {
      setPinConfigured(true);
      return;
    }

    setPinConfigured(true);
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setAuditLogs((data as AdminAuditLog[]) || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingAudit(false);
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
      toast({ title: 'Succès', description: 'PIN administrateur initialisé' });
      setPinConfigured(true);
      setNewPin('');
      fetchAuditLogs();
    } else {
      toast({
        title: 'Erreur',
        description: `Échec: ${result.reason}`,
        variant: 'destructive'
      });
    }
  };

  const handleRotatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^\d{4}$/.test(currentPin)) {
      toast({ title: 'Erreur', description: 'PIN actuel invalide', variant: 'destructive' });
      return;
    }
    
    if (!/^\d{4}$/.test(rotateNewPin)) {
      toast({ title: 'Erreur', description: 'Le nouveau PIN doit être 4 chiffres', variant: 'destructive' });
      return;
    }
    
    if (rotateNewPin !== confirmRotatePin) {
      toast({ title: 'Erreur', description: 'Les nouveaux PINs ne correspondent pas', variant: 'destructive' });
      return;
    }
    
    setRotateLoading(true);
    const result = await rotateAdminPin(currentPin, rotateNewPin);
    setRotateLoading(false);
    
    if (result.success) {
      toast({ title: 'Succès', description: 'PIN administrateur changé avec succès' });
      setCurrentPin('');
      setRotateNewPin('');
      setConfirmRotatePin('');
      fetchAuditLogs();
    } else {
      toast({ 
        title: 'Erreur', 
        description: result.reason === 'CURRENT_PIN_INCORRECT' 
          ? 'PIN actuel incorrect' 
          : `Échec: ${result.reason}`, 
        variant: 'destructive' 
      });
    }
  };

  const getEventBadge = (event: string) => {
    switch (event) {
      case 'ADMIN_LOGIN_SUCCESS':
        return <Badge className="bg-success/10 text-success border-success/20">Succès</Badge>;
      case 'ADMIN_LOGIN_FAIL':
        return <Badge variant="destructive">Échec</Badge>;
      case 'ADMIN_LOGIN_ATTEMPT':
        return <Badge variant="outline">Tentative</Badge>;
      case 'ADMIN_PIN_ROTATED':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Rotation</Badge>;
      case 'ADMIN_PIN_INITIALIZED':
        return <Badge className="bg-accent/10 text-accent border-accent/20">Init</Badge>;
      default:
        return <Badge variant="secondary">{event}</Badge>;
    }
  };

  return (
    <AdminLayout title="Sécurité" showBack>
      <div className="space-y-6">
        {/* PIN Status Alert */}
        {pinConfigured === false && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>PIN non configuré</AlertTitle>
            <AlertDescription>
              Aucun PIN administrateur n'est configuré. Veuillez en définir un pour sécuriser l'accès.
            </AlertDescription>
          </Alert>
        )}
        
        {pinConfigured === true && (
          <Alert className="bg-success/10 border-success/20">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">PIN configuré</AlertTitle>
            <AlertDescription className="text-success">
              Le PIN administrateur est actif et sécurisé (hashé avec bcrypt).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Initialize PIN (only if not configured) */}
          {pinConfigured === false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Initialiser le PIN
                </CardTitle>
                <CardDescription>
                  Définissez le premier PIN administrateur
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
                        placeholder="****"
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
                  
                  <Button type="submit" className="w-full" disabled={initLoading || newPin.length !== 4}>
                    {initLoading ? 'Initialisation...' : 'Définir le PIN'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Rotate PIN (only if configured) */}
          {pinConfigured === true && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Changer le PIN
                </CardTitle>
                <CardDescription>
                  Effectuez une rotation sécurisée du PIN
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRotatePin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPin">PIN actuel</Label>
                    <Input
                      id="currentPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="****"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rotateNewPin">Nouveau PIN (4 chiffres)</Label>
                    <div className="relative">
                      <Input
                        id="rotateNewPin"
                        type={showRotatePin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        value={rotateNewPin}
                        onChange={(e) => setRotateNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="****"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowRotatePin(!showRotatePin)}
                      >
                        {showRotatePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmRotatePin">Confirmer le nouveau PIN</Label>
                    <Input
                      id="confirmRotatePin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={confirmRotatePin}
                      onChange={(e) => setConfirmRotatePin(e.target.value.replace(/\D/g, ''))}
                      placeholder="****"
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={rotateLoading}>
                    {rotateLoading ? 'Rotation...' : 'Changer le PIN'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Informations de sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>• Le PIN est stocké sous forme de hash bcrypt (irréversible)</p>
              <p>• Chaque tentative de connexion est enregistrée</p>
              <p>• La vérification se fait côté serveur uniquement</p>
              <p>• La session admin expire après 10 minutes d'inactivité</p>
              <p>• L'ancien PIN est automatiquement désactivé lors d'une rotation</p>
            </CardContent>
          </Card>
        </div>

        {/* Audit Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Journal d'audit</CardTitle>
              <CardDescription>Historique des tentatives de connexion admin</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={loadingAudit}>
              <RotateCcw className={`h-4 w-4 mr-2 ${loadingAudit ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAudit ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun événement enregistré
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Détails</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </TableCell>
                        <TableCell>{getEventBadge(log.event)}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate">
                          {log.device_id}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {log.reason || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
