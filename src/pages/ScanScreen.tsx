import { useState, useRef, useCallback, useEffect } from 'react';
import { QrCode, Wifi, WifiOff, FlaskConical, Shield, ShieldAlert, ShieldCheck, Copy, Check } from 'lucide-react';
import { AdminUnlockModal } from '@/components/AdminUnlockModal';
import { TestScanModal } from '@/components/TestScanModal';
import { QRScanner } from '@/components/kiosk/QRScanner';
import { WorkerActionCard } from '@/components/kiosk/WorkerActionCard';
import { useAdmin } from '@/contexts/AdminContext';
import { useWorkerByQrToken, WorkerWithCategory } from '@/hooks/useWorkers';
import { getDeviceId, getDeviceSecret } from '@/lib/storage';
import { checkDeviceTrust } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

type ScreenState = 'idle' | 'scanning' | 'worker-action';

export default function ScanScreen() {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTestScan, setShowTestScan] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [currentWorker, setCurrentWorker] = useState<WorkerWithCategory | null>(null);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const { isUnlocked } = useAdmin();
  const { toast } = useToast();

  const deviceId = getDeviceId();
  const deviceSecret = getDeviceSecret();

  // Check device trust status
  const { data: trustStatus } = useQuery({
    queryKey: ['device-trust', deviceId, deviceSecret],
    queryFn: () => checkDeviceTrust(deviceId, deviceSecret),
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Fetch worker when QR is scanned
  const { data: worker, isLoading: isLoadingWorker } = useWorkerByQrToken(scannedToken || undefined);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle worker lookup result
  useEffect(() => {
    if (scannedToken && !isLoadingWorker) {
      if (worker) {
        setCurrentWorker(worker);
        setScreenState('worker-action');
      } else {
        toast({
          title: 'QR non reconnu',
          description: 'Ce code QR ne correspond à aucun travailleur actif.',
          variant: 'destructive',
        });
        setScannedToken(null);
        setScreenState('scanning');
      }
    }
  }, [worker, isLoadingWorker, scannedToken, toast]);

  // Long press detection for admin unlock (5 seconds)
  const handlePressStart = useCallback(() => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(() => {
      setShowAdminModal(true);
      setIsPressed(false);
    }, 5000);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle QR scan
  const handleQRScan = useCallback((qrToken: string) => {
    setScannedToken(qrToken);
  }, []);

  // Start scanning mode
  const handleStartScan = () => {
    setScreenState('scanning');
  };

  // Return to idle
  const handleBackToIdle = () => {
    setScreenState('idle');
    setScannedToken(null);
    setCurrentWorker(null);
  };

  // After action complete, return to idle
  const handleActionComplete = () => {
    setScreenState('idle');
    setScannedToken(null);
    setCurrentWorker(null);
  };

  // Test scan handler (admin mode)
  const handleTestScan = (token: string) => {
    setShowTestScan(false);
    setScannedToken(token);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: 'Copié',
      description: `${field} copié dans le presse-papiers`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isTrusted = trustStatus?.trusted === true;

  return (
    <div className="kiosk-mode min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
      
      {/* Admin unlock zone (top-left corner, invisible) */}
      <div
        className="admin-unlock-zone top-0 left-0 z-50"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        {isPressed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Admin controls (top right) */}
      {isUnlocked && (
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTestScan(true)}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4" />
            Test
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        
        {/* IDLE STATE - Show logo and start button */}
        {screenState === 'idle' && (
          <>
            {/* Logo / Title */}
            <div className="mb-8 text-center">
              <h1 className="text-4xl md:text-kiosk-title text-foreground mb-2">
                IKOMA <span className="text-primary">POSTE</span>
              </h1>
              <p className="text-lg md:text-kiosk-small text-muted-foreground">
                Système de Pointage
              </p>
            </div>

            {/* Scan Frame / Start Button */}
            <div className="relative w-72 h-72 md:w-80 md:h-80 mb-8">
              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-scan-pulse" />
              
              {/* Main frame - clickable */}
              <button
                onClick={handleStartScan}
                className="absolute inset-2 rounded-2xl bg-card border-2 border-border flex items-center justify-center hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {/* Corner indicators */}
                <div className="scan-corner scan-corner-tl" />
                <div className="scan-corner scan-corner-tr" />
                <div className="scan-corner scan-corner-bl" />
                <div className="scan-corner scan-corner-br" />
                
                {/* QR placeholder */}
                <div className="flex flex-col items-center text-muted-foreground">
                  <QrCode className="w-20 h-20 md:w-24 md:h-24 mb-4 animate-glow" />
                  <p className="text-lg md:text-kiosk-body font-medium">Appuyez pour scanner</p>
                </div>
              </button>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3 px-6 py-4 bg-card rounded-2xl border border-border">
              <div className="status-dot status-ready" />
              <span className="text-lg md:text-kiosk-body text-success">Prêt</span>
            </div>
          </>
        )}

        {/* SCANNING STATE - Show QR Scanner */}
        {screenState === 'scanning' && !currentWorker && (
          <>
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Scanner votre badge
              </h2>
              <p className="text-muted-foreground">
                Présentez votre QR code devant la caméra
              </p>
            </div>

            <div className="w-full max-w-sm mb-6">
              <QRScanner 
                onScan={handleQRScan}
                isActive={screenState === 'scanning' && !scannedToken}
              />
            </div>

            {isLoadingWorker && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Recherche du travailleur...</span>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleBackToIdle}
              className="mt-4"
            >
              Annuler
            </Button>
          </>
        )}

        {/* WORKER ACTION STATE - Show worker card with actions */}
        {screenState === 'worker-action' && currentWorker && (
          <div className="w-full relative">
            <WorkerActionCard
              worker={currentWorker}
              onComplete={handleActionComplete}
              onCancel={handleBackToIdle}
            />
          </div>
        )}
      </div>

      {/* Footer - device info & status */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        {/* Device ID & Trust Status - clickable to show enrollment info */}
        <button
          onClick={() => setShowDeviceInfo(!showDeviceInfo)}
          className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {isTrusted ? (
            <ShieldCheck className="w-4 h-4 text-success" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-warning" />
          )}
          <span className="font-mono">{deviceId}</span>
          <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-muted">
            Enrôlé: {isTrusted ? 'OUI' : 'NON'}
          </span>
        </button>

        <div className="flex items-center gap-2 text-muted-foreground/60">
          {isOnline ? (
            <Wifi className="w-4 h-4 md:w-5 md:h-5 text-success" />
          ) : (
            <WifiOff className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
          )}
        </div>
      </div>

      {/* Device info panel - for enrollment */}
      {showDeviceInfo && (
        <div className="absolute bottom-20 left-4 right-4 md:left-auto md:right-auto md:w-96 bg-card border border-border rounded-xl p-4 shadow-lg z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Informations Appareil</h3>
            </div>
            <button
              onClick={() => setShowDeviceInfo(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            {/* Trust status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isTrusted ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              {isTrusted ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Appareil vérifié</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Appareil non enrôlé</span>
                </>
              )}
            </div>

            {/* Origin (device = navigateur + origin + storage) */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Origin</p>
              <code className="block bg-muted px-2 py-1.5 rounded text-xs font-mono break-all">
                {window.location.origin}
              </code>
            </div>

            {/* Device ID */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Device ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs font-mono break-all">
                  {deviceId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(deviceId, 'Device ID')}
                >
                  {copiedField === 'Device ID' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Device Secret - only show if not enrolled */}
            {!isTrusted && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Device Secret (pour enrôlement)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs font-mono break-all">
                    {deviceSecret.slice(0, 16)}...{deviceSecret.slice(-8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(deviceSecret, 'Device Secret')}
                  >
                    {copiedField === 'Device Secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {trustStatus?.reason && (
              <p className="text-xs text-muted-foreground">
                Raison: {trustStatus.reason}
                {trustStatus.reason === 'secret_mismatch' && (
                  <span className="block mt-1">
                    ATTENTION: ID trouvé côté admin, mais secret différent (cache effacé / autre navigateur / autre origin). Ré-enrôlez cet appareil.
                  </span>
                )}
              </p>
            )}

            {!isTrusted && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                Pour enrôler cet appareil, connectez-vous à l'admin et allez dans "Appareils".
              </p>
            )}
          </div>
        </div>
      )}

      {/* Admin unlock modal */}
      <AdminUnlockModal 
        open={showAdminModal} 
        onOpenChange={setShowAdminModal} 
      />

      {/* Test scan modal (admin only) */}
      <TestScanModal
        open={showTestScan}
        onOpenChange={setShowTestScan}
        onTestScan={handleTestScan}
      />
    </div>
  );
}
