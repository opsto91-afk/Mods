import type { Provider } from './types';

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function endpoint(p: Provider): string {
  const base = p.baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new AiError(0, 'Base URL khali hai — Settings me provider configure karo.');
  return base + '/chat/completions';
}

function headers(p: Provider): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p.apiKey.trim()) h['Authorization'] = `Bearer ${p.apiKey.trim()}`;
  return h;
}

/** OpenAI-compatible streaming — Ollama, LM Studio, Gemini-compat, custom sab yahin se */
export async function* streamChat(
  p: Provider,
  messages: ChatMsg[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(endpoint(p), {
    method: 'POST',
    headers: headers(p),
    body: JSON.stringify({
      model: p.model.trim() || 'default',
      messages,
      stream: true,
      temperature: 0.7,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new AiError(res.status, `${res.status} ${res.statusText} — ${detail}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';
    for (const raw of parts) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const j = JSON.parse(data);
        const delta: unknown = j?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length) yield delta;
      } catch {
        /* partial line — ignore */
      }
    }
  }
}

/** Settings ka Test button — chhota ping */
export async function ping(p: Provider, signal?: AbortSignal): Promise<number> {
  const res = await fetch(endpoint(p), {
    method: 'POST',
    headers: headers(p),
    body: JSON.stringify({
      model: p.model.trim() || 'default',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
    }),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new AiError(res.status, `${res.status} — ${detail || res.statusText}`);
  }
  return res.status;
}

export function isLimitError(e: unknown): boolean {
  if (e instanceof AiError) {
    return e.status === 429 || e.status === 402 || e.status === 403 || e.status === 503;
  }
  return false;
}
