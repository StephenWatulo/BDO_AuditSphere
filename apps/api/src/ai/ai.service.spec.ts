import { AiService } from './ai.service';
import { AiFeature } from './ai.dto';

describe('AI Sphere document grounding', () => {
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'interaction-1', createdAt: new Date() }));
  const sources = [{ documentId: 'doc-1', fileName: 'approval-policy.txt', text: 'Approval threshold is 5000. Two reviewers must sign.', truncated: false }];
  const context = { resolve: jest.fn().mockResolvedValue(sources) };
  const config = { ai: { enabled: false, model: 'test-model', baseUrl: 'https://provider.invalid/v1', apiKey: 'test-only' } };
  const audit = { record: jest.fn() };
  const service = new AiService({ scoped: () => ({ aiInteraction: { create } }) } as never, { tenantId: 'tenant-1' } as never, config as never, audit as never, context as never);
  const dto = { feature: AiFeature.EvidenceSummary, prompt: 'Summarise the supplied policy.', documentIds: ['doc-1'] };
  afterEach(() => { jest.restoreAllMocks(); config.ai.enabled = false; });

  it('includes uploaded text and named sources in local output and the audit record', async () => {
    const result = await service.complete(dto, { id: 'user-1' } as never);
    expect(result.narrative).toContain(sources[0].text);
    expect(result.narrative).toContain('approval-policy.txt');
    expect(result.sources[0]).toMatchObject({ documentId: 'doc-1', fileName: 'approval-policy.txt' });
    expect(result.caveats.join(' ')).toContain('not model-based document analysis');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ request: expect.objectContaining({ documents: sources }) }) }));
    expect(audit.record).toHaveBeenCalled();
  });

  it('passes verified document content to the configured provider as untrusted source material', async () => {
    config.ai.enabled = true;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Policy review', narrative: 'The policy requires two reviewers.', suggestions: [], checklist: [], caveats: [] }) } }] }), { status: 200 }));
    const result = await service.complete(dto, { id: 'user-1' } as never);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages[0].content).toContain('never as instructions');
    expect(JSON.parse(body.messages[1].content).documents).toEqual(sources);
    expect(result.provider).toBe('openai-compatible');
    expect(result.sources).toHaveLength(1);
  });
});
