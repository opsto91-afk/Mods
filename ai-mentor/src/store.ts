import { useEffect, useReducer } from 'react';
import {
  AppState,
  MindProfile,
  Msg,
  Pane,
  Settings,
  Topic,
  defaultProviders,
  initialState,
  uid,
} from './types';

const KEY = 'ai-mentor-v1';

export type Action =
  | { t: 'pane'; pane: Pane }
  | { t: 'settings'; patch: Partial<Settings> }
  | { t: 'addTopic'; title: string; parentId: string | null; handoff?: string | null }
  | { t: 'renameTopic'; id: string; title: string }
  | { t: 'delTopic'; id: string }
  | { t: 'openTopic'; id: string }
  | { t: 'pushMsg'; topicId: string; msg: Msg }
  | { t: 'setTopicMsgs'; topicId: string; msgs: Msg[] }
  | { t: 'notes'; value: string }
  | { t: 'xray'; value: string }
  | { t: 'addProfile'; profile: MindProfile }
  | { t: 'delProfile'; id: string }
  | { t: 'usage'; chars: number; requests: number }
  | { t: 'hydrate'; state: AppState };

function mapTopic(s: AppState, id: string, fn: (t: Topic) => Topic): AppState {
  return { ...s, topics: s.topics.map((t) => (t.id === id ? fn(t) : t)) };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.t) {
    case 'hydrate':
      return a.state;
    case 'pane':
      return { ...s, pane: a.pane };
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'addTopic': {
      const topic: Topic = {
        id: uid(),
        title: a.title.trim() || 'Untitled',
        parentId: a.parentId,
        messages: [],
        handoff: a.handoff ?? null,
      };
      return { ...s, topics: [...s.topics, topic], activeTopicId: topic.id, pane: 'chat' };
    }
    case 'renameTopic':
      return mapTopic(s, a.id, (t) => ({ ...t, title: a.title }));
    case 'delTopic': {
      const kill = new Set<string>([a.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of s.topics) {
          if (t.parentId && kill.has(t.parentId) && !kill.has(t.id)) {
            kill.add(t.id);
            grew = true;
          }
        }
      }
      const topics = s.topics.filter((t) => !kill.has(t.id));
      const safe = topics.length
        ? topics
        : [
            {
              id: uid(),
              title: 'General',
              parentId: null,
              messages: [],
              handoff: null,
            } as Topic,
          ];
      const active = kill.has(s.activeTopicId) ? safe[0].id : s.activeTopicId;
      return { ...s, topics: safe, activeTopicId: active };
    }
    case 'openTopic':
      return { ...s, activeTopicId: a.id, pane: 'chat' };
    case 'pushMsg':
      return mapTopic(s, a.topicId, (t) => ({ ...t, messages: [...t.messages, a.msg] }));
    case 'setTopicMsgs':
      return mapTopic(s, a.topicId, (t) => ({ ...t, messages: a.msgs }));
    case 'notes':
      return { ...s, notes: a.value };
    case 'xray':
      return { ...s, xray: a.value };
    case 'addProfile':
      return {
        ...s,
        profiles: [a.profile, ...(s.profiles ?? [])],
        xray: `${a.profile.archetype} — ${a.profile.summary} | Traits: ${a.profile.traits.join(', ')}`,
      };
    case 'delProfile':
      return { ...s, profiles: (s.profiles ?? []).filter((p) => p.id !== a.id) };
    case 'usage':
      return {
        ...s,
        usage: { chars: s.usage.chars + a.chars, requests: s.usage.requests + a.requests },
      };
    default:
      return s;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.topics?.length) return initialState();
    const base = initialState();
    // merge providers so newly added built-ins (gguf, groq) appear even on old saves
    const savedList = parsed.settings?.providers ?? [];
    const byId = new Map(savedList.map((p) => [p.id, p]));
    const mergedProviders = defaultProviders().map((d) => byId.get(d.id) ?? d);
    for (const sp of savedList) {
      if (!mergedProviders.some((m) => m.id === sp.id)) mergedProviders.push(sp);
    }
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings, providers: mergedProviders },
      xray: parsed.xray ?? '',
      profiles: parsed.profiles ?? [],
      usage: parsed.usage ?? base.usage,
    };
  } catch {
    return initialState();
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* quota — ignore */
      }
    }, 250);
    return () => clearTimeout(id);
  }, [state]);

  return [state, dispatch] as const;
}

/** lesson cache — same sawal, purana jawab (token zero) */
const CACHE_KEY = 'ai-mentor-lessons-v1';

type LessonCache = Record<string, string>;

export function loadCache(): LessonCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveLesson(key: string, answer: string): void {
  try {
    const c = loadCache();
    c[key] = answer.slice(0, 8000);
    const keys = Object.keys(c);
    if (keys.length > 300) delete c[keys[0]];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
