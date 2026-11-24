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

function isGeminiProvider(p: Provider): boolean {
  return (
    p.id === 'gemini' ||
    p.baseUrl.includes('generativelanguage.googleapis.com') ||
    p.apiKey.trim().startsWith('AIza')
  );
}

function endpoint(p: Provider): string {
  let base = p.baseUrl.trim().replace(/\/+$/, '');
  const key = p.apiKey.trim();
  if (!base) {
    if (key.startsWith('gsk_')) base = 'https://api.groq.com/openai/v1';
    else if (key.startsWith('sk-or-')) base = 'https://openrouter.ai/api/v1';
    else if (key.startsWith('sk-')) base = 'https://api.openai.com/v1';
    else throw new AiError(0, 'Base URL khali hai — Settings (⚙) me provider configure karo.');
  }
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
  const recent = messages.filter((m) => m.role !== 'system').slice(-6);
  const convo =
    recent
      .map((m) => (m.role === 'user' ? `User: ${m.content.slice(0, 1800)}` : `Assistant: ${m.content.slice(0, 1000)}`))
      .join('\n') + '\nAssistant:';

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

/** Browser fallback for Google Gemini Native API (v1beta/models/{m}:generateContent) */
async function callGeminiWeb(p: Provider, messages: ChatMsg[], signal?: AbortSignal): Promise<string> {
  const key = p.apiKey.trim();
  if (!key) throw new AiError(401, 'Gemini API key khali hai — Settings (⚙) me AIza... key daalo.');
  const model = (p.model.trim() || 'gemini-2.5-flash').replace(/^models\//, '');
  const sys = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'hi' }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  };
  if (sys) {
    body.systemInstruction = { parts: [{ text: sys }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 260);
    throw new AiError(res.status, `Gemini ${res.status} — ${detail || res.statusText}`);
  }
  const j = await res.json();
  const parts: any[] = j?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((pt) => !pt?.thought)
    .map((pt) => pt?.text ?? '')
    .join('')
    .trim();
}

/**
 * Universal AI streaming —
 * 1) Offline GGUF -> LocalAi.generate (llama.cpp JNI)
 * 2) Android APK Cloud/Local -> LocalAi.cloudChat (Native OkHttp: zero CORS + Gemini Native + OpenAI-compat)
 * 3) Web browser -> Gemini Native or OpenAI SSE
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

  // On Android APK, use Native OkHttp bridge so CORS or WebView quirks never block Online AI
  if (isAndroidApp()) {
    const onAbort = () => {
      LocalAi.stop().catch(() => {});
    };
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await LocalAi.cloudChat({
        providerId: p.id,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        model: p.model,
        messagesJson: JSON.stringify(messages),
      });
      if (res.text) yield res.text;
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const codeMatch = msg.match(/HTTP (\d{3})/);
      const status = codeMatch ? Number(codeMatch[1]) : 0;
      throw new AiError(status, msg);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  // Web browser Gemini Native path
  if (isGeminiProvider(p)) {
    const text = await callGeminiWeb(p, messages, signal);
    if (text) yield text;
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
      if (st.models.length > 0) {
        await LocalAi.loadModel({ name: st.models[0] });
        return 200;
      }
      throw new AiError(0, 'Pehle .gguf file Import ya Download karo');
    }
    return 200;
  }

  if (isAndroidApp()) {
    const res = await LocalAi.cloudChat({
      providerId: p.id,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: p.model,
      messagesJson: JSON.stringify([{ role: 'user', content: 'Reply only: OK' }]),
    });
    return res.status || 200;
  }

  if (isGeminiProvider(p)) {
    await callGeminiWeb(p, [{ role: 'user', content: 'Reply only: OK' }], signal);
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
