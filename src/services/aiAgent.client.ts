import { BadRequestError, ApiError } from '../errors/api.errors';
import { config } from '../config/config';
import logger from '../utils/logger';
import { externalApiAuditService } from './externalApiAudit.service';
import { EXTERNAL_API_ERROR_CODE, EXTERNAL_API_SERVICE } from '../constants/externalApiAudit.constants';

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
    const startedAt = Date.now();

    if (this.apiKey) {
      headers.set('X-API-Key', this.apiKey);
    }

    let responseStatus: number | undefined;
    let responseBody: unknown;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      responseStatus = response.status;

      const text = await response.text();
      const payload = text ? this.parseJson(text) : undefined;
      responseBody = payload;

      if (!response.ok) {
        const message = this.extractErrorMessage(payload) || `AI agent returned ${response.status}`;
        errorCode = String(response.status);
        errorMessage = message;
        logger.warn('AI agent request failed', { path, status: response.status, message });
        throw new AiAgentError(message, response.status >= 500 ? 502 : response.status);
      }

      return payload as TResponse;
    } catch (error) {
      if (error instanceof AiAgentError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        errorCode = EXTERNAL_API_ERROR_CODE.TIMEOUT;
        errorMessage = 'AI agent request timed out';
        throw new AiAgentError(errorMessage, 504);
      }

      errorMessage = error instanceof Error ? error.message : String(error);
      errorCode = EXTERNAL_API_ERROR_CODE.UNAVAILABLE;
      logger.error('AI agent request error', { path, message: errorMessage });
      throw new AiAgentError('AI agent is unavailable', 502);
    } finally {
      clearTimeout(timeout);
      void externalApiAuditService.logExternalApiCall({
        serviceName: EXTERNAL_API_SERVICE.AI_AGENT,
        httpMethod: init.method || 'GET',
        requestUrl: `${this.baseUrl}${path}`,
        requestPath: path,
        requestBody: this.toLoggableRequestBody(init.body),
        responseStatus,
        responseTimeMs: Date.now() - startedAt,
        responseBody,
        isSuccess: errorMessage === undefined,
        errorCode,
        errorMessage,
      });
    }
  }

  private toLoggableRequestBody(body: RequestInit['body']): unknown {
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    }

    if (body instanceof FormData) {
      const fieldNames: string[] = [];
      body.forEach((_value, key) => fieldNames.push(key));
      return { formDataFields: fieldNames };
    }

    return undefined;
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
