import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Document, DocumentClassification } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { ContextExtractorService, MAX_CONTEXT_DOCUMENTS } from './context-extractor.service';

export interface AiContextSource { documentId: string; fileName: string; text: string; truncated: boolean }
const TRUNCATED_TAG = 'ai-context:truncated';

@Injectable()
export class AiContextService {
  constructor(private readonly documents: DocumentsService, private readonly extractor: ContextExtractorService, private readonly prisma: PrismaService, private readonly ctx: TenantContext, private readonly audit: AuditTrailService) {}

  private summary(doc: Pick<Document, 'id' | 'fileName' | 'mimeType' | 'sizeBytes' | 'extractedText' | 'tags' | 'createdAt'>) {
    return { id: doc.id, fileName: doc.fileName, mimeType: doc.mimeType, sizeBytes: Number(doc.sizeBytes), characters: doc.extractedText?.length ?? 0, preview: doc.extractedText?.slice(0, 1000) ?? '', truncated: doc.tags.includes(TRUNCATED_TAG), createdAt: doc.createdAt };
  }

  async upload(file: Express.Multer.File, classification?: DocumentClassification) {
    if (!this.ctx.hasPermission('document:upload') || !this.ctx.hasPermission('document:read')) throw new ForbiddenException('Document upload and read permissions are required.');
    if (classification === 'RESTRICTED' && !this.ctx.hasPermission('document:restricted')) throw new ForbiddenException('Restricted document permission is required.');
    const extracted = await this.extractor.extract(file);
    const doc = await this.documents.upload({ ...file, mimetype: extracted.mimeType }, { ownerType: 'AiContext', ownerId: this.ctx.userId, classification });
    const updated = await this.prisma.scoped().document.update({ where: { id: doc.id }, data: { extractedText: extracted.text, tags: extracted.truncated ? [TRUNCATED_TAG] : [] } });
    await this.audit.record({ action: 'ai.context_document_uploaded', targetType: 'Document', targetId: doc.id, metadata: { characters: extracted.text.length, truncated: extracted.truncated } });
    return this.summary(updated);
  }

  async list() {
    if (!this.ctx.hasPermission('document:read')) throw new ForbiddenException('Document read permission is required.');
    const docs = await this.prisma.scoped().document.findMany({
      where: { ownerType: 'AiContext', ownerId: this.ctx.userId, uploadedById: this.ctx.userId, deletedAt: null, uploadedAt: { not: null }, isQuarantined: false, extractedText: { not: null }, ...(!this.ctx.hasPermission('document:restricted') ? { classification: { not: 'RESTRICTED' as const } } : {}) },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return { items: docs.map((doc) => this.summary(doc)) };
  }

  async resolve(documentIds?: string[] | null): Promise<AiContextSource[]> {
    const ids = documentIds ?? [];
    if (ids.length > MAX_CONTEXT_DOCUMENTS || new Set(ids).size !== ids.length) throw new BadRequestException('Select up to five different context documents.');
    if (ids.length && !this.ctx.hasPermission('document:read')) throw new ForbiddenException('Document read permission is required.');
    const sources: AiContextSource[] = [];
    for (const id of ids) {
      const doc = await this.documents.assertDocument(id, { requireUploaded: true });
      if (doc.ownerType !== 'AiContext' || doc.ownerId !== this.ctx.userId || doc.uploadedById !== this.ctx.userId) throw new ForbiddenException('Only your AI Sphere context documents can be used.');
      if (!doc.extractedText?.trim()) throw new BadRequestException(`${doc.fileName} does not contain extracted context text.`);
      sources.push({ documentId: doc.id, fileName: doc.fileName, text: doc.extractedText, truncated: doc.tags.includes(TRUNCATED_TAG) });
    }
    return sources;
  }
}
