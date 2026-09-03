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
    return this.request<TResponse>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async postForm<TResponse>(path: string, formData: FormData): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: 'POST',
      body: formData,
    });
  }

  private async request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers);

    if (this.apiKey) {
      headers.set('X-API-Key', this.apiKey);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? this.parseJson(text) : undefined;

      if (!response.ok) {
        const message = this.extractErrorMessage(payload) || `AI agent returned ${response.status}`;
        logger.warn('AI agent request failed', { path, status: response.status, message });
        throw new AiAgentError(message, response.status >= 500 ? 502 : response.status);
      }

      return payload as TResponse;
    } catch (error) {
      if (error instanceof AiAgentError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AiAgentError('AI agent request timed out', 504);
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.error('AI agent request error', { path, message });
      throw new AiAgentError('AI agent is unavailable', 502);
    } finally {
      clearTimeout(timeout);
    }
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
    const detail = record.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => String(item)).join(', ');
    if (typeof record.message === 'string') return record.message;
    return undefined;
  }
}

export const aiAgentClient = new AiAgentClient();
