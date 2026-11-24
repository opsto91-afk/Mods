import { useMemo, useRef, useState } from 'react';
import { ChatDrawer } from './components/ChatDrawer';
import { ChatPane } from './components/ChatPane';
import { MapPane } from './components/MapPane';
import { MindPane } from './components/MindPane';
import { NotesPane } from './components/NotesPane';
import { SettingsSheet } from './components/SettingsSheet';
import { extractDiagram, Stage } from './components/Stage';
import { extractAiMemoryUpdates } from './prompt';
import { runTurn, SendOpts } from './runner';
import { useAppState } from './store';
import { Msg, Pane, uid } from './types';

export function App() {
  const [state, dispatch] = useAppState();
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stageDismissed, setStageDismissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeTopic =
    state.topics.find((t) => t.id === state.activeTopicId) ?? state.topics[0];

  const activeProvider = state.settings.providers.find(
    (p) => p.id === state.settings.activeId,
  );

  // Latest diagram from current chat (STAGE renders ONLY when a diagram actually exists!)
  const latestDiagram = useMemo(() => {
    if (busy && streamText) {
      const live = extractDiagram(streamText);
      if (live) return live;
    }
    for (let i = activeTopic.messages.length - 1; i >= 0; i--) {
      const m = activeTopic.messages[i];
      if (m.role === 'assistant') {
        const d = extractDiagram(m.text);
        if (d) return d;
      }
    }
    return null;
  }, [activeTopic.messages, busy, streamText]);

  const send = async (rawText: string, opts: SendOpts) => {
    let text = rawText.trim();
    if (!text) {
      const lastUser = [...activeTopic.messages].reverse().find((m) => m.role === 'user');
      if (!lastUser) return;
      text = lastUser.text;
    }

    setError(null);
    setBusy(true);
    setStreamText('');
    setStageDismissed(false);

    if (!opts.replaceLast) {
      const tempUser: Msg = { id: uid(), role: 'user', text, ts: Date.now() };
      dispatch({ t: 'pushMsg', topicId: activeTopic.id, msg: tempUser });
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await runTurn(
        state,
        activeTopic,
        text,
        opts,
        (partial) => setStreamText(partial),
        ctrl.signal,
      );

      if (opts.replaceLast) {
        const trimmed = activeTopic.messages.slice(0, -1);
        dispatch({
          t: 'setTopicMsgs',
          topicId: activeTopic.id,
          msgs: [...trimmed, res.assistantMsg],
        });
      } else {
        dispatch({ t: 'pushMsg', topicId: activeTopic.id, msg: res.assistantMsg });
      }

      // Live AI Read+Write: apply any ```note``` or ```xray``` blocks emitted by AI
      const mem = extractAiMemoryUpdates(res.assistantMsg.text);
      if (mem.notes.length > 0) {
        const existing = state.notes.trim();
        const additions = mem.notes
          .filter((n) => !existing.includes(n))
          .map((n) => `• ${n}`)
          .join('\n');
        if (additions) {
          dispatch({ t: 'notes', value: existing ? `${existing}\n${additions}` : additions });
        }
      }
      if (mem.xrays.length > 0) {
        const existingXray = state.xray.trim();
        const xrayAdd = mem.xrays
          .filter((x) => !existingXray.includes(x))
          .map((x) => `• ${x}`)
          .join('\n');
        if (xrayAdd) {
          dispatch({
            t: 'xray',
            value: existingXray ? `${existingXray}\n${xrayAdd}` : xrayAdd,
          });
        }
      }

      if (!res.fromCache) {
        dispatch({
          t: 'usage',
          chars: text.length + res.assistantMsg.text.length,
          requests: 1,
        });
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const branchFrom = (msg: Msg) => {
    const title = msg.text.replace(/```[\s\S]*?```/g, '').trim().slice(0, 28) || 'Branch';
    const handoff = `Parent "${activeTopic.title}" se branch: "${msg.text.slice(0, 180)}"`;
    dispatch({ t: 'addTopic', title, parentId: activeTopic.id, handoff });
  };

  const newQuickChat = () => {
    dispatch({ t: 'addTopic', title: 'New chat', parentId: null, handoff: null });
  };

  const showStage = state.pane === 'chat' && latestDiagram !== null && !stageDismissed;
  const latestProfile = state.profiles?.[0] ?? null;

  return (
    <div className={`app-shell ${showStage ? 'has-stage' : ''}`}>
      {/* Clean GPT-style top bar: ☰ Chats | Topic title + active AI badge | + New | ⚙ */}
      <header className="topbar">
        <button
          className="top-icon"
          onClick={() => setDrawerOpen(true)}
          title="All Chats"
        >
          ☰
        </button>

        <div className="top-center" onClick={() => setDrawerOpen(true)}>
          <span className="top-title">{activeTopic.title}</span>
          <span className="top-sub">
            {activeProvider?.kind === 'gguf'
              ? 'Offline GGUF'
              : activeProvider?.model || activeProvider?.label || 'AI'}
          </span>
        </div>

        <div className="top-right">
          <button className="top-icon" onClick={newQuickChat} title="New Chat">
            ＋
          </button>
          <button
            className="top-icon"
            onClick={() => setShowSettings(true)}
            title="AI Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Main Content Area — portrait: stacked; landscape: chat left + stage right */}
      <main className="workspace">
        {showStage && (
          <aside className="stage-dock">
            <Stage spec={latestDiagram} />
            <button
              className="stage-close"
              onClick={() => setStageDismissed(true)}
              title="Hide visual"
            >
              ✕
            </button>
          </aside>
        )}

        <section className="main-pane">
          {state.pane === 'chat' && (
            <ChatPane
              topic={activeTopic}
              busy={busy}
              streamText={streamText}
              error={error}
              onSend={send}
              onStop={stop}
              onBranchFrom={branchFrom}
            />
          )}
          {state.pane === 'map' && (
            <MapPane
              latestProfile={latestProfile}
              onGoMind={() => dispatch({ t: 'pane', pane: 'mind' })}
            />
          )}
          {state.pane === 'mind' && (
            <MindPane state={state} dispatch={dispatch} />
          )}
          {state.pane === 'notes' && (
            <NotesPane notes={state.notes} dispatch={dispatch} />
          )}
        </section>
      </main>

      {/* Clean Bottom Navigation: Chat · Brain Map · Mind (X-Ray) · Notes */}
      <nav className="bottom-nav">
        {(
          [
            ['chat', '💬', 'Chat'],
            ['map', '🧠', 'Brain Map'],
            ['mind', '⚡', 'Mind X-Ray'],
            ['notes', '📝', 'Notes'],
          ] as [Pane, string, string][]
        ).map(([p, icon, label]) => (
          <button
            key={p}
            className={`nav-tab ${state.pane === p ? 'active' : ''}`}
            onClick={() => dispatch({ t: 'pane', pane: p })}
          >
            <span className="nav-ic">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <ChatDrawer
        open={drawerOpen}
        topics={state.topics}
        activeId={activeTopic.id}
        dispatch={dispatch}
        onClose={() => setDrawerOpen(false)}
      />

      {showSettings && (
        <SettingsSheet
          settings={state.settings}
          dispatch={dispatch}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;

