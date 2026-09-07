'use client';

import { Download, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { FileUpload } from '@/components/domain/file-upload';
import { ReportExport } from '@/components/domain/report-export';
import { useCan } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { useEngagementReport } from '@/lib/queries/reports';
import { useUpdateEngagement } from '@/lib/queries/engagements';
import { downloadDocument, useDocuments } from '@/lib/queries/documents';
import type { Engagement } from '@/lib/types';

export function ReportTab({ engagement }: { engagement: Engagement }) {
  const can = useCan();
  const report = useEngagementReport(engagement.id);
  const docs = useDocuments(can('document:read') ? 'Engagement' : undefined, engagement.id);
  const update = useUpdateEngagement(engagement.id);
  const editable = can('engagement:manage') && engagement.stage !== 'CLOSED';
  const attached = docs.data?.find((d) => d.id === engagement.reportDocumentId);
  return (
    <div className="space-y-5">
      <Section title="Report file" actions={editable && engagement.reportDocumentId ? <Button size="icon-sm" variant="ghost" title="Detach report file" aria-label="Detach report file" loading={update.isPending} onClick={() => update.mutate({ reportDocumentId: null })}><Unlink /></Button> : null}>
        <div className="space-y-3">
          {engagement.reportDocumentId ? <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-all text-sm">{attached?.fileName ?? 'Attached report'}</p>{can('document:read') ? <Button size="sm" variant="outline" onClick={() => downloadDocument(engagement.reportDocumentId!).catch((error) => toast.error(errorMessage(error)))}><Download /> Download original</Button> : null}</div> : <p className="text-sm text-muted-foreground">No report file attached.</p>}
          {editable && can('document:upload') ? <FileUpload ownerType="Engagement" ownerId={engagement.id} multiple={false} compact onUploaded={async (doc) => { await update.mutateAsync({ reportDocumentId: doc.id }); }} /> : null}
        </div>
      </Section>
      <Section title="Audit report draft" actions={<ReportExport path={`/reports/engagements/${engagement.id}`} />}>
        <Badge variant="outline" className="mb-4">Draft</Badge>
        {report.isLoading ? <SkeletonRows rows={6} /> : report.error ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : <div className="space-y-5">{report.data?.sections.map((section) => <div key={section.heading}><h3 className="text-sm font-semibold">{section.heading}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{section.body}</p></div>)}</div>}
      </Section>
    </div>
  );
}
