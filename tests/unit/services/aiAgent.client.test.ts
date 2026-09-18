import http from 'http';
import { AddressInfo } from 'net';
import { AiAgentClient, AiAgentError } from '../../../src/services/aiAgent.client';

jest.mock('../../../src/utils/logger');

interface CapturedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

describe('AiAgentClient', () => {
  let server: http.Server;
  let baseUrl: string;
  let captured: CapturedRequest;
  let respond: (res: http.ServerResponse) => void;

  const jsonResponse = (status: number, body: unknown) => (res: http.ServerResponse) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  beforeEach(async () => {
    respond = jsonResponse(200, { answer: 'ok' });
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        captured = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) };
        respond(res);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('sends JSON requests with API key header', async () => {
    const client = new AiAgentClient({ baseUrl: `${baseUrl}/`, apiKey: 'secret', timeoutMs: 1000 });

    const response = await client.postJson<{ answer: string }>('/llm/kb/query', { query: 'What is this?' });

    expect(response).toEqual({ answer: 'ok' });
    expect(captured.method).toBe('POST');
    expect(captured.url).toBe('/llm/kb/query');
    expect(captured.headers['x-api-key']).toBe('secret');
    expect(captured.headers['content-type']).toBe('application/json');
    expect(JSON.parse(captured.body.toString())).toEqual({ query: 'What is this?' });
  });

  it('sends FormData as multipart with fields and file content', async () => {
    respond = jsonResponse(200, { message: 'uploaded' });
    const client = new AiAgentClient({ baseUrl, timeoutMs: 1000 });
    const formData = new FormData();
    formData.append('business_id', '1');
    formData.append('course_ids', '2');
    formData.append('files', new Blob([Buffer.from('%PDF-1.4 body')], { type: 'application/pdf' }), 'notes.pdf');

    const response = await client.postForm<{ message: string }>('/llm/upload', formData);

    expect(response).toEqual({ message: 'uploaded' });
    expect(captured.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured.headers['content-length']).toBe(String(captured.body.length));
    const body = captured.body.toString();
    expect(body).toContain('name="business_id"');
    expect(body).toContain('name="course_ids"');
    expect(body).toContain('name="files"; filename="notes.pdf"');
    expect(body).toContain('Content-Type: application/pdf');
    expect(body).toContain('%PDF-1.4 body');
  });

  it('maps non-2xx agent responses to AiAgentError', async () => {
    respond = jsonResponse(500, { detail: 'agent failed' });
    const client = new AiAgentClient({ baseUrl, timeoutMs: 1000 });

    await expect(client.postJson('/llm/kb/query', {})).rejects.toMatchObject({
      name: 'AiAgentError',
      message: 'agent failed',
      statusCode: 502,
    } satisfies Partial<AiAgentError>);
  });

  it("surfaces the message from the agent's error envelope and keeps 4xx status", async () => {
    respond = jsonResponse(400, {
      success: false,
      status: 400,
      status_text: 'Bad Request',
      error: { code: 'DOCUMENT_PROCESSING_FAILED', message: 'Unable to extract document metadata.' },
    });
    const client = new AiAgentClient({ baseUrl, timeoutMs: 1000 });

    await expect(client.postForm('/llm/upload', new FormData())).rejects.toMatchObject({
      name: 'AiAgentError',
      message: 'Unable to extract document metadata.',
      statusCode: 400,
    } satisfies Partial<AiAgentError>);
  });

  it('formats FastAPI 422 validation details instead of [object Object]', async () => {
    respond = jsonResponse(422, {
      detail: [
        { type: 'string_too_long', loc: ['body', 'query'], msg: 'String should have at most 1000 characters' },
        { type: 'too_short', loc: ['body', 'course_ids'], msg: 'List should have at least 1 item' },
      ],
    });
    const client = new AiAgentClient({ baseUrl, timeoutMs: 1000 });

    await expect(client.postJson('/llm/kb/query', {})).rejects.toMatchObject({
      message: 'query: String should have at most 1000 characters, course_ids: List should have at least 1 item',
      statusCode: 422,
    });
  });

  it('times out with 504 when the agent does not answer within timeoutMs', async () => {
    respond = () => undefined;
    const client = new AiAgentClient({ baseUrl, timeoutMs: 100 });

    await expect(client.postJson('/llm/kb/query', {})).rejects.toMatchObject({
      name: 'AiAgentError',
      message: 'AI agent request timed out',
      statusCode: 504,
    } satisfies Partial<AiAgentError>);
  });

  it('reports the agent as unavailable when the connection is refused', async () => {
    await new Promise((resolve) => server.close(resolve));
    const client = new AiAgentClient({ baseUrl, timeoutMs: 1000 });

    await expect(client.postJson('/llm/kb/query', {})).rejects.toMatchObject({
      name: 'AiAgentError',
      message: 'AI agent is unavailable',
      statusCode: 502,
    } satisfies Partial<AiAgentError>);
  });
});
