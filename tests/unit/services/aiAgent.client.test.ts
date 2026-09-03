import { AiAgentClient, AiAgentError } from '../../../src/services/aiAgent.client';

describe('AiAgentClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
  });

  it('sends JSON requests with API key header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"answer":"ok"}'),
    });

    const client = new AiAgentClient({
      baseUrl: 'http://agent.test/',
      apiKey: 'secret',
      timeoutMs: 1000,
    });

    const response = await client.postJson<{ answer: string }>('/llm/kb/query', {
      query: 'What is this?',
    });

    expect(response).toEqual({ answer: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://agent.test/llm/kb/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'What is this?' }),
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-API-Key')).toBe('secret');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('maps non-2xx agent responses to AiAgentError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('{"detail":"agent failed"}'),
    });

    const client = new AiAgentClient({
      baseUrl: 'http://agent.test',
      timeoutMs: 1000,
    });

    await expect(client.postJson('/llm/kb/query', {})).rejects.toMatchObject({
      name: 'AiAgentError',
      message: 'agent failed',
      statusCode: 502,
    } satisfies Partial<AiAgentError>);
  });
});
