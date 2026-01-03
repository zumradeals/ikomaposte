import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdmin } from '@/contexts/AdminContext';
import { useDevices, useEnrollDevice, useUpdateDevice } from '@/hooks/useDevices';
import { getDeviceId, getDeviceSecret } from '@/lib/storage';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Tablet, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Copy,
  Check,
  Smartphone
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function AdminDevices() {
  const { isUnlocked } = useAdmin();
  const navigate = useNavigate();
  const { data: devices, isLoading, refetch } = useDevices();
  const enrollDevice = useEnrollDevice();
  const updateDevice = useUpdateDevice();
  const { toast } = useToast();

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollDeviceId, setEnrollDeviceId] = useState('');
  const [enrollDeviceSecret, setEnrollDeviceSecret] = useState('');
  const [enrollLabel, setEnrollLabel] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Current device info
  const currentDeviceId = getDeviceId();
  const currentDeviceSecret = getDeviceSecret();
  const isCurrentDeviceEnrolled = devices?.some(d => d.device_id === currentDeviceId) ?? false;

  useEffect(() => {
    if (!isUnlocked) {
      navigate('/');
    }
  }, [isUnlocked, navigate]);

  if (!isUnlocked) return null;

  const handleEnroll = async () => {
    if (!enrollDeviceId || !enrollDeviceSecret) {
      toast({
        title: 'Données manquantes',
        description: 'Le Device ID et le Device Secret sont requis.',
        variant: 'destructive',
      });
      return;
    }

    await enrollDevice.mutateAsync({
      device_id: enrollDeviceId,
      device_secret: enrollDeviceSecret,
      label: enrollLabel || null,
    });

    setShowEnrollModal(false);
    setEnrollDeviceId('');
    setEnrollDeviceSecret('');
    setEnrollLabel('');
  };

  const handleToggleActive = async (deviceId: string, currentActive: boolean) => {
    await updateDevice.mutateAsync({
      id: deviceId,
      updates: { actif: !currentActive },
    });
  };

  const handleEnrollCurrentDevice = () => {
    setEnrollDeviceId(currentDeviceId);
    setEnrollDeviceSecret(currentDeviceSecret);
    setEnrollLabel(`Tablette Admin (${navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Edge') ? 'Edge' : 'Autre'})`);
    setShowEnrollModal(true);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AdminLayout title="Appareils">
      <div className="space-y-6">
        {/* Header info */}
        <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Système Device Trust</p>
              <p className="text-muted-foreground mt-1">
                Seuls les appareils enrôlés peuvent créer des événements de pointage <strong>vérifiés (TRUSTED)</strong>.
                Les événements provenant d'appareils non enrôlés seront marqués comme <strong>NON VÉRIFIÉS</strong> et ignorés dans les calculs.
              </p>
            </div>
          </div>
        </div>

        {/* Current device status */}
        {!isCurrentDeviceEnrolled && (
          <div className="bg-warning/10 rounded-xl p-4 border border-warning/20">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-warning">Cet appareil n'est pas enrôlé</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Device ID: <code className="bg-muted px-1 rounded text-xs">{currentDeviceId}</code>
                </p>
                <Button 
                  size="sm" 
                  className="mt-2" 
                  onClick={handleEnrollCurrentDevice}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Enrôler cet appareil
                </Button>
              </div>
            </div>
          </div>
        )}

        {isCurrentDeviceEnrolled && (
          <div className="bg-success/10 rounded-xl p-4 border border-success/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success" />
              <div>
                <p className="font-medium text-success">Cet appareil est enrôlé</p>
                <p className="text-sm text-muted-foreground">
                  Device ID: <code className="bg-muted px-1 rounded text-xs">{currentDeviceId}</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-muted-foreground text-sm">
            {devices?.length || 0} appareil(s) enregistré(s)
          </p>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setShowEnrollModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Enrôler un appareil
            </Button>
          </div>
        </div>

        {/* Devices table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !devices?.length ? (
            <div className="text-center p-12 text-muted-foreground">
              <Tablet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun appareil enrôlé</p>
              <p className="text-sm mt-1">
                Utilisez le bouton "Enrôler un appareil" pour ajouter une tablette
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appareil</TableHead>
                    <TableHead className="hidden md:table-cell">Device ID</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${device.actif ? 'bg-success/20' : 'bg-muted'}`}>
                            <Tablet className={`w-5 h-5 ${device.actif ? 'text-success' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {device.label || 'Sans nom'}
                            </p>
                            {device.site_id && (
                              <p className="text-xs text-muted-foreground">
                                Site: {device.site_id}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs">
                        {device.device_id.slice(0, 20)}...
                      </TableCell>
                      <TableCell>
                        {device.actif ? (
                          <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Désactivé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(new Date(device.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={device.actif}
                            onCheckedChange={() => handleToggleActive(device.id, device.actif)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Enrollment instructions */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <h3 className="font-medium mb-2">Comment enrôler une tablette ?</h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Ouvrez l'application sur la tablette à enrôler</li>
            <li>Notez le <strong>Device ID</strong> affiché en bas à gauche de l'écran de scan</li>
            <li>Appuyez longuement (5s) en haut à gauche pour accéder à l'admin</li>
            <li>Connectez-vous et allez dans "Appareils"</li>
            <li>Cliquez sur "Enrôler un appareil" et entrez les informations affichées</li>
          </ol>
        </div>
      </div>

      {/* Enroll modal */}
      <Dialog open={showEnrollModal} onOpenChange={setShowEnrollModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enrôler un nouvel appareil</DialogTitle>
            <DialogDescription>
              Entrez les informations affichées sur l'écran de la tablette à enrôler.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device_id">Device ID *</Label>
              <Input
                id="device_id"
                placeholder="IKOMA-XXXXXXXX-XXXXXXXX"
                value={enrollDeviceId}
                onChange={(e) => setEnrollDeviceId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="device_secret">Device Secret *</Label>
              <Input
                id="device_secret"
                placeholder="Clé secrète de 64 caractères"
                value={enrollDeviceSecret}
                onChange={(e) => setEnrollDeviceSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le secret est affiché sur la tablette lors du premier lancement
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="label">Nom de l'appareil (optionnel)</Label>
              <Input
                id="label"
                placeholder="ex: Tablette Entrée A"
                value={enrollLabel}
                onChange={(e) => setEnrollLabel(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleEnroll}
              disabled={enrollDevice.isPending}
            >
              {enrollDevice.isPending ? 'Enrôlement...' : 'Enrôler'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
