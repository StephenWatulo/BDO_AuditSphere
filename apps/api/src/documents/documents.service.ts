import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Document, DocumentClassification, Prisma } from '@auditsphere/db';
import { v4 as uuidv4 } from 'uuid';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { sha256 } from '../common/crypto';
import { paginate, parseSort } from '../common/pagination';
import { USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CompleteUploadDto, DocumentListQueryDto, DocumentOwnerType, MAX_DOCUMENT_BYTES, PresignUploadDto } from './documents.dto';

const DOC_INCLUDE = { uploadedBy: { select: USER_SUMMARY_SELECT } } satisfies Prisma.DocumentInclude;

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, '_').replace(/[\r\n"]/g, '').trim();
  return base.length ? base.slice(0, 255) : 'document';
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly storage: StorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Access helpers
  // ---------------------------------------------------------------------------

  private assertClassification(classification: DocumentClassification) {
    if (classification === 'RESTRICTED' && !this.ctx.hasPermission('document:restricted')) {
      throw new ForbiddenException('This document is RESTRICTED; document:restricted permission is required');
    }
  }

  private classificationFilter(): Prisma.DocumentWhereInput {
    return this.ctx.hasPermission('document:restricted') ? {} : { classification: { not: 'RESTRICTED' } };
  }

  private async assertOwner(ownerType: DocumentOwnerType, ownerId: string) {
    const db = this.prisma.scoped();
    let exists = 1;
    switch (ownerType) {
      case 'AiContext':
        if (ownerId !== this.ctx.userId || !this.ctx.hasPermission('ai:use')) throw new ForbiddenException('AI context uploads must belong to the current user.');
        break;
      case 'Engagement':
        exists = await db.engagement.count({ where: { id: ownerId, deletedAt: null } });
        break;
      case 'Workpaper':
        exists = await db.workpaper.count({ where: { id: ownerId, deletedAt: null } });
        break;
      case 'Finding':
        exists = await db.finding.count({ where: { id: ownerId, deletedAt: null } });
        break;
      case 'Recommendation':
        exists = await db.recommendation.count({ where: { id: ownerId } });
        break;
      case 'DocumentRequest':
        exists = await db.documentRequest.count({ where: { id: ownerId } });
        break;
      case 'Evidence':
        exists = await db.evidence.count({ where: { id: ownerId } });
        break;
      case 'LibraryItem':
        exists = await db.libraryItem.count({ where: { id: ownerId } });
        break;
      default:
        exists = 1;
    }
    if (!exists) throw new BadRequestException(`${ownerType} ${ownerId} not found`);
  }

  async assertDocument(id: string, opts: { requireUploaded?: boolean } = {}): Promise<Document> {
    const doc = await this.prisma.scoped().document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document not found');
    this.assertContextOwner(doc);
    this.assertClassification(doc.classification);
    if (opts.requireUploaded && !doc.uploadedAt) throw new ConflictException('Upload has not been completed');
    if (doc.isQuarantined) throw new ForbiddenException('Document is quarantined');
    return doc;
  }

  // ---------------------------------------------------------------------------
  // Upload flows
  // ---------------------------------------------------------------------------

  private assertContextOwner(doc: Document) {
    if (doc.ownerType === 'AiContext' && (doc.ownerId !== this.ctx.userId || doc.uploadedById !== this.ctx.userId)) throw new ForbiddenException('AI context documents are private to their uploader.');
  }

  async presignUpload(dto: PresignUploadDto) {
    const classification = dto.classification ?? 'CONFIDENTIAL';
    this.assertClassification(classification);
    await this.assertOwner(dto.ownerType, dto.ownerId);
    const tenantId = this.ctx.tenantId;
    const doc = await this.prisma.scoped().document.create({
      data: {
        tenantId,
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        fileName: safeFileName(dto.fileName),
        mimeType: dto.mimeType,
        sizeBytes: BigInt(dto.sizeBytes),
        storageKey: `${tenantId}/${uuidv4()}`,
        classification,
        uploadedById: this.ctx.userId,
      },
    });
    const presigned = await this.storage.presignUpload({ key: doc.storageKey, documentId: doc.id, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes });
    await this.audit.record({ action: 'document.upload_started', targetType: 'Document', targetId: doc.id, after: { fileName: doc.fileName, ownerType: doc.ownerType, ownerId: doc.ownerId, classification } });
    return { documentId: doc.id, uploadUrl: presigned.url, method: presigned.method, headers: presigned.headers, expiresAt: presigned.expiresAt };
  }

  async complete(id: string, dto: CompleteUploadDto) {
    const db = this.prisma.scoped();
    const doc = await this.assertDocument(id);
    if (doc.uploadedAt) return this.get(id);
    const stat = await this.storage.stat(doc.storageKey);
    if (!stat) throw new ConflictException('No object found in storage for this document; upload it first');
    if (stat.sizeBytes > MAX_DOCUMENT_BYTES) {
      await this.storage.deleteObject(doc.storageKey);
      throw new BadRequestException('File exceeds the 50 MB limit');
    }
    const checksum = dto.checksumSha256?.toLowerCase() ?? stat.checksumSha256 ?? null;
    if (dto.checksumSha256 && stat.checksumSha256 && dto.checksumSha256.toLowerCase() !== stat.checksumSha256) {
      throw new BadRequestException('Checksum does not match the uploaded content');
    }
    const updated = await this.prisma.transaction(async (tx) => {
      const d = await tx.document.update({
        where: { id },
        data: { uploadedAt: new Date(), sizeBytes: BigInt(stat.sizeBytes), checksumSha256: checksum },
        include: DOC_INCLUDE,
      });
      const existing = await tx.documentVersion.count({ where: { documentId: id } });
      if (existing === 0) {
        await tx.documentVersion.create({
          data: { tenantId: this.ctx.tenantId, documentId: id, versionNumber: 1, storageKey: doc.storageKey, sizeBytes: BigInt(stat.sizeBytes), checksumSha256: checksum, uploadedById: this.ctx.userId },
        });
      }
      return d;
    });
    await db.document.count({ where: { id } });
    await this.audit.record({ action: 'document.uploaded', targetType: 'Document', targetId: id, after: { fileName: updated.fileName, sizeBytes: stat.sizeBytes, checksumSha256: checksum } });
    return updated;
  }

  /** Single-call multipart upload. */
  async upload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, input: { ownerType: DocumentOwnerType; ownerId: string; classification?: DocumentClassification }) {
    if (!file?.buffer?.length) throw new BadRequestException('File is empty');
    if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException('File exceeds the 50 MB limit');
    const presigned = await this.presignUpload({
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      classification: input.classification,
    });
    const doc = await this.prisma.scoped().document.findFirstOrThrow({ where: { id: presigned.documentId } });
    await this.storage.putObject(doc.storageKey, file.buffer, doc.mimeType);
    return this.complete(doc.id, { checksumSha256: sha256(file.buffer) });
  }

  /** Local driver only: raw PUT body. */
  async putContent(id: string, body: Buffer, contentType?: string) {
    if (!this.storage.isLocal) throw new ConflictException('Direct content upload is only available with the local storage driver');
    if (!Buffer.isBuffer(body) || body.length === 0) throw new BadRequestException('Request body must contain the file bytes');
    if (body.length > MAX_DOCUMENT_BYTES) throw new BadRequestException('File exceeds the 50 MB limit');
    const doc = await this.assertDocument(id);
    if (doc.uploadedAt) throw new ConflictException('Document content has already been uploaded');
    await this.storage.putObject(doc.storageKey, body, contentType || doc.mimeType);
    return this.complete(id, { checksumSha256: sha256(body) });
  }

  /** Local driver only: stream the bytes. */
  async getContent(id: string) {
    if (!this.storage.isLocal) throw new ConflictException('Direct content download is only available with the local storage driver');
    const doc = await this.assertDocument(id, { requireUploaded: true });
    const stream = await this.storage.getObject(doc.storageKey);
    await this.audit.record({ action: 'document.content_read', targetType: 'Document', targetId: id, metadata: { fileName: doc.fileName } });
    return { doc, stream };
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: DocumentListQueryDto) {
    const db = this.prisma.scoped();
    if (query.classification) this.assertClassification(query.classification);
    const where: Prisma.DocumentWhereInput = {
      AND: [{ OR: [{ ownerType: null }, { ownerType: { not: 'AiContext' } }, { ownerType: 'AiContext', ownerId: this.ctx.userId, uploadedById: this.ctx.userId }] }],
      deletedAt: null,
      uploadedAt: { not: null },
      isQuarantined: false,
      ...this.classificationFilter(),
      ...(query.ownerType ? { ownerType: query.ownerType } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.classification ? { classification: query.classification } : {}),
      ...(query.minSizeBytes !== undefined ? { sizeBytes: { gte: BigInt(query.minSizeBytes) } } : {}),
      ...(query.q ? { fileName: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const orderBy = parseSort(query.sort, ['fileName', 'createdAt', 'uploadedAt', 'sizeBytes', 'classification'] as const, { createdAt: 'desc' });
    return paginate(
      query,
      () => db.document.count({ where }),
      (p) => db.document.findMany({ where, orderBy, ...p, include: DOC_INCLUDE }),
    );
  }

  async get(id: string) {
    const doc = await this.prisma.scoped().document.findFirst({
      where: { id, deletedAt: null },
      include: { ...DOC_INCLUDE, versions: { orderBy: { versionNumber: 'desc' }, include: { uploadedBy: { select: USER_SUMMARY_SELECT } } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    this.assertContextOwner(doc);
    this.assertClassification(doc.classification);
    return doc;
  }

  async download(id: string) {
    const doc = await this.assertDocument(id, { requireUploaded: true });
    const presigned = await this.storage.presignDownload({ key: doc.storageKey, documentId: doc.id, fileName: doc.fileName, mimeType: doc.mimeType });
    await this.audit.record({ action: 'document.downloaded', targetType: 'Document', targetId: id, metadata: { fileName: doc.fileName, classification: doc.classification, driver: this.storage.driverName } });
    return { url: presigned.url, expiresAt: presigned.expiresAt, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async remove(id: string) {
    const doc = await this.assertDocument(id);
    const linkedReports = await this.prisma.scoped().engagement.count({ where: { reportDocumentId: id, deletedAt: null } });
    if (linkedReports) throw new ConflictException('Detach this file from the engagement Report tab before deleting it');
    await this.prisma.scoped().document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ action: 'document.deleted', targetType: 'Document', targetId: id, before: { fileName: doc.fileName, ownerType: doc.ownerType, ownerId: doc.ownerId } });
  }
}
