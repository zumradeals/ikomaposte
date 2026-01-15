// ============================================
// Document History Table Component with Signature Support
// ============================================

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Download, 
  FileText, 
  History, 
  User, 
  Users, 
  MoreVertical,
  Stamp,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { 
  useDocuments, 
  useDownloadDocument, 
  useSignDocument,
  useVerifyDocument,
  useRevokeDocument,
  useRegeneratePDFs,
  Document,
  SignatureLevel,
  VerificationResult,
} from '@/hooks/useDocuments';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DocumentQRCode } from './DocumentQRCode';

interface DocumentHistoryTableProps {
  periodMonth?: string;
}

export function DocumentHistoryTable({ periodMonth }: DocumentHistoryTableProps) {
  const { data: documents, isLoading } = useDocuments(periodMonth);
  const downloadDoc = useDownloadDocument();
  const signDoc = useSignDocument();
  const verifyDoc = useVerifyDocument();
  const revokeDoc = useRevokeDocument();
  const regeneratePDFs = useRegeneratePDFs();

  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusBadge = (doc: Document) => {
    switch (doc.status) {
      case 'SIGNED':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <ShieldCheck className="h-3 w-3" />
            Signé
          </Badge>
        );
      case 'REVOKED':
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldX className="h-3 w-3" />
            Révoqué
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            Brouillon
          </Badge>
        );
    }
  };

  const handleSign = async (level: SignatureLevel) => {
    if (!selectedDoc) return;
    await signDoc.mutateAsync({
      documentId: selectedDoc.id,
      signatureLevel: level,
    });
    setSignDialogOpen(false);
    setSelectedDoc(null);
  };

  const handleRevoke = async () => {
    if (!selectedDoc || revokeReason.length < 10) return;
    await revokeDoc.mutateAsync({
      documentId: selectedDoc.id,
      reason: revokeReason,
    });
    setRevokeDialogOpen(false);
    setSelectedDoc(null);
    setRevokeReason('');
  };

  const handleVerify = async () => {
    if (!selectedDoc) return;
    const result = await verifyDoc.mutateAsync({
      documentId: selectedDoc.id,
    });
    setVerificationResult(result);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des documents
            </CardTitle>
            <CardDescription>
              Documents PDF générés avec signature électronique et traçabilité opposable
            </CardDescription>
          </div>
          {documents && documents.some(d => d.status === 'DRAFT_PDF') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => regeneratePDFs.mutate()}
              disabled={regeneratePDFs.isPending}
              className="gap-2"
            >
              {regeneratePDFs.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Réparer les PDFs
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !documents?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun document généré</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Généré le</TableHead>
                    <TableHead>Hash source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className={doc.status === 'REVOKED' ? 'opacity-50' : ''}>
                      <TableCell className="font-mono font-medium">
                        {doc.document_code}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={doc.document_type === 'RAP' ? 'default' : 'secondary'}
                          className="gap-1"
                        >
                          {doc.document_type === 'RAP' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Users className="h-3 w-3" />
                          )}
                          {doc.document_type === 'RAP' ? 'Individuel' : 'Global'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(doc)}</TableCell>
                      <TableCell>{doc.period_month}</TableCell>
                      <TableCell>
                        {format(new Date(doc.generated_at), 'dd MMM yyyy HH:mm', {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {doc.source_hash.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => downloadDoc.mutate(doc)}
                              disabled={downloadDoc.isPending}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger PDF
                            </DropdownMenuItem>
                            
                            {doc.status === 'DRAFT_PDF' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedDoc(doc);
                                  setSignDialogOpen(true);
                                }}
                              >
                                <Stamp className="h-4 w-4 mr-2" />
                                Signer & Cacheter
                              </DropdownMenuItem>
                            )}

                            {doc.status === 'SIGNED' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedDoc(doc);
                                    setQrDialogOpen(true);
                                  }}
                                >
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Afficher QR Code
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedDoc(doc);
                                    setVerificationResult(null);
                                    setVerifyDialogOpen(true);
                                  }}
                                >
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  Vérifier intégrité
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedDoc(doc);
                                    setRevokeReason('');
                                    setRevokeDialogOpen(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <ShieldX className="h-4 w-4 mr-2" />
                                  Révoquer
                                </DropdownMenuItem>
                              </>
                            )}

                            {doc.status === 'REVOKED' && doc.revocation_reason && (
                              <DropdownMenuItem disabled>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                {doc.revocation_reason.substring(0, 30)}...
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code de vérification
            </DialogTitle>
            <DialogDescription>
              Ce QR code permet de vérifier l'authenticité du document {selectedDoc?.document_code}
            </DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <DocumentQRCode documentCode={selectedDoc.document_code} showCard={false} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="h-5 w-5" />
              Signer & Cacheter
            </DialogTitle>
            <DialogDescription>
              Choisissez le niveau de signature pour {selectedDoc?.document_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleSign('VISUAL')}
              disabled={signDoc.isPending}
            >
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Visuel uniquement</p>
                <p className="text-xs text-muted-foreground">Ajoute un cachet visuel au PDF</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleSign('SEALED')}
              disabled={signDoc.isPending}
            >
              <ShieldCheck className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Scellé uniquement</p>
                <p className="text-xs text-muted-foreground">Hash cryptographique sans visuel</p>
              </div>
            </Button>
            <Button
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleSign('BOTH')}
              disabled={signDoc.isPending}
            >
              {signDoc.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Stamp className="h-5 w-5" />
              )}
              <div className="text-left">
                <p className="font-medium">Visuel + Scellé (Recommandé)</p>
                <p className="text-xs text-muted-foreground">Cachet visuel avec hash cryptographique</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Vérification d'intégrité
            </DialogTitle>
            <DialogDescription>
              Vérifier l'authenticité de {selectedDoc?.document_code}
            </DialogDescription>
          </DialogHeader>
          
          {!verificationResult ? (
            <div className="text-center py-6">
              <Button onClick={handleVerify} disabled={verifyDoc.isPending} className="gap-2">
                {verifyDoc.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Lancer la vérification
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg flex items-start gap-3 ${
                verificationResult.valid 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-destructive/10 border border-destructive/30'
              }`}>
                {verificationResult.valid ? (
                  <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div>
                  <p className={`font-medium ${verificationResult.valid ? 'text-green-500' : 'text-destructive'}`}>
                    {verificationResult.status === 'OK' ? 'INTÉGRITÉ VÉRIFIÉE' : 'ÉCHEC VÉRIFICATION'}
                  </p>
                  <p className="text-sm text-muted-foreground">{verificationResult.message}</p>
                </div>
              </div>

              {verificationResult.document && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hash stocké:</span>
                    <code className="bg-muted px-1 rounded text-xs">
                      {verificationResult.document.storedHash?.substring(0, 16)}...
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hash calculé:</span>
                    <code className="bg-muted px-1 rounded text-xs">
                      {verificationResult.document.calculatedHash?.substring(0, 16)}...
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Niveau:</span>
                    <span>{verificationResult.document.signatureLevel}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" />
              Révoquer le document
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le document {selectedDoc?.document_code} sera marqué comme révoqué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motif de révocation (min. 10 caractères)</label>
              <Textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Expliquez pourquoi ce document doit être révoqué..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {revokeReason.length}/10 caractères minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revokeReason.length < 10 || revokeDoc.isPending}
            >
              {revokeDoc.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldX className="h-4 w-4 mr-2" />
              )}
              Révoquer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
