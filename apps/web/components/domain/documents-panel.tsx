'use client';

import { FileUpload, DocumentList } from './file-upload';
import { Section } from '@/components/shell/page-header';
import { SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { Can, useCan } from '@/lib/auth';
import { useDocuments } from '@/lib/queries/documents';

export function DocumentsPanel({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const can = useCan();
  const docs = useDocuments(can('document:read') ? ownerType : undefined, ownerId);
  return (
    <Section title="Documents">
      <div className="space-y-4">
        <Can permission="document:upload"><FileUpload ownerType={ownerType} ownerId={ownerId} /></Can>
        <Can permission="document:read">
          {docs.isLoading ? <SkeletonRows rows={3} /> : docs.error ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : <DocumentList documents={docs.data} ownerType={ownerType} ownerId={ownerId} />}
        </Can>
      </div>
    </Section>
  );
}
