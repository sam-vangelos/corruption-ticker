/** Client calls to the dev-server review API (scripts/review-middleware.mjs). Development only. */
import type { QueueView, RecordState } from './core';

export type { QueueView, RecordState };

export interface WriteResponse {
  ok?: boolean;
  error?: string;
  digest?: string;
  state?: RecordState | null;
  archive_url?: string;
  touched?: string[];
}

async function call<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(path, body === undefined
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as T;
  return { status: res.status, data };
}

export const getQueue = () => call<QueueView & { error?: string }>('/__review/queue');
export const approve = (id: string) => call<WriteResponse>('/__review/approve', { id });
export const reject = (id: string, reason: string) => call<WriteResponse>('/__review/reject', { id, reason });
export const edit = (id: string, patch: Record<string, unknown>) => call<WriteResponse>('/__review/edit', { id, patch });
export const archive = (url: string) => call<WriteResponse>('/__review/archive', { url });
