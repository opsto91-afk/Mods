import { useEffect, useRef, useState } from 'react';
import type { Action } from '../store';
import { runTurn } from '../runner';
import { extractDiagram } from './Stage';
import type { AppState, Msg, Topic } from '../types';

interface Props {
  state: AppState;
  topic: Topic;
  dispatch: (a: Action) => void;
  onOpenSettings: () => void;
}

type Banner = { kind: 'err' | 'info'; text: string } | null;

const QUICK = [
  { id: 'stuck', label: '🌀 Atak gaya' },
  { id: 'heavy', label: '🧱 Bhaari ho gaya' },
  { id: 'exbad', label: '🎯 Example fit nahi' },
  { id: 'meaning', label: '💡 Pehle meaning' },
  { id: 'direct', label: '⚡ Seedha bata' },
  { id: 'show', label: '📊 Dikhao' },
  { id: 'anim', label: '🎬 Chalake dikhao' },
  { id: 'more', label: '➕ Aur batao' },
];

export default function ChatPane({ state, topic, dispatch, onOpenSettings }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = topic.messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, streamText]);

  function appendNote(line: string) {
    const cur = state.notes.trim();
    const next = cur ? cur + '\n' + line : line;
    dispatch({ t: 'notes', value: next });
  }

  async function send(opts: {
    text: string;
    seedha?: boolean;
    stuck?: boolean;
    visual?: 'diagram' | 'animate';
    replaceLast?: boolean;
    silentUser?: boolean;
  }) {
    if (busy) return;
    setBanner(null);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;

    const willReplace = !!opts.replaceLast && msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant';

    // optimistic user bubble (skip agar regenerate)
    if (!willReplace && !opts.silentUser) {
      dispatch({
        t: 'pushMsg',
        topicId: topic.id,
        msg: { id: Math.random().toString(36).slice(2), role: 'user', text: opts.text, ts: Date.now() } as Msg,
      });
    }

    try {
      // runTurn khud history ko set karega (replaceLast = aakhri assistant chhod ke)
      const res = await runTurn(
        state,
        topic,
        opts.text,
        {
          seedha: opts.seedha,
          stuck: opts.stuck,
          visual: opts.visual,
          replaceLast: willReplace,
        },
        (full) => setStreamText(full),
        ac.signal,
      );

      setStreamText(null);

      if (willReplace) {
        const cleaned = [...topic.messages.slice(0, -1), res.assistantMsg];
        dispatch({ t: 'setTopicMsgs', topicId: topic.id, msgs: cleaned });
        if (!res.fromCache) {
          dispatch({ t: 'usage', chars: res.assistantMsg.text.length, requests: 1 });
        }
      } else if (res.fromCache) {
        dispatch({ t: 'pushMsg', topicId: topic.id, msg: res.userMsg });
        dispatch({ t: 'pushMsg', topicId: topic.id, msg: res.assistantMsg });
        setBanner({ kind: 'info', text: '⚡ Lesson cache se mila — token kharch nahi hua.' });
      } else {
        dispatch({ t: 'pushMsg', topicId: topic.id, msg: res.assistantMsg });
        dispatch({ t: 'usage', chars: res.userMsg.text.length + res.assistantMsg.text.length, requests: 1 });
      }
    } catch (e) {
      setStreamText(null);
      const msg = e instanceof Error ? e.message : String(e);
      const localHint = msg.includes('Failed to fetch')
        ? '\n→ Local AI chal raha hai? Ollama/LM Studio kholo. Ollama ke liye: OLLAMA_ORIGINS="*" ollama serve'
        : '';
      setBanner({ kind: 'err', text: msg + localHint });
      if (msg.includes('Failed to fetch') || /429|402/.test(msg)) {
        // settings dikhao taaki provider badal sake
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void send({ text });
  }

  function onQuick(id: string) {
    if (busy) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');

    switch (id) {
      case 'stuck':
        if (!lastUser) return;
        appendNote('[Atak gaya] chhota piece, naya angle, purana example repeat nahi');
        void send({ text: lastUser.text, stuck: true, replaceLast: true, silentUser: true });
        break;
      case 'direct':
        if (!lastUser) return;
        void send({ text: lastUser.text, seedha: true, replaceLast: true, silentUser: true });
        break;
      case 'show':
        if (!lastUser) return;
        void send({ text: lastUser.text, visual: 'diagram', replaceLast: true, silentUser: true });
        break;
      case 'anim':
        if (!lastUser) return;
        void send({ text: lastUser.text, visual: 'animate', replaceLast: true, silentUser: true });
        break;
      case 'more':
        void send({ text: 'Aur batao — isi topic me aage badho.' });
        break;
      case 'heavy':
        appendNote('[Bhaari ho gaya] har jawab 3-4 line se zyada nahi, ek hi idea per reply');
        setBanner({ kind: 'info', text: 'Notes me likh diya — agli replies chhoti rahengi.' });
        break;
      case 'exbad':
        if (lastAssistant && extractDiagram(lastAssistant.text)) {
          appendNote('[Example/visual fit nahi] naya example, topic ke domain se, purana repeat nahi');
        } else {
          appendNote('[Example fit nahi] alag example do, pichhla wala repeat mat karo');
        }
        setBanner({ kind: 'info', text: 'Notes me likh diya — AI agla example badlega.' });
        break;
      case 'meaning':
        appendNote('[Pehle meaning] definition se pehle problem/situation, definition sabse last me');
        setBanner({ kind: 'info', text: 'Notes me likh diya — meaning-first chalega.' });
        break;
    }
  }

  const canQuick = msgs.some((m) => m.role === 'user');

  return (
    <div className="pane">
      {banner && (
        <div className={banner.kind === 'err' ? 'banner' : 'banner info'}>
          {banner.text}
          {banner.kind === 'err' && (
            <>
              {' '}
              <button style={{ padding: '2px 8px', fontSize: 11 }} onClick={onOpenSettings}>
                Settings
              </button>
            </>
          )}
        </div>
      )}

      <div className="msgs">
        {msgs.length === 0 && !streamText && (
          <div className="stage-hint" style={{ marginTop: 40 }}>
            <div style={{ fontSize: 22 }}>👋</div>
            <div>
              <b>{topic.title}</b> ki alag chat hai — context mix nahi hoga.
              <br />
              Koi concept likho, pehle meaning se samjhayega.
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.text.replace(/```diagram[\s\S]*?```/g, '').trim() || m.text}
            {m.role === 'assistant' && extractDiagram(m.text) && (
              <span className="diag-chip">📊 diagram stage pe upar</span>
            )}
          </div>
        ))}
        {streamText && <div className="msg assistant">{streamText}</div>}
        <div ref={bottomRef} />
      </div>

      {canQuick && (
        <div className="stuck-row">
          {QUICK.map((q) => (
            <button key={q.id} disabled={busy} onClick={() => onQuick(q.id)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className="composer">
        <textarea
          value={input}
          placeholder="Concept likho… (Enter = bhejo)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {busy ? (
          <button className="send danger" onClick={() => abortRef.current?.abort()}>
            ■
          </button>
        ) : (
          <button className="send primary" onClick={onSend} disabled={!input.trim()}>
            ➤
          </button>
        )}
      </div>
    </div>
  );
}
