import http from 'http';
import https from 'https';
import { BadRequestError, ApiError } from '../errors/api.errors';
import { config } from '../config/config';
import logger from '../utils/logger';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export class AiAgentError extends ApiError {
  constructor(message: string = 'AI agent request failed', statusCode: number = 502) {
    super(message, statusCode);
    this.name = 'AiAgentError';
  }
}

class AiAgentTimeoutError extends Error {}

interface AgentHttpResponse {
  status: number;
  text: string;
}

export interface AiAgentClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class AiAgentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: AiAgentClientOptions = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl || config.aiAgent.baseUrl);
    this.apiKey = options.apiKey || config.aiAgent.apiKey;
    this.timeoutMs = options.timeoutMs || config.aiAgent.timeoutMs;
  }

  async postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
    return this.request<TResponse>(path, 'application/json', Buffer.from(JSON.stringify(body)));
  }

  async postForm<TResponse>(path: string, formData: FormData): Promise<TResponse> {
    // Response serializes FormData to a multipart body and generates the boundary header for us.
    const encoded = new Response(formData);
    const contentType = encoded.headers.get('content-type') as string;
    return this.request<TResponse>(path, contentType, Buffer.from(await encoded.arrayBuffer()));
  }

  private async request<TResponse>(path: string, contentType: string, payload: Buffer): Promise<TResponse> {
    const startedAt = Date.now();
    logger.info('AiAgentClient: Request started', {
      path,
      contentType,
      payloadBytes: payload.length,
      timeoutMs: this.timeoutMs,
    });
    try {
      const { status, text } = await this.send(path, contentType, payload);
      const durationMs = Date.now() - startedAt;
      const parsed = text ? this.parseJson(text) : undefined;

      if (status < 200 || status >= 300) {
        const message = this.extractErrorMessage(parsed) || `AI agent returned ${status}`;
        logger.warn('AiAgentClient: Request returned an error status', { path, status, durationMs, message });
        throw new AiAgentError(message, status >= 500 ? 502 : status);
      }

      logger.info('AiAgentClient: Request succeeded', {
        path,
        status,
        durationMs,
        responseBytes: Buffer.byteLength(text, 'utf8'),
      });
      return parsed as TResponse;
    } catch (error) {
      if (error instanceof AiAgentError) {
        logger.warn('AiAgentClient: Request failed with agent error', {
          path,
          durationMs: Date.now() - startedAt,
          statusCode: error.statusCode,
          message: error.message,
        });
        throw error;
      }
      if (error instanceof AiAgentTimeoutError) {
        logger.error('AiAgentClient: Request timed out', {
          path,
          timeoutMs: this.timeoutMs,
          durationMs: Date.now() - startedAt,
        });
        throw new AiAgentError('AI agent request timed out', 504);
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error('AiAgentClient: Network or response processing error', {
        path,
        durationMs: Date.now() - startedAt,
        message,
      });
      throw new AiAgentError('AI agent is unavailable', 502);
    }
  }

  // Not using fetch: Node's built-in fetch (undici) aborts after 5 minutes without response headers,
  // regardless of our own timeout, and PDF ingestion on the agent can legitimately take longer.
  private send(path: string, contentType: string, payload: Buffer): Promise<AgentHttpResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentType,
        'Content-Length': payload.length,
      };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const transport = url.protocol === 'https:' ? https : http;
      const timer = setTimeout(() => req.destroy(new AiAgentTimeoutError()), this.timeoutMs);
      const fail = (error: Error) => {
        clearTimeout(timer);
        logger.debug('AiAgentClient: HTTP request failed', {
          path,
          message: error.message,
        });
        reject(error);
      };

      const req = transport.request(url, { method: 'POST', headers, agent: false }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', fail);
        res.on('end', () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') });
        });
      });

      req.on('error', fail);
      req.end(payload);
    });
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new BadRequestError('AI agent returned invalid JSON');
    }
  }

  private extractErrorMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const record = payload as Record<string, unknown>;

    // Agent's own error envelope: { success: false, error: { code, message } }
    const error = record.error;
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === 'string') return message;
    }

    const detail = record.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => this.formatDetailItem(item)).join(', ');
    if (typeof record.message === 'string') return record.message;
    return undefined;
  }

  // FastAPI validation errors (422) are objects: { loc: ['body', 'query'], msg: '...' }
  private formatDetailItem(item: unknown): string {
    if (item && typeof item === 'object') {
      const { loc, msg } = item as { loc?: unknown; msg?: unknown };
      if (typeof msg === 'string') {
        const field = Array.isArray(loc) ? loc.filter((part) => part !== 'body').join('.') : '';
        return field ? `${field}: ${msg}` : msg;
      }
    }
    return String(item);
  }
}

export const aiAgentClient = new AiAgentClient();
