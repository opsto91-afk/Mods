import { buildSystemPrompt, fingerprint, PromptCtx } from './prompt';
import { ChatMsg, isLimitError, streamChat } from './ai';
import { loadCache, saveLesson } from './store';
import { AppState, Msg, Provider, Topic, uid } from './types';

export interface SendOpts {
  /** seedha jawab / stuck / visual level */
  seedha?: boolean;
  stuck?: boolean;
  visual?: 'diagram' | 'animate';
  /** purane assistant ko replace karna (regenerate) */
  replaceLast?: boolean;
  /** extra user text (default: jo input me tha) */
  overrideText?: string;
}

/**
 * Smart provider selector:
 * - Agar active provider cloud hai par usme apiKey khali hai, to check karo kisi aur cloud provider me apiKey hai kya.
 * - Agar nahi hai to gguf/local try karo.
 */
function pickProvider(s: AppState): Provider {
  const active = s.settings.providers.find((x) => x.id === s.settings.activeId);
  if (active) {
    if (active.kind === 'cloud' && !active.apiKey.trim()) {
      const withKey = s.settings.providers.find((x) => x.kind === 'cloud' && x.apiKey.trim());
      if (withKey) return withKey;
    }
    return active;
  }
  const firstWithKey = s.settings.providers.find((x) => x.kind === 'cloud' && x.apiKey.trim());
  if (firstWithKey) return firstWithKey;
  if (s.settings.providers.length > 0) return s.settings.providers[0];
  throw new Error('Koi provider selected nahi hai — Settings (⚙) kholo.');
}

function fallbackProvider(s: AppState, primaryId: string): Provider | null {
  // 1. If primary was gguf/local and failed, fallback to any cloud provider that has an API key
  const withKey = s.settings.providers.find(
    (x) => x.id !== primaryId && x.kind === 'cloud' && x.apiKey.trim(),
  );
  if (withKey) return withKey;

  // 2. Standard configured fallback (e.g. cloud 429 -> gguf/local)
  if (!s.settings.autoFallback || !s.settings.fallbackId) return null;
  const p = s.settings.providers.find((x) => x.id === s.settings.fallbackId);
  if (!p || p.id === primaryId) return null;
  return p;
}

/** history ko chhota rakho — sirf last N + diagram/note/xray blocks hata ke */
function slimHistory(msgs: Msg[], max = 12): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of msgs.slice(-max)) {
    let content = m.text;
    content = content
      .replace(/```diagram[\s\S]*?```/gi, '[diagram]')
      .replace(/```note[\s\S]*?```/gi, '')
      .replace(/```xray[\s\S]*?```/gi, '')
      .trim();
    if (!content) content = '(visual dikha diya gaya)';
    out.push({ role: m.role, content });
  }
  return out;
}

export interface RunResult {
  userMsg: Msg;
  assistantMsg: Msg;
  fromCache: boolean;
  providerId: string;
}

/**
 * Ek message chalata hai: cache check → stream (smart fallback ke saath) → save.
 */
export async function runTurn(
  state: AppState,
  topic: Topic,
  text: string,
  opts: SendOpts,
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<RunResult> {
  const notes = state.notes;
  const promptCtx: PromptCtx = {
    notes,
    xray: state.xray,
    handoff: topic.handoff,
    mode: state.settings.mode,
    seedha: opts.seedha,
    stuck: opts.stuck,
    visual: opts.visual,
  };

  // ---- lesson cache (sirf plain replies pe; stuck/visual regenerate pe skip) ----
  const plain = !opts.seedha && !opts.stuck && !opts.visual;
  const key = fingerprint(topic.id, text);
  if (plain) {
    const cached = loadCache()[key];
    if (cached) {
      const userMsg: Msg = { id: uid(), role: 'user', text, ts: Date.now() };
      const assistantMsg: Msg = { id: uid(), role: 'assistant', text: cached, ts: Date.now() };
      return { userMsg, assistantMsg, fromCache: true, providerId: 'cache' };
    }
  }

  const provider = pickProvider(state);
  const system = buildSystemPrompt(promptCtx);
  const baseMsgs = opts.replaceLast ? topic.messages.slice(0, -1) : topic.messages;
  const history = slimHistory(baseMsgs);

  const payload: ChatMsg[] = [{ role: 'system', content: system }, ...history];
  const lastIsUser = history.length > 0 && history[history.length - 1].role === 'user';
  if (!(opts.replaceLast && lastIsUser)) {
    payload.push({ role: 'user', content: text });
  }

  const collect = async (p: Provider): Promise<string> => {
    let full = '';
    for await (const delta of streamChat(p, payload, signal)) {
      full += delta;
      onDelta(full);
    }
    return full;
  };

  let full: string;
  let usedProvider = provider.id;
  try {
    full = await collect(provider);
  } catch (e) {
    const fb = fallbackProvider(state, provider.id);
    if (fb && (isLimitError(e) || provider.kind === 'gguf' || provider.kind === 'local')) {
      full = await collect(fb);
      usedProvider = fb.id;
    } else {
      throw e;
    }
  }

  if (!full.trim()) throw new Error('AI ne khali jawab diya — dobara try karo.');

  if (plain) saveLesson(key, full);

  return {
    userMsg: { id: uid(), role: 'user', text, ts: Date.now() },
    assistantMsg: { id: uid(), role: 'assistant', text: full, ts: Date.now() },
    fromCache: false,
    providerId: usedProvider,
  };
}
