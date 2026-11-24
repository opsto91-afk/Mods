import { Capacitor, registerPlugin } from '@capacitor/core';

export interface LocalAiState {
  models: string[];
  loaded: string;
  status: string;
  context: number;
  threads: number;
  maxTokens: number;
  temperature: number;
  imported?: string;
  downloaded?: string;
}

interface LocalAiPluginSpec {
  status(): Promise<LocalAiState>;
  listModels(): Promise<LocalAiState>;
  saveOptions(opts: { context: number; threads: number; maxTokens: number; temperature: number }): Promise<LocalAiState>;
  importModel(): Promise<LocalAiState>;
  downloadModel(opts: { url: string }): Promise<LocalAiState>;
  cancelTransfer(): Promise<void>;
  loadModel(opts: { name: string }): Promise<LocalAiState>;
  unloadModel(): Promise<LocalAiState>;
  deleteModel(opts: { name: string }): Promise<LocalAiState>;
  stop(): Promise<void>;
  generate(opts: { system: string; user: string }): Promise<{ text: string }>;
  fetchModels(opts: { providerId: string; baseUrl: string; apiKey: string }): Promise<{ models: string[] }>;
  cloudChat(opts: {
    providerId: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    messagesJson: string;
  }): Promise<{ text: string; status: number }>;
  addListener(
    eventName: 'token' | 'status',
    listenerFunc: (data: { text?: string; status?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const LocalAi = registerPlugin<LocalAiPluginSpec>('LocalAi');

export const isAndroidApp = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

/** ZaphRE se verified Q4_K_M GGUF direct download URLs */
export const GGUF_CATALOGUE: { label: string; size: string; url: string }[] = [
  {
    label: 'Qwen2.5 Coder 0.5B Q4',
    size: '~400 MB · fastest',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-0.5B-Instruct-Q4_K_M.gguf',
  },
  {
    label: 'DeepSeek R1 Distill 1.5B Q4',
    size: '~1.1 GB · reasoning',
    url: 'https://huggingface.co/tensorblock/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
  },
  {
    label: 'Qwen3 1.7B Q4',
    size: '~1.1 GB · smart + fast',
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
  },
  {
    label: 'Qwen2.5 Coder 3B Q4',
    size: '~1.93 GB · balanced',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
  },
  {
    label: 'Qwen3 4B Q4',
    size: '~2.5 GB · strong',
    url: 'https://huggingface.co/jc-builds/Qwen3-4B-Q4_K_M-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
  },
];

export const CLOUD_PRESETS: {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  suggestedModels: string[];
  hint: string;
}[] = [
  {
    id: 'gemini',
    label: 'Google Gemini (AI Studio — Free)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
    ],
    hint: 'AIza... (aistudio.google.com/apikey)',
  },
  {
    id: 'groq',
    label: 'Groq (Free & Super Fast)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'qwen/qwen3-32b',
      'moonshotai/kimi-k2-instruct',
      'llama-3.1-8b-instant',
    ],
    hint: 'gsk_... (console.groq.com/keys)',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (All Models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    suggestedModels: [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'openai/gpt-4o-mini',
    ],
    hint: 'sk-or-v1-... (openrouter.ai/keys)',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT API)',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o'],
    hint: 'sk-... (platform.openai.com)',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    hint: 'sk-... (platform.deepseek.com)',
  },
];

/** API key ke prefix se provider auto-detect karo */
export function detectPresetFromKey(apiKey: string) {
  const k = apiKey.trim();
  if (k.startsWith('AIza')) return CLOUD_PRESETS.find((p) => p.id === 'gemini') ?? null;
  if (k.startsWith('gsk_')) return CLOUD_PRESETS.find((p) => p.id === 'groq') ?? null;
  if (k.startsWith('sk-or-')) return CLOUD_PRESETS.find((p) => p.id === 'openrouter') ?? null;
  return null;
}

export function getSuggestedModels(providerId: string, baseUrl: string, apiKey: string): string[] {
  const detected = detectPresetFromKey(apiKey);
  if (detected) return detected.suggestedModels;
  const byId = CLOUD_PRESETS.find(
    (p) => p.id === providerId || (baseUrl && baseUrl.includes(new URL(p.baseUrl).hostname)),
  );
  if (byId) return byId.suggestedModels;
  if (providerId === 'ollama') return ['llama3.2', 'llama3.2:3b', 'qwen2.5:3b', 'deepseek-r1:1.5b'];
  return [];
}

/** API key + baseUrl se available models ki list fetch karo (Native OkHttp on Android + Web fallback) */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  providerId = '',
): Promise<string[]> {
  const key = apiKey.trim();
  if (isAndroidApp()) {
    const res = await LocalAi.fetchModels({ providerId, baseUrl, apiKey: key });
    return Array.isArray(res?.models) ? res.models : [];
  }

  const isGem =
    providerId === 'gemini' ||
    baseUrl.includes('generativelanguage.googleapis.com') ||
    key.startsWith('AIza');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    if (isGem) {
      if (!key) throw new Error('Gemini API key (AIza...) daalo');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`,
        { signal: ctrl.signal },
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const j = await res.json();
      const list: any[] = Array.isArray(j?.models) ? j.models : [];
      return list
        .filter((m) => JSON.stringify(m?.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => String(m?.name ?? '').replace(/^models\//, ''))
        .filter((n) => n && !n.includes('embedding'))
        .sort()
        .reverse();
    }

    const base = baseUrl.replace(/\/+$/, '');
    if (!base || base.startsWith('local://')) return [];
    const headers: Record<string, string> = {};
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const res = await fetch(`${base}/models`, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const list: unknown[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
    const ids = list
      .map((m: any) => String(m?.id || m?.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    return Array.from(new Set(ids)).sort();
  } finally {
    clearTimeout(t);
  }
}
