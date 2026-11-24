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

function pickProvider(s: AppState): Provider {
  const p = s.settings.providers.find((x) => x.id === s.settings.activeId);
  if (!p) throw new Error('Koi provider selected nahi hai — Settings kholo.');
  return p;
}

function fallbackProvider(s: AppState): Provider | null {
  if (!s.settings.autoFallback || !s.settings.fallbackId) return null;
  const p = s.settings.providers.find((x) => x.id === s.settings.fallbackId);
  if (!p || p.id === s.settings.activeId) return null;
  return p;
}

/** history ko chhota rakho — sirf last N + diagram blocks hata ke */
function slimHistory(msgs: Msg[], max = 12): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of msgs.slice(-max)) {
    let content = m.text;
    // diagram block history me mat bhejo (token + wahi render hota hai stage pe)
    content = content.replace(/```diagram[\s\S]*?```/g, '[diagram]').trim();
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
 * Ek message chalata hai: cache check → stream (fallback ke saath) → save.
 * Error throw karta hai, caller UI dikhata hai.
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
  // replaceLast: aakhri assistant chhota history se hat jayega — last user message wahi rehta hai
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
    const fb = fallbackProvider(state);
    if (fb && isLimitError(e)) {
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
