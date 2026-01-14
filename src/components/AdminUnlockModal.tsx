import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { repairSession } from '@/lib/session-repair';
import { useToast } from '@/hooks/use-toast';

interface AdminUnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminUnlockModal({ open, onOpenChange }: AdminUnlockModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { attemptUnlock } = useAdmin();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      setPin(['', '', '', '']);
      setError(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [open]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(false);
    
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
    setLoading(true);
    
    try {
      const success = await attemptUnlock(fullPin);
      
      if (success) {
        onOpenChange(false);
        
        // If already authenticated as admin, go directly to dashboard
        // Otherwise, navigate to admin (which will show login form)
        if (user && isAdmin) {
          navigate('/admin');
        } else {
          navigate('/admin');
        }
      } else {
        setError(true);
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
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
                className={`pin-digit ${error ? 'border-destructive shake' : ''}`}
                disabled={loading}
              />
            ))}
          </div>
          
          {/* Error message */}
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive animate-fade-in mb-4">
              <AlertCircle className="w-5 h-5" />
              <span className="text-lg">Code incorrect ou erreur serveur</span>
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
