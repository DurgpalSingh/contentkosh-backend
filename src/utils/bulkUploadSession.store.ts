import { ParsedQuestion } from '../dtos/bulkUpload.dto';

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionEntry {
  validQuestions: ParsedQuestion[];
  testId: string;
  testType: 'practice' | 'exam';
  expiresAt: number;
}

class BulkUploadSessionStore {
  private store = new Map<string, SessionEntry>();

  constructor() {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS).unref();
  }

  set(token: string, entry: Omit<SessionEntry, 'expiresAt'>): void {
    this.store.set(token, { ...entry, expiresAt: Date.now() + TTL_MS });
  }

  get(token: string): SessionEntry | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return null;
    }
    return entry;
  }

  delete(token: string): void {
    this.store.delete(token);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(token);
      }
    }
  }
}

export const bulkUploadSessionStore = new BulkUploadSessionStore();
