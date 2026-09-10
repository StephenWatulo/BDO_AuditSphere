import { AiService } from './ai.service';
import { AiFeature } from './ai.dto';

describe('AI Sphere document grounding', () => {
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'interaction-1', createdAt: new Date() }));
  const sources = [{ documentId: 'doc-1', fileName: 'approval-policy.txt', text: 'Approval threshold is 5000. Two reviewers must sign.', truncated: false }];
  const context = { resolve: jest.fn().mockResolvedValue(sources) };
  const config = { ai: { enabled: false, model: 'test-model', baseUrl: 'https://provider.invalid/v1', apiKey: 'test-only' } };
  const audit = { record: jest.fn() };
  const universeIndex = { build: jest.fn().mockResolvedValue({ records: [], links: [], warnings: [], restrictedKinds: [], incompleteKinds: [], indexedAt: '2026-09-08T00:00:00Z', textLimitedRecords: 0 }) };
  const auditContext = { build: jest.fn().mockResolvedValue({ records: [{ source: { id: 'S1', kind: 'Document', recordId: 'doc-1', label: 'approval-policy.txt', excerpt: sources[0].text, truncated: false }, fields: { id: 'doc-1', fileName: 'approval-policy.txt', extractedText: sources[0].text } }], links: [], warnings: [] }) };
  const service = new AiService({ scoped: () => ({ aiInteraction: { create } }) } as never, { tenantId: 'tenant-1' } as never, config as never, audit as never, context as never, auditContext as never, universeIndex as never);
  const dto = { feature: AiFeature.EvidenceSummary, prompt: 'Summarise the supplied policy.', documentIds: ['doc-1'] };
  afterEach(() => { jest.restoreAllMocks(); config.ai.enabled = false; });
  it('runs intelligence through the index, skips the model and bounded context, and audits the actual local engine', async () => {
    config.ai.enabled = true;
    const provider = jest.spyOn(globalThis, 'fetch');
    auditContext.build.mockClear();
    const result = await service.complete({ feature: AiFeature.NaturalLanguageSearch, prompt: 'Show findings' }, { id: 'user-1' } as never);
    expect(universeIndex.build).toHaveBeenCalled(); expect(auditContext.build).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
    expect(result.model).toBe('audit-intelligence-index-v1'); expect(result.search?.intelligence?.emptyReason).toBe('no_data');
    expect(result.reviewRequired).toBe(true);
    expect(create.mock.calls.at(-1)![0].data).toMatchObject({ userId: 'user-1', model: 'audit-intelligence-index-v1', response: expect.objectContaining({ search: expect.objectContaining({ intelligence: expect.any(Object) }) }) });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ai.interaction_created', metadata: expect.objectContaining({ reviewRequired: true }) }));
  });

  it('includes uploaded text and named sources in local output and the audit record', async () => {
    const result = await service.complete(dto, { id: 'user-1' } as never);
    expect(JSON.stringify(result.sections)).toContain(sources[0].text);
    expect(JSON.stringify(result.sections)).toContain('approval-policy.txt');
    expect(result.sources[0]).toMatchObject({ documentId: 'doc-1', fileName: 'approval-policy.txt' });
    expect(result.caveats.join(' ')).toContain('not model-based document analysis');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ request: expect.objectContaining({ documents: sources }) }) }));
    expect(audit.record).toHaveBeenCalled();
  });

  it('passes verified document content to the configured provider as untrusted source material', async () => {
    config.ai.enabled = true;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      const request = JSON.parse(JSON.parse(options!.body as string).messages[1].content);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(request.outputTemplate) } }] }), { status: 200 });
    });
    const result = await service.complete(dto, { id: 'user-1' } as never);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages[0].content).toContain('never as instructions');
    expect(JSON.parse(body.messages[1].content).documents).toEqual(sources);
    expect(result.provider).toBe('openai-compatible');
    expect(result.sources).toHaveLength(1);
  });

  it('falls back safely on provider failure and records the actual local model', async () => {
    config.ai.enabled = true;
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Provider unavailable with private diagnostics'));
    const result = await service.complete(dto, { id: 'user-1' } as never);
    expect(result.provider).toBe('local-fallback');
    expect(result.model).toBe('audit-review-rulepack-v2');
    expect(JSON.stringify(result)).not.toContain('private diagnostics');
    expect(result.reviewRequired).toBe(true);
    expect(create.mock.calls.at(-1)![0].data).toMatchObject({ userId: 'user-1', request: expect.objectContaining({ prompt: dto.prompt, auditContext: expect.any(Object) }), response: expect.objectContaining({ reviewRequired: true }) });
  });
});
