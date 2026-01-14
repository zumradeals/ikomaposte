import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Wrench, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { repairSession } from '@/lib/session-repair';
import { formatRetryTime } from '@/lib/admin-auth';
import { useToast } from '@/hooks/use-toast';

interface AdminUnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminUnlockModal({ open, onOpenChange }: AdminUnlockModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>(undefined);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { attemptUnlock } = useAdmin();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      setPin(['', '', '', '']);
      setError(null);
      setTimeout(() => {
        if (!rateLimited) {
          inputRefs.current[0]?.focus();
        }
      }, 100);
    }
  }, [open, rateLimited]);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (retryAfter > 0) {
      retryTimerRef.current = setInterval(() => {
        setRetryAfter(prev => {
          if (prev <= 1000) {
            setRateLimited(false);
            setError(null);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, [retryAfter > 0]);

  const handleDigitChange = (index: number, value: string) => {
    if (rateLimited) return;
    
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(null);
    
    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when complete
    if (value && index === 3) {
      const fullPin = newPin.join('');
      handleSubmit(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (fullPin: string) => {
    if (rateLimited) return;
    
    setLoading(true);
    
    try {
      const result = await attemptUnlock(fullPin);
      
      if (result.success) {
        onOpenChange(false);
        navigate('/admin');
      } else {
        // Handle rate limiting
        if (result.reason === 'RATE_LIMITED' && result.retryAfterMs) {
          setRateLimited(true);
          setRetryAfter(result.retryAfterMs);
          setError('Trop de tentatives');
        } else {
          // Normal failure
          setAttemptsRemaining(result.attemptsRemaining);
          
          if (result.reason === 'INVALID_PIN') {
            setError('Code incorrect');
          } else if (result.reason === 'NO_PIN_CONFIGURED') {
            setError('Aucun PIN configuré');
          } else {
            setError('Erreur de connexion');
          }
        }
        
        setPin(['', '', '', '']);
        if (!rateLimited) {
          inputRefs.current[0]?.focus();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRepairSession = async () => {
    toast({ 
      title: 'Réparation en cours...', 
      description: 'La page va se recharger.' 
    });
    onOpenChange(false);
    await repairSession();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-3 rounded-xl bg-primary/10">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            Accès Administrateur
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-center text-muted-foreground mb-6 text-lg">
            Entrez le code PIN à 4 chiffres
          </p>

          {/* Rate limit warning */}
          {rateLimited && (
            <div className="flex flex-col items-center justify-center gap-2 text-amber-500 bg-amber-500/10 rounded-lg p-4 mb-6 animate-fade-in">
              <Clock className="w-8 h-8" />
              <span className="text-lg font-medium">Trop de tentatives</span>
              <span className="text-sm">Réessayez dans {formatRetryTime(retryAfter)}</span>
            </div>
          )}

          {/* PIN inputs */}
          <div className="flex justify-center gap-4 mb-6">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`pin-digit ${error && !rateLimited ? 'border-destructive shake' : ''} ${rateLimited ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={loading || rateLimited}
              />
            ))}
          </div>

          {/* Error message */}
          {error && !rateLimited && (
            <div className="flex flex-col items-center justify-center gap-2 text-destructive animate-fade-in mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="text-lg">{error}</span>
              </div>

              {error === 'Aucun PIN configuré' && isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/admin/security/setup');
                  }}
                >
                  Configurer le PIN
                </Button>
              )}

              {attemptsRemaining !== undefined && attemptsRemaining > 0 && (
                <span className="text-sm text-muted-foreground">
                  {attemptsRemaining} tentative{attemptsRemaining > 1 ? 's' : ''} restante{attemptsRemaining > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Session repair button */}
          <div className="border-t border-border pt-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleRepairSession}
            >
              <Wrench className="w-4 h-4 mr-2" />
              Problème de connexion ? Réparer la session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
