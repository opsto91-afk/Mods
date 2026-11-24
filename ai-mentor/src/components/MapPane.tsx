import { useState } from 'react';
import type { Action } from '../store';
import type { AppState, Topic } from '../types';

interface Props {
  state: AppState;
  dispatch: (a: Action) => void;
}

/** Map pane: topic tree — ek box = ek branch ki alag chat */
export default function MapPane({ state, dispatch }: Props) {
  const [newRoot, setNewRoot] = useState('');
  const [addingChild, setAddingChild] = useState<string | null>(null);
  const [childTitle, setChildTitle] = useState('');

  const roots = state.topics.filter((t) => t.parentId === null);
  const childrenOf = (id: string) => state.topics.filter((t) => t.parentId === id);

  function addRoot() {
    const title = newRoot.trim();
    if (!title) return;
    dispatch({ t: 'addTopic', title, parentId: null });
    setNewRoot('');
  }

  function addChild(parentId: string) {
    const title = childTitle.trim();
    if (!title) return;
    // handoff: parent ka chhota digest (summary mode — full history nahi, token bachat)
    const parent = state.topics.find((t) => t.id === parentId);
    let handoff: string | null = null;
    if (parent && parent.messages.length) {
      const firstUser = parent.messages.find((m) => m.role === 'user');
      const lastAssistant = [...parent.messages].reverse().find((m) => m.role === 'assistant');
      handoff = [
        firstUser ? `Parent ka pehla sawal: "${firstUser.text.slice(0, 120)}"` : '',
        lastAssistant
          ? `Parent ka aakhri point: ${lastAssistant.text.replace(/```diagram[\s\S]*?```/g, '[diagram]').slice(0, 180)}`
          : '',
      ]
        .filter(Boolean)
        .join(' | ');
    }
    dispatch({ t: 'addTopic', title, parentId, handoff });
    setChildTitle('');
    setAddingChild(null);
  }

  function renderNode(t: Topic, depth: number) {
    const kids = childrenOf(t.id);
    const active = state.activeTopicId === t.id;
    return (
      <div key={t.id}>
        <div className="row" style={{ paddingLeft: depth * 16 }}>
          <button className={`node ${active ? 'on' : ''}`} onClick={() => dispatch({ t: 'openTopic', id: t.id })}>
            {depth > 0 ? '└ ' : '🌳 '}
            {t.title}
            <span className="sub">
              {t.messages.length ? `${t.messages.length} msgs` : 'khaali'} · alag context
              {t.handoff ? ' · ↳ handoff' : ''}
            </span>
          </button>
          <button
            className="mini"
            title="Sub-topic add karo"
            onClick={() => {
              setAddingChild(addingChild === t.id ? null : t.id);
              setChildTitle('');
            }}
          >
            +
          </button>
          <button
            className="mini danger"
            title="Delete (bachhe bhi)"
            onClick={() => {
              if (confirm(`"${t.title}" aur uske saare sub-topics delete kar dein?`)) {
                dispatch({ t: 'delTopic', id: t.id });
              }
            }}
          >
            ×
          </button>
        </div>

        {addingChild === t.id && (
          <div className="row" style={{ paddingLeft: (depth + 1) * 16 + 6 }}>
            <input
              autoFocus
              placeholder="Sub-topic (nayi branch = alag chat)"
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChild(t.id)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button className="mini primary" onClick={() => addChild(t.id)}>
              OK
            </button>
          </div>
        )}

        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  }

  return (
    <div className="pane">
      <div className="map">
        <div className="muted" style={{ marginBottom: 10 }}>
          Har box = us topic ki <b>apni chat</b>. Ek jagah ka context doosri me nahi ghulta — token bhi bachte hain.
        </div>
        {roots.map((t) => renderNode(t, 0))}
        <div className="add-bar">
          <input
            placeholder="Naya root topic…"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoot()}
          />
          <button className="primary" onClick={addRoot} disabled={!newRoot.trim()}>
            + Topic
          </button>
        </div>
      </div>
    </div>
  );
}
