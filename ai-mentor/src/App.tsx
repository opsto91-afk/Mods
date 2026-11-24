import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState } from './store';
import { activeTopic } from './selectors';
import Stage from './components/Stage';
import ChatPane from './components/ChatPane';
import MapPane from './components/MapPane';
import NotesPane from './components/NotesPane';
import SettingsSheet from './components/SettingsSheet';
import type { Pane } from './types';

const STAGE_KEY = 'ai-mentor-stage-h';

export default function App() {
  const [state, dispatch] = useAppState();
  const [showSettings, setShowSettings] = useState(false);
  const [stageH, setStageH] = useState(() => {
    const v = Number(localStorage.getItem(STAGE_KEY));
    return Number.isFinite(v) && v > 60 ? v : 200;
  });
  const dragging = useRef(false);
  const phoneRef = useRef<HTMLDivElement>(null);

  const topic = activeTopic(state);

  const setStage = useCallback((h: number) => {
    const max = Math.max(120, (phoneRef.current?.clientHeight ?? 700) - 260);
    const clamped = Math.min(Math.max(h, 80), max);
    setStageH(clamped);
    localStorage.setItem(STAGE_KEY, String(clamped));
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current || !phoneRef.current) return;
      const rect = phoneRef.current.getBoundingClientRect();
      setStage(e.clientY - rect.top - 54); // header + divider approx
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setStage]);

  const approxTokens = Math.round(state.usage.chars / 4);
  const hot = approxTokens > 50000;

  const panes: [Pane, string, string][] = [
    ['map', '🗺 Map', 'branches'],
    ['chat', '💬 Chat', 'teaching'],
    ['notes', '📝 Notes', 'profile'],
  ];

  return (
    <div className="phone" ref={phoneRef}>
      <header className="header">
        <span className="title">🧠 AI Mentor</span>
        <span className="crumb">
          {state.pane === 'chat' ? `topic: ${topic.title}` : state.pane === 'map' ? 'topic tree' : 'notes → AI'}
        </span>
        <span className={`usage ${hot ? 'hot' : ''}`} title="approx tokens this session">
          ~{approxTokens.toLocaleString()} tok
        </span>
        <button style={{ padding: '6px 10px' }} onClick={() => setShowSettings(true)} title="Settings">
          ⚙
        </button>
      </header>

      <Stage topic={topic} height={stageH} />

      <div
        className="divider"
        title="Khinch ke stage bada-chhota karo"
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          document.body.style.cursor = 'row-resize';
          document.body.style.userSelect = 'none';
        }}
      />

      <div className="content">
        {state.pane === 'chat' && (
          <ChatPane
            state={state}
            topic={topic}
            dispatch={dispatch}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        {state.pane === 'map' && <MapPane state={state} dispatch={dispatch} />}
        {state.pane === 'notes' && <NotesPane state={state} dispatch={dispatch} />}

        <nav className="tabs">
          {panes.map(([id, label]) => (
            <button
              key={id}
              className={state.pane === id ? 'on' : ''}
              onClick={() => dispatch({ t: 'pane', pane: id })}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {showSettings && (
        <SettingsSheet state={state} dispatch={dispatch} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
