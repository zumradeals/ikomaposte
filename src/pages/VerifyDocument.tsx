// ============================================
// IKOMA POSTE - Public Document Verification Page
// ============================================
// Allows anyone to verify document authenticity via QR code
// No sensitive data shown - just verification status
// ============================================

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Loader2, ShieldCheck, ShieldX, FileWarning, QrCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

// Verification status types
type VerificationStatus = 
  | 'loading' 
  | 'authentic' 
  | 'tampered' 
  | 'revoked' 
  | 'not_found' 
  | 'not_signed'
  | 'error';

interface VerificationData {
  documentCode: string;
  documentType: string;
  periodMonth: string;
  signedAt: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export default function VerifyDocument() {
  const { documentCode } = useParams<{ documentCode: string }>();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('id');
  
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [documentData, setDocumentData] = useState<VerificationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    verifyDocument();
  }, [documentCode, documentId]);

  const verifyDocument = async () => {
    setStatus('loading');
    setErrorMessage('');
    
    try {
      // Determine which identifier to use
      const identifier = documentCode || documentId;
      if (!identifier) {
        setStatus('not_found');
        return;
      }

      // Call verification edge function
      const { data, error } = await supabase.functions.invoke('verify-document', {
        body: documentCode 
          ? { documentCode: documentCode }
          : { documentId: documentId }
      });

      if (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage('Erreur de communication avec le serveur');
        return;
      }

      // Process result
      const result = data as {
        valid: boolean;
        status: string;
        message: string;
        document?: {
          documentCode: string;
          status: string;
          signedAt: string | null;
          signatureLevel: string | null;
          revocationReason?: string;
        };
      };

      // Map backend status to UI status
      switch (result.status) {
        case 'OK':
          setStatus('authentic');
          break;
        case 'HASH_MISMATCH':
          setStatus('tampered');
          break;
        case 'REVOKED':
          setStatus('revoked');
          break;
        case 'NOT_FOUND':
          setStatus('not_found');
          break;
        case 'NOT_SIGNED':
          setStatus('not_signed');
          break;
        default:
          setStatus('error');
          setErrorMessage(result.message);
      }

      // Extract document metadata if available
      if (result.document) {
        // Parse document code to extract info
        // Format: IKP-TYPE-YYYYMM-SEQ (e.g., IKP-RAP-202506-014)
        const codeParts = result.document.documentCode.split('-');
        const typeCode = codeParts[1] || 'N/A';
        const monthRaw = codeParts[2] || '';
        const periodMonth = monthRaw.length === 6 
          ? `${monthRaw.slice(0, 4)}-${monthRaw.slice(4)}`
          : monthRaw;

        setDocumentData({
          documentCode: result.document.documentCode,
          documentType: typeCode === 'RAP' ? 'Rapport Individuel' : typeCode === 'PTG' ? 'Pointage Global' : typeCode,
          periodMonth,
          signedAt: result.document.signedAt,
          revokedAt: result.document.status === 'REVOKED' ? new Date().toISOString() : null,
          revocationReason: result.document.revocationReason,
        });
      }
    } catch (err) {
      console.error('Verification exception:', err);
      setStatus('error');
      setErrorMessage('Une erreur inattendue s\'est produite');
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <QrCode className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-white">IKOMA POSTE</h1>
          </div>
          <p className="text-slate-400 text-sm">Vérification d'authenticité de document</p>
        </div>

        {/* Verification Result Card */}
        <Card className={`border-2 transition-all duration-300 ${
          status === 'loading' ? 'border-slate-600 bg-slate-800/50' :
          status === 'authentic' ? 'border-green-500 bg-green-950/50' :
          status === 'revoked' ? 'border-amber-500 bg-amber-950/50' :
          status === 'tampered' ? 'border-red-500 bg-red-950/50' :
          'border-slate-600 bg-slate-800/50'
        }`}>
          <CardContent className="pt-8 pb-6">
            {/* Status Icon */}
            <div className="flex justify-center mb-6">
              {status === 'loading' && (
                <div className="w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
                </div>
              )}
              {status === 'authentic' && (
                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
              )}
              {status === 'tampered' && (
                <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <XCircle className="w-16 h-16 text-red-500" />
                </div>
              )}
              {status === 'revoked' && (
                <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <AlertTriangle className="w-16 h-16 text-amber-500" />
                </div>
              )}
              {status === 'not_found' && (
                <div className="w-24 h-24 rounded-full bg-slate-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <FileWarning className="w-16 h-16 text-slate-400" />
                </div>
              )}
              {status === 'not_signed' && (
                <div className="w-24 h-24 rounded-full bg-slate-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <ShieldX className="w-16 h-16 text-slate-400" />
                </div>
              )}
              {status === 'error' && (
                <div className="w-24 h-24 rounded-full bg-slate-500/20 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <XCircle className="w-16 h-16 text-slate-400" />
                </div>
              )}
            </div>

            {/* Status Text */}
            <div className="text-center mb-6">
              {status === 'loading' && (
                <>
                  <h2 className="text-xl font-semibold text-white mb-2">Vérification en cours...</h2>
                  <p className="text-slate-400 text-sm">Veuillez patienter</p>
                </>
              )}
              {status === 'authentic' && (
                <>
                  <h2 className="text-2xl font-bold text-green-500 mb-2">✅ DOCUMENT AUTHENTIQUE</h2>
                  <p className="text-green-400/80 text-sm">L'intégrité du document est vérifiée</p>
                </>
              )}
              {status === 'tampered' && (
                <>
                  <h2 className="text-2xl font-bold text-red-500 mb-2">❌ DOCUMENT ALTÉRÉ</h2>
                  <p className="text-red-400/80 text-sm">Ce document a été modifié ou falsifié</p>
                </>
              )}
              {status === 'revoked' && (
                <>
                  <h2 className="text-2xl font-bold text-amber-500 mb-2">⚠️ DOCUMENT RÉVOQUÉ</h2>
                  <p className="text-amber-400/80 text-sm">Ce document n'est plus valide</p>
                </>
              )}
              {status === 'not_found' && (
                <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Document introuvable</h2>
                  <p className="text-slate-400 text-sm">Aucun document ne correspond à cette référence</p>
                </>
              )}
              {status === 'not_signed' && (
                <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Document non signé</h2>
                  <p className="text-slate-400 text-sm">Ce document n'a pas encore été validé officiellement</p>
                </>
              )}
              {status === 'error' && (
                <>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Erreur de vérification</h2>
                  <p className="text-slate-400 text-sm">{errorMessage || 'Impossible de vérifier ce document'}</p>
                </>
              )}
            </div>

            {/* Document Info */}
            {documentData && (status === 'authentic' || status === 'tampered' || status === 'revoked') && (
              <div className="border-t border-slate-700 pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Référence</span>
                  <span className="font-mono text-white">{documentData.documentCode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Type</span>
                  <span className="text-white">{documentData.documentType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Période</span>
                  <span className="text-white">{documentData.periodMonth}</span>
                </div>
                {status === 'authentic' && documentData.signedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Signé le</span>
                    <span className="text-green-400">{formatDate(documentData.signedAt)}</span>
                  </div>
                )}
                {status === 'revoked' && documentData.revocationReason && (
                  <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                    <p className="text-amber-400 text-xs font-medium mb-1">Motif de révocation:</p>
                    <p className="text-amber-200/80 text-sm">{documentData.revocationReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Vérification sécurisée IKOMA POSTE</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} IKOMA POSTE - Système de pointage professionnel
        </p>
      </div>
    </div>
  );
}
