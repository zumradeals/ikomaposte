import { useState, useCallback, useRef } from 'react';
import { User, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkerWithCategory } from '@/hooks/useWorkers';
import { useAllowedActions, useCreateWorkEvent, uploadSnapshot } from '@/hooks/useWorkEvents';
import { 
  WorkEventType, 
  EVENT_LABELS, 
  EVENT_ICONS, 
  ALLOWED_TRANSITIONS 
} from '@/types/work-events';
import { SnapshotCapture } from './SnapshotCapture';
import { getDeviceId } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface WorkerActionCardProps {
  worker: WorkerWithCategory;
  onComplete: () => void;
  onCancel: () => void;
}

export function WorkerActionCard({ worker, onComplete, onCancel }: WorkerActionCardProps) {
  const { allowedActions, lastEvent, isLoading, currentState } = useAllowedActions(worker.id);
  const createEvent = useCreateWorkEvent();
  const { toast } = useToast();
  
  const [selectedAction, setSelectedAction] = useState<WorkEventType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureSnapshot, setCaptureSnapshot] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const pendingActionRef = useRef<WorkEventType | null>(null);

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const handleCameraError = useCallback((error: string) => {
    setCameraError(error);
  }, []);

  const handleActionClick = (action: WorkEventType) => {
    if (!allowedActions.includes(action)) {
      toast({
        title: 'Action non autorisée',
        description: getTransitionErrorMessage(currentState, action),
        variant: 'destructive',
      });
      return;
    }

    // In strict mode, camera must be ready
    if (!cameraReady && !cameraError) {
      toast({
        title: 'Patientez',
        description: 'La caméra n\'est pas encore prête.',
      });
      return;
    }

    // If camera error in strict mode, block action
    if (cameraError) {
      toast({
        title: 'Capture requise',
        description: 'La caméra est indisponible. Action bloquée en mode strict.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedAction(action);
    pendingActionRef.current = action;
    setCaptureSnapshot(true);
    setIsProcessing(true);
  };

  const handleSnapshotCapture = async (blob: Blob) => {
    const action = pendingActionRef.current;
    if (!action) return;

    try {
      const deviceId = getDeviceId();
      const tempEventId = crypto.randomUUID();
      
      // Upload snapshot first
      const { url, hash } = await uploadSnapshot(blob, deviceId, worker.id, tempEventId);
      
      // Create the event with snapshot
      await createEvent.mutateAsync({
        worker_id: worker.id,
        event_type: action,
        snapshot_url: url,
        snapshot_hash: hash,
      });

      toast({
        title: EVENT_LABELS[action],
        description: `${worker.nom_affiche} - Enregistré avec succès`,
      });

      // Auto-return after 1.5 seconds
      setTimeout(() => {
        onComplete();
      }, 1500);
      
    } catch (error) {
      console.error('Action error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer l\'action.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setCaptureSnapshot(false);
      setSelectedAction(null);
    }
  };

  const handleSnapshotError = (error: string) => {
    // In strict mode, block the action
    toast({
      title: 'Capture échouée',
      description: error,
      variant: 'destructive',
    });
    setIsProcessing(false);
    setCaptureSnapshot(false);
    setSelectedAction(null);
    pendingActionRef.current = null;
  };

  // Status indicator based on current state
  const getStatusInfo = () => {
    switch (currentState) {
      case 'TAKE':
        return { text: 'En poste', color: 'text-success', bg: 'bg-success/20' };
      case 'PAUSE':
        return { text: 'En pause', color: 'text-warning', bg: 'bg-warning/20' };
      case 'RESUME':
        return { text: 'En poste (reprise)', color: 'text-primary', bg: 'bg-primary/20' };
      case 'END':
      case 'NONE':
      default:
        return { text: 'Hors poste', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const status = getStatusInfo();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const allActions: WorkEventType[] = ['TAKE', 'PAUSE', 'RESUME', 'END'];

  return (
    <div className="bg-card rounded-3xl border-2 border-border p-6 max-w-md mx-auto">
      {/* Close button */}
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted"
        disabled={isProcessing}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Worker info */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden">
          {worker.photo_url ? (
            <img 
              src={worker.photo_url} 
              alt={worker.nom_affiche} 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{worker.nom_affiche}</h2>
          <p className="text-muted-foreground">{worker.matricule}</p>
          {worker.categories && (
            <p className="text-primary font-medium">{worker.categories.nom}</p>
          )}
        </div>

        {/* Snapshot camera preview */}
        <SnapshotCapture
          onCapture={handleSnapshotCapture}
          onError={handleSnapshotError}
          trigger={captureSnapshot}
          onReady={handleCameraReady}
        />
      </div>

      {/* Current status */}
      <div className={`${status.bg} rounded-xl p-3 mb-6 flex items-center justify-center gap-2`}>
        <Clock className={`w-5 h-5 ${status.color}`} />
        <span className={`font-medium ${status.color}`}>{status.text}</span>
        {lastEvent && (
          <span className="text-muted-foreground text-sm">
            depuis {new Date(lastEvent.occurred_at).toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
      </div>

      {/* Action buttons - 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {allActions.map((action) => {
          const isAllowed = allowedActions.includes(action);
          const isSelected = selectedAction === action && isProcessing;
          
          return (
            <Button
              key={action}
              onClick={() => handleActionClick(action)}
              disabled={!isAllowed || isProcessing}
              className={`
                h-24 text-xl font-bold flex flex-col items-center justify-center gap-2
                ${isSelected ? 'ring-4 ring-primary' : ''}
                ${!isAllowed ? 'opacity-40 cursor-not-allowed' : ''}
                ${action === 'TAKE' ? 'bg-success hover:bg-success/90' : ''}
                ${action === 'PAUSE' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
                ${action === 'RESUME' ? 'bg-primary hover:bg-primary/90' : ''}
                ${action === 'END' ? 'bg-destructive hover:bg-destructive/90' : ''}
              `}
            >
              <span className="text-3xl">{EVENT_ICONS[action]}</span>
              <span>{EVENT_LABELS[action].split(' ')[0]}</span>
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </Button>
          );
        })}
      </div>

      {/* Transition error hint */}
      {currentState !== 'NONE' && currentState !== 'END' && (
        <p className="text-center text-muted-foreground text-sm mt-4">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Actions disponibles: {allowedActions.map(a => EVENT_LABELS[a]).join(', ')}
        </p>
      )}

      {/* Success indicator */}
      {selectedAction && isProcessing && !captureSnapshot && (
        <div className="mt-6 flex items-center justify-center gap-2 text-success">
          <CheckCircle className="w-6 h-6" />
          <span className="font-medium">Enregistré !</span>
        </div>
      )}
    </div>
  );
}

function getTransitionErrorMessage(currentState: WorkEventType | 'NONE', action: WorkEventType): string {
  switch (action) {
    case 'TAKE':
      if (currentState === 'TAKE' || currentState === 'RESUME') {
        return 'Vous êtes déjà en poste.';
      }
      if (currentState === 'PAUSE') {
        return 'Vous devez d\'abord reprendre ou terminer.';
      }
      break;
    case 'PAUSE':
      if (currentState === 'NONE' || currentState === 'END') {
        return 'Vous devez d\'abord prendre votre poste.';
      }
      if (currentState === 'PAUSE') {
        return 'Vous êtes déjà en pause.';
      }
      break;
    case 'RESUME':
      if (currentState !== 'PAUSE') {
        return 'Vous n\'êtes pas en pause.';
      }
      break;
    case 'END':
      if (currentState === 'NONE' || currentState === 'END') {
        return 'Vous n\'êtes pas en poste.';
      }
      break;
  }
  return 'Cette action n\'est pas autorisée dans l\'état actuel.';
}
