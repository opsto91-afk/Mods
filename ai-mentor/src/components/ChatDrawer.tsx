import { useState } from 'react';
import { Topic } from '../types';
import { Action } from '../store';

interface Props {
  open: boolean;
  topics: Topic[];
  activeId: string;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

export function ChatDrawer({ open, topics, activeId, dispatch, onClose }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!open) return null;

  const byParent = new Map<string | null, Topic[]>();
  for (const t of topics) {
    const arr = byParent.get(t.parentId) ?? [];
    arr.push(t);
    byParent.set(t.parentId, arr);
  }

  const newChat = (parentId: string | null = null) => {
    let handoff: string | null = null;
    if (parentId) {
      const parent = topics.find((t) => t.id === parentId);
      if (parent && parent.messages.length) {
        const firstUser = parent.messages.find((m) => m.role === 'user');
        const lastTwo = parent.messages.slice(-2).map((m) => `${m.role}: ${m.text.slice(0, 100)}`);
        handoff = [
          `Parent: "${parent.title}"`,
          firstUser ? `Start: "${firstUser.text.slice(0, 100)}"` : '',
          ...lastTwo,
        ]
          .filter(Boolean)
          .join(' | ');
      }
    }
    dispatch({ t: 'addTopic', title: parentId ? 'Branch chat' : 'New chat', parentId, handoff });
    onClose();
  };

  const renderNode = (t: Topic, depth: number): JSX.Element => {
    const kids = byParent.get(t.id) ?? [];
    const isActive = t.id === activeId;
    return (
      <div key={t.id} className="drawer-item-wrap" style={{ paddingLeft: depth * 14 }}>
        <div className={`drawer-item ${isActive ? 'active' : ''}`}>
          {renaming === t.id ? (
            <input
              className="drawer-rename"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft.trim()) dispatch({ t: 'renameTopic', id: t.id, title: draft.trim() });
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (draft.trim()) dispatch({ t: 'renameTopic', id: t.id, title: draft.trim() });
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <button
              className="drawer-title"
              onClick={() => {
                dispatch({ t: 'openTopic', id: t.id });
                onClose();
              }}
            >
              <span className="drawer-dot">{depth > 0 ? '↳' : '💬'}</span>
              <span className="drawer-name">{t.title}</span>
              <span className="drawer-count">{t.messages.length}</span>
            </button>
          )}
          <div className="drawer-actions">
            <button
              className="icon-btn"
              title="Branch chat"
              onClick={() => newChat(t.id)}
            >
              +
            </button>
            <button
              className="icon-btn"
              title="Rename"
              onClick={() => {
                setRenaming(t.id);
                setDraft(t.title);
              }}
            >
              ✎
            </button>
            <button
              className="icon-btn danger"
              title="Delete"
              onClick={() => dispatch({ t: 'delTopic', id: t.id })}
            >
              ×
            </button>
          </div>
        </div>
        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-brand">Chats</span>
          <button className="btn primary sm" onClick={() => newChat(null)}>
            + New Chat
          </button>
        </div>
        <div className="drawer-list">
          {roots.map((r) => renderNode(r, 0))}
        </div>
      </aside>
    </div>
  );
}
