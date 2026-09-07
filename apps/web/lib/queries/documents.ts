'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Document, DownloadLink, Evidence, EvidenceType, Paged } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';
import { engagementKeys } from './engagements';
import { workpaperKeys } from './workpapers';

export const documentKeys = {
  all: ['documents'] as const,
  byOwner: (ownerType: string, ownerId: string) => ['documents', ownerType, ownerId] as const,
};

export function useDocuments(ownerType?: string, ownerId?: string) {
  return useQuery({
    queryKey: documentKeys.byOwner(ownerType ?? '', ownerId ?? ''),
    queryFn: async () => {
      const documents: Document[] = [];
      let page = 1;
      for (;;) {
        const res = await api.get<Paged<Document>>('/documents', compactParams({ ownerType, ownerId, page, pageSize: 200 }));
        documents.push(...res.items);
        if (documents.length >= res.total || !res.items.length) return documents;
        page++;
      }
    },
    enabled: !!ownerType && !!ownerId,
  });
}

export interface UploadInput {
  file: File;
  ownerType: string;
  ownerId: string;
  classification?: string;
}

export function useUploadDocument() {
  return useApiMutation<Document, UploadInput>(
    ({ file, ownerType, ownerId, classification }) => {
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('ownerType', ownerType);
      form.append('ownerId', ownerId);
      if (classification) form.append('classification', classification);
      return api.upload<Document>('/documents/upload', form);
    },
    { invalidate: (_d, v) => [documentKeys.byOwner(v.ownerType, v.ownerId)] },
  );
}

export function useDeleteDocument() {
  return useApiMutation<void, { id: string; ownerType?: string; ownerId?: string }>(
    ({ id }) => api.delete(`/documents/${id}`),
    {
      invalidate: (_d, v) => (v.ownerType && v.ownerId ? [documentKeys.byOwner(v.ownerType, v.ownerId)] : [documentKeys.all]),
      success: 'Document deleted',
    },
  );
}

/** Resolves a short-lived download URL and opens it. */
export async function downloadDocument(id: string) {
  const link = await api.get<DownloadLink>(`/documents/${id}/download`);
  const url = new URL(link.url, window.location.origin);
  if (url.pathname === `/api/v1/documents/${id}/content`) {
    await api.download(url.pathname.slice('/api/v1'.length), undefined, link.fileName);
  } else {
    const anchor = document.createElement('a');
    anchor.href = url.toString();
    anchor.download = link.fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}

export interface EvidenceInput {
  engagementId: string;
  workpaperId?: string;
  documentId?: string;
  description: string;
  type: EvidenceType;
  obtainedFrom?: string;
  obtainedAt?: string;
}

export function useCreateEvidence() {
  return useApiMutation<Evidence, EvidenceInput>((input) => api.post('/evidence', input), {
    invalidate: (_d, v) => [
      engagementKeys.evidence(v.engagementId),
      ...(v.workpaperId ? [workpaperKeys.detail(v.workpaperId)] : []),
    ],
    success: 'Evidence registered',
  });
}

export function useUpdateEvidence() {
  return useApiMutation<Evidence, { id: string; engagementId: string; workpaperId?: string } & Partial<EvidenceInput> & { isSufficient?: boolean }>(
    ({ id, engagementId: _e, workpaperId: _w, ...input }) => api.patch(`/evidence/${id}`, input),
    {
      invalidate: (_d, v) => [
        engagementKeys.evidence(v.engagementId),
        ...(v.workpaperId ? [workpaperKeys.detail(v.workpaperId)] : []),
      ],
      success: 'Evidence updated',
    },
  );
}
