export type Role = 'user' | 'assistant';
export type Pane = 'map' | 'chat' | 'mind' | 'notes';
export type Mode = 'text' | 'auto' | 'visual';

export interface Msg {
  id: string;
  role: Role;
  text: string;
  ts: number;
}

export interface Topic {
  id: string;
  title: string;
  parentId: string | null;
  messages: Msg[];
  /** parent chat se 2-3 line digest jab branch bani */
  handoff: string | null;
}

export interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  kind: 'cloud' | 'local' | 'gguf';
}

export interface Settings {
  providers: Provider[];
  activeId: string;
  fallbackId: string | null;
  autoFallback: boolean;
  mode: Mode;
}

/** Brain/Mind measurement levels (0–100) + Big Five / cognitive virtual identity */
export interface MindScores {
  logic: number;    // Prefrontal Cortex — reasoning & problem solving
  pattern: number;  // Parietal Lobe — pattern matching & spatial link
  memory: number;   // Hippocampus / Temporal — semantic encoding
  focus: number;    // Anterior Cingulate — attention control
  calm: number;     // Amygdala regulation — emotional stability
  social: number;   // Social brain / Extraversion-Agreeableness
}

export interface MindProfile {
  id: string;
  ts: number;
  source: 'xray-test' | 'chat-observe';
  archetype: string;
  scores: MindScores;
  traits: string[];
  strengths: string[];
  blindspots: string[];
  summary: string;
}

export interface AppState {
  settings: Settings;
  topics: Topic[];
  activeTopicId: string;
  notes: string;
  /** X-ray report — initial/latest profile hint, chat se update hoti rahegi */
  xray: string;
  /** Saved virtual identity cards (Mind section history) */
  profiles: MindProfile[];
  usage: { chars: number; requests: number };
  pane: Pane;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultProviders = (): Provider[] => [
  {
    id: 'gguf',
    label: 'Offline GGUF (In-App)',
    baseUrl: 'local://gguf',
    apiKey: '',
    model: 'local.gguf',
    kind: 'gguf',
  },
  {
    id: 'gemini',
    label: 'Gemini (API Key)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    model: 'gemini-2.0-flash',
    kind: 'cloud',
  },
  {
    id: 'groq',
    label: 'Groq (API Key)',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    kind: 'cloud',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3.2',
    kind: 'local',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    model: '',
    kind: 'local',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    apiKey: '',
    model: '',
    kind: 'cloud',
  },
];

export const initialState = (): AppState => {
  const topic: Topic = {
    id: uid(),
    title: 'General',
    parentId: null,
    messages: [],
    handoff: null,
  };
  return {
    settings: {
      providers: defaultProviders(),
      activeId: 'gemini',
      fallbackId: 'gguf',
      autoFallback: true,
      mode: 'auto',
    },
    topics: [topic],
    activeTopicId: topic.id,
    notes: '',
    xray: '',
    profiles: [],
    usage: { chars: 0, requests: 0 },
    pane: 'chat',
  };
};
