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

/** ZaphRE se same curated Q4_K_M GGUF catalogue — seedha HTTPS download */
export const GGUF_CATALOGUE: { label: string; size: string; url: string }[] = [
  {
    label: 'Qwen2.5-Coder 0.5B Instruct (Q4_K_M)',
    size: '~400 MB · fastest',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf',
  },
  {
    label: 'DeepSeek-R1-Distill 1.5B (Q4_K_M)',
    size: '~1.1 GB · reasoning',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
  },
  {
    label: 'Qwen3 1.7B (Q4_K_M)',
    size: '~1.1 GB · smart + fast',
    url: 'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
  },
  {
    label: 'Qwen2.5-Coder 3B Instruct (Q4_K_M)',
    size: '~2.0 GB · balanced',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf',
  },
  {
    label: 'Qwen3 4B (Q4_K_M)',
    size: '~2.5 GB · strong',
    url: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
  },
];

/** Presets: user sirf provider chunta hai → baseUrl + model auto set, bas API key daale */
export const CLOUD_PRESETS: { id: string; label: string; baseUrl: string; defaultModel: string; hint: string }[] = [
  {
    id: 'gemini',
    label: 'Gemini (Google AI Studio — Free)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    hint: 'aistudio.google.com/apikey se free key lo',
  },
  {
    id: 'groq',
    label: 'Groq (Free & Super Fast)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    hint: 'console.groq.com/keys se free key lo',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (Free models available)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    hint: 'openrouter.ai/keys se key lo (`:free` models 0 cost)',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT API)',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    hint: 'platform.openai.com/api-keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    hint: 'platform.deepseek.com',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible URL',
    baseUrl: '',
    defaultModel: '',
    hint: 'Koi bhi /v1 endpoint + key',
  },
];

/** API key + baseUrl se available models ki list fetch karo (`GET {baseUrl}/models`) */
export async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base || base.startsWith('local://')) return [];
  const headers: Record<string, string> = {};
  if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
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
