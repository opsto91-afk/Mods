export type Role = 'user' | 'assistant';
export type Pane = 'map' | 'chat' | 'notes';
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
  kind: 'cloud' | 'local';
}

export interface Settings {
  providers: Provider[];
  activeId: string;
  fallbackId: string | null;
  autoFallback: boolean;
  mode: Mode;
}

export interface AppState {
  settings: Settings;
  topics: Topic[];
  activeTopicId: string;
  notes: string;
  /** X-ray report (dusre AI se banayi essay) — initial profile hint, chat se update hoti rahegi */
  xray: string;
  usage: { chars: number; requests: number };
  pane: Pane;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultProviders = (): Provider[] => [
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
    id: 'gemini',
    label: 'Gemini (free tier)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: '',
    model: 'gemini-2.0-flash',
    kind: 'cloud',
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
      activeId: 'ollama',
      fallbackId: 'ollama',
      autoFallback: true,
      mode: 'auto',
    },
    topics: [topic],
    activeTopicId: topic.id,
    notes: '',
    xray: '',
    usage: { chars: 0, requests: 0 },
    pane: 'chat',
  };
};
