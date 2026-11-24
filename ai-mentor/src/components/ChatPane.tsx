import { useEffect, useRef, useState } from 'react';
import { SendOpts } from '../runner';
import { Msg, Topic } from '../types';
import { stripDiagram } from './Stage';

interface Props {
  topic: Topic;
  busy: boolean;
  streamText: string;
  error: string | null;
  onSend: (text: string, opts: SendOpts) => void;
  onStop: () => void;
  onBranchFrom: (msg: Msg) => void;
}

export function ChatPane({
  topic,
  busy,
  streamText,
  error,
  onSend,
  onStop,
  onBranchFrom,
}: Props) {
  const [input, setInput] = useState('');
  const [seedha, setSeedha] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [topic.messages.length, streamText]);

  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput('');
    onSend(t, { seedha });
  };

  const hasAssistant = topic.messages.some((m) => m.role === 'assistant');

  return (
    <div className="pane chat-pane">
      <div className="msg-list" ref={listRef}>
        {topic.messages.length === 0 && !busy && (
          <div className="chat-welcome">
            <div className="welcome-title">Kya samajhna hai aaj?</div>
            <div className="welcome-chips">
              <button className="chip-btn" onClick={() => onSend('Gold Standard kya tha aur kyun toota?', {})}>
                Gold Standard
              </button>
              <button className="chip-btn" onClick={() => onSend('WiFi हवा me data kaise bhejta hai?', {})}>
                WiFi kaise kaam karta hai
              </button>
              <button className="chip-btn" onClick={() => onSend('CPU ke andar 0 aur 1 se calculation kaise hoti hai?', {})}>
                CPU 0 & 1 logic
              </button>
            </div>
          </div>
        )}

        {topic.messages.map((m) => {
          const clean = m.role === 'assistant' ? stripDiagram(m.text) : m.text;
          return (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="msg-body">{clean || '(visual stage pe)'}</div>
              {m.role === 'assistant' && (
                <div className="msg-tools">
                  <button
                    className="mini-link"
                    onClick={() => onBranchFrom(m)}
                    title="Is point se alag branch kholo"
                  >
                    ↳ Branch
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="msg assistant streaming">
            <div className="msg-body">{stripDiagram(streamText) || '…'}</div>
          </div>
        )}

        {error && <div className="err-banner">{error}</div>}
      </div>

      {/* Quick Teaching Controls — sirf jab conversation chal rahi ho */}
      {hasAssistant && !busy && (
        <div className="quick-row">
          <button
            className="chip-btn warn"
            onClick={() => onSend('Samajh nahi aaya — naye angle se chhota batao', { stuck: true, replaceLast: true })}
          >
            Atak gaya
          </button>
          <button
            className="chip-btn"
            onClick={() => onSend('Iska diagram bana ke dikhao', { visual: 'diagram' })}
          >
            Diagram
          </button>
          <button
            className="chip-btn"
            onClick={() => onSend('Isko animate karke dikhao', { visual: 'animate' })}
          >
            Animate
          </button>
        </div>
      )}

      {/* Clean GPT-style bottom composer */}
      <div className="composer">
        <button
          className={`seedha-pill ${seedha ? 'on' : ''}`}
          onClick={() => setSeedha((v) => !v)}
          title="Seedha jawab (bina cross-question)"
        >
          ⚡
        </button>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything…"
        />
        {busy ? (
          <button className="send-btn stop" onClick={onStop}>
            ■
          </button>
        ) : (
          <button className="send-btn" onClick={submit} disabled={!input.trim()}>
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
