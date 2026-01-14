// ============================================
// Document History Table Component
// ============================================

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
import { Download, FileText, History, User, Users } from 'lucide-react';
import { useDocuments, useDownloadDocument, Document } from '@/hooks/useDocuments';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentHistoryTableProps {
  periodMonth?: string;
}

export function DocumentHistoryTable({ periodMonth }: DocumentHistoryTableProps) {
  const { data: documents, isLoading } = useDocuments(periodMonth);
  const downloadDoc = useDownloadDocument();

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historique des documents
        </CardTitle>
        <CardDescription>
          Documents PDF générés avec traçabilité opposable
        </CardDescription>
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
                  <TableHead>Période</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Généré le</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
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
                    <TableCell>{doc.period_month}</TableCell>
                    <TableCell>{doc.source_row_count}</TableCell>
                    <TableCell>{formatFileSize(doc.file_size_bytes)}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadDoc.mutate(doc)}
                        disabled={downloadDoc.isPending}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
