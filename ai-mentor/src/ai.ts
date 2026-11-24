import type { Provider } from './types';
import { LocalAi, isAndroidApp } from './localAi';

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

/** In-app Offline GGUF generator (Capacitor LocalAi JNI bridge) */
async function* streamGguf(
  messages: ChatMsg[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!isAndroidApp()) {
    throw new AiError(0, 'Offline GGUF sirf Android APK me chalta hai — web pe API key ya Ollama use karo.');
  }
  const sys = messages.find((m) => m.role === 'system')?.content ?? '';
  const convo = messages
    .filter((m) => m.role !== 'system')
    .map((m) => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
    .join('\n');

  const queue: string[] = [];
  let prevLen = 0;
  let done = false;
  let errMsg = '';
  let notify: (() => void) | null = null;

  const wake = () => {
    if (notify) {
      const fn = notify;
      notify = null;
      fn();
    }
  };

  const sub = await LocalAi.addListener('token', (ev) => {
    const full = ev.text ?? '';
    if (full.length > prevLen) {
      queue.push(full.slice(prevLen));
      prevLen = full.length;
      wake();
    }
  });

  const onAbort = () => {
    LocalAi.stop().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort);

  LocalAi.generate({ system: sys, user: convo })
    .then((res) => {
      const full = res.text ?? '';
      if (full.length > prevLen) {
        queue.push(full.slice(prevLen));
        prevLen = full.length;
      }
      done = true;
      wake();
    })
    .catch((e) => {
      errMsg = e instanceof Error ? e.message : String(e);
      done = true;
      wake();
    });

  try {
    while (true) {
      while (queue.length > 0) {
        yield queue.shift()!;
      }
      if (done) {
        if (errMsg) throw new AiError(0, errMsg);
        return;
      }
      await new Promise<void>((r) => {
        notify = r;
      });
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await sub.remove().catch(() => {});
  }
}

/**
 * OpenAI-compatible streaming + Offline GGUF in-app engine —
 * Gemini, Groq, OpenRouter, OpenAI, Ollama, LM Studio, aur Offline .gguf sab yahin se.
 */
export async function* streamChat(
  p: Provider,
  messages: ChatMsg[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (p.kind === 'gguf' || p.baseUrl.startsWith('local://')) {
    yield* streamGguf(messages, signal);
    return;
  }

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
  if (p.kind === 'gguf' || p.baseUrl.startsWith('local://')) {
    if (!isAndroidApp()) throw new AiError(0, 'Offline GGUF sirf Android APK me chalta hai');
    const st = await LocalAi.status();
    if (!st.loaded) {
      throw new AiError(0, st.models.length ? 'Model select karke Load dabao' : 'Pehle .gguf file import ya download karo');
    }
    return 200;
  }
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
