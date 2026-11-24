import { useState } from 'react';
import { ping } from '../ai';
import type { Action } from '../store';
import type { AppState, Mode, Provider } from '../types';

interface Props {
  state: AppState;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

type TestState = Record<string, { ok: boolean; msg: string } | undefined>;

/** Settings sheet: providers (cloud + local), test, auto-fallback, visual mode */
export default function SettingsSheet({ state, dispatch, onClose }: Props) {
  const { settings } = state;
  const [tests, setTests] = useState<TestState>({});
  const [testing, setTesting] = useState<string | null>(null);

  function patchProvider(id: string, patch: Partial<Provider>) {
    dispatch({
      t: 'settings',
      patch: {
        providers: settings.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    });
  }

  async function test(p: Provider) {
    setTesting(p.id);
    setTests((t) => ({ ...t, [p.id]: undefined }));
    try {
      await ping(p);
      setTests((t) => ({ ...t, [p.id]: { ok: true, msg: 'connected ✓' } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTests((t) => ({
        ...t,
        [p.id]: {
          ok: false,
          msg: msg.includes('Failed to fetch')
            ? 'server nahi mila (chalu hai? CORS?)'
            : msg.slice(0, 180),
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  const active = settings.providers.find((p) => p.id === settings.activeId);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <h2>⚙ Settings</h2>

        <div>
          <h3>AI Provider — cloud ya LOCAL, tu chun</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Sab OpenAI-compatible hain. Local = Ollama/LM Studio (token zero, private). Cloud = free tier
            (limit ke baad auto-fallback local pe).
          </div>

          {settings.providers.map((p) => {
            const on = settings.activeId === p.id;
            const t = tests[p.id];
            return (
              <div key={p.id} className={`provider-card ${on ? 'on' : ''}`}>
                <div className="head">
                  <input
                    type="radio"
                    name="provider"
                    checked={on}
                    onChange={() => dispatch({ t: 'settings', patch: { activeId: p.id } })}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <b style={{ flex: 1, fontSize: 13.5 }}>{p.label}</b>
                  <span className={`kind ${p.kind}`}>{p.kind === 'local' ? 'LOCAL' : 'CLOUD'}</span>
                </div>

                <div className="fields">
                  <input
                    placeholder="Base URL (…/v1)"
                    value={p.baseUrl}
                    onChange={(e) => patchProvider(p.id, { baseUrl: e.target.value })}
                  />
                  <input
                    placeholder={p.kind === 'local' ? 'API key (local ko chahiye nahi)' : 'API key'}
                    type="password"
                    value={p.apiKey}
                    onChange={(e) => patchProvider(p.id, { apiKey: e.target.value })}
                  />
                  <input
                    placeholder="model (e.g. llama3.2 / gemini-2.0-flash)"
                    value={p.model}
                    onChange={(e) => patchProvider(p.id, { model: e.target.value })}
                  />
                </div>

                <div className="acts">
                  <button
                    disabled={testing === p.id}
                    onClick={() => void test(p)}
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    {testing === p.id ? 'Testing…' : 'Test'}
                  </button>
                  {t && (
                    <span className={t.ok ? 'test-ok' : 'test-err'}>
                      {t.ok ? t.msg : `✕ ${t.msg}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="switch-row">
          <span>
            Auto-fallback: cloud limit (429) aaye to turant{' '}
            <b>{settings.providers.find((p) => p.id === settings.fallbackId)?.label ?? '—'}</b> pe switch
          </span>
          <input
            type="checkbox"
            checked={settings.autoFallback}
            onChange={(e) => dispatch({ t: 'settings', patch: { autoFallback: e.target.checked } })}
          />
        </div>
        <select
          value={settings.fallbackId ?? ''}
          onChange={(e) =>
            dispatch({ t: 'settings', patch: { fallbackId: e.target.value || null } })
          }
        >
          <option value="">Fallback: koi nahi</option>
          {settings.providers
            .filter((p) => p.id !== settings.activeId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                Fallback → {p.label}
              </option>
            ))}
        </select>

        <div>
          <h3>Visual mode (kharcha control)</h3>
          <div className="seg">
            {(
              [
                ['text', 'Text only'],
                ['auto', 'Auto'],
                ['visual', 'Visual always'],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                className={settings.mode === m ? 'on' : ''}
                onClick={() => dispatch({ t: 'settings', patch: { mode: m } })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Text only = kabhi diagram nahi (free limit ke liye). Auto = sirf zarurat pe. Visual always =
            AI diagram dega jab bhi sahi lage.
          </div>
        </div>

        <div>
          <h3>X-Ray report (optional — initial brain scan)</h3>
          <div className="muted" style={{ marginBottom: 6 }}>
            Kisi dusre AI (ChatGPT/Claude) se banayi "mind report" yahan paste karo — app sirf hint ke
            roop me use karega, aage chat se khud update hoti rahegi. (Docs me X-Ray prompt hai.)
          </div>
          <textarea
            style={{ width: '100%', minHeight: 90, fontSize: 13 }}
            placeholder="Paste your Cognitive Mind Report (essay/paragraph format)…"
            value={state.xray}
            onChange={(e) => dispatch({ t: 'xray', value: e.target.value })}
          />
          {state.xray.trim() && (
            <div className="muted" style={{ marginTop: 4 }}>
              {state.xray.length} chars ·{' '}
              <button
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => {
                  if (confirm('X-ray report delete karein?')) dispatch({ t: 'xray', value: '' });
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div>
          <h3>Usage (approx)</h3>
          <div className="muted">
            {state.usage.requests} requests · ~{(state.usage.chars / 4).toLocaleString()} tokens is
            session me (saved lessons alag se count nahi hote)
          </div>
        </div>

        <div className="close-row">
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
        {active && active.kind === 'local' && (
          <div className="muted">Local tip: Ollama CORS ke liye — OLLAMA_ORIGINS='*' ollama serve</div>
        )}
      </div>
    </div>
  );
}
