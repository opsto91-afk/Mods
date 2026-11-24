import { useEffect, useState } from 'react';
import { ping } from '../ai';
import {
  CLOUD_PRESETS,
  GGUF_CATALOGUE,
  LocalAi,
  LocalAiState,
  detectPresetFromKey,
  fetchProviderModels,
  getSuggestedModels,
  isAndroidApp,
} from '../localAi';
import { Action } from '../store';
import { Mode, Provider, Settings } from '../types';

interface Props {
  settings: Settings;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

const THREAD_OPTIONS = [1, 2, 4, 6, 8];
const CONTEXT_OPTIONS = [
  { value: 2048, label: '2048 (Fast · Low RAM)' },
  { value: 4096, label: '4096 (Balanced)' },
  { value: 8192, label: '8192 (Large Context)' },
  { value: 16384, label: '16384 (Max RAM)' },
];
const TOKEN_OPTIONS = [256, 512, 1024, 2048, 4096];

export function SettingsSheet({ settings, dispatch, onClose }: Props) {
  const [providers, setProviders] = useState<Provider[]>(settings.providers);
  const [activeId, setActiveId] = useState(settings.activeId);
  const [fallbackId, setFallbackId] = useState<string | null>(settings.fallbackId);
  const [autoFallback, setAutoFallback] = useState(settings.autoFallback);
  const [mode, setMode] = useState<Mode>(settings.mode);
  const [testStatus, setTestStatus] = useState<string>('');
  const [scannedModels, setScannedModels] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  // Offline GGUF state
  const [gguf, setGguf] = useState<LocalAiState>({
    models: [],
    loaded: '',
    status: isAndroidApp() ? 'Checking…' : 'APK me chalega',
    context: 4096,
    threads: 4,
    maxTokens: 512,
    temperature: 0.3,
  });
  const [ggufBusy, setGgufBusy] = useState(false);
  const [selectedGguf, setSelectedGguf] = useState('');
  const [dlUrl, setDlUrl] = useState(GGUF_CATALOGUE[0].url);

  const current = providers.find((p) => p.id === activeId) ?? providers[0];

  // Auto-save every setting change immediately so user never loses key/model
  useEffect(() => {
    dispatch({
      t: 'settings',
      patch: { providers, activeId, fallbackId, autoFallback, mode },
    });
  }, [providers, activeId, fallbackId, autoFallback, mode, dispatch]);

  useEffect(() => {
    if (!isAndroidApp()) return;
    let sub: { remove: () => Promise<void> } | null = null;
    LocalAi.status()
      .then((st) => {
        setGguf(st);
        if (st.loaded) setSelectedGguf(st.loaded);
        else if (st.models.length) setSelectedGguf(st.models[0]);
      })
      .catch(() => {});
    LocalAi.addListener('status', (ev) => {
      if (ev.status) setGguf((prev) => ({ ...prev, status: ev.status! }));
    }).then((s) => (sub = s));
    return () => {
      sub?.remove().catch(() => {});
    };
  }, []);

  const updateCurrent = (patch: Partial<Provider>) => {
    setProviders((list) => list.map((p) => (p.id === current.id ? { ...p, ...patch } : p)));
  };

  const applyPreset = (presetId: string) => {
    const pr = CLOUD_PRESETS.find((x) => x.id === presetId);
    if (!pr) return;
    updateCurrent({
      baseUrl: pr.baseUrl || current.baseUrl,
      model: pr.defaultModel || current.model,
    });
    setScannedModels(pr.suggestedModels);
  };

  const onApiKeyChange = (rawKey: string) => {
    const detected = detectPresetFromKey(rawKey);
    if (detected) {
      updateCurrent({
        apiKey: rawKey,
        baseUrl: detected.baseUrl,
        model: current.model || detected.defaultModel,
      });
    } else {
      updateCurrent({ apiKey: rawKey });
    }
  };

  const scanModels = async (overrideProvider?: Provider) => {
    const target = overrideProvider ?? current;
    setScanning(true);
    setTestStatus('Models scan ho rahe hain…');
    try {
      const list = await fetchProviderModels(target.baseUrl, target.apiKey, target.id);
      if (list.length) {
        setScannedModels(list);
        const preferred =
          list.find((m) => m === 'gemini-2.5-flash') ??
          list.find((m) => m === target.model) ??
          list[0];
        updateCurrent({ model: preferred });
        setTestStatus(`✓ ${list.length} models mile — dropdown se chuno`);
      } else {
        const fallback = getSuggestedModels(target.id, target.baseUrl, target.apiKey);
        setScannedModels(fallback);
        setTestStatus('Suggested models load kiye gaye');
      }
    } catch (e) {
      const fallback = getSuggestedModels(target.id, target.baseUrl, target.apiKey);
      if (fallback.length) setScannedModels(fallback);
      setTestStatus(`Scan error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScanning(false);
    }
  };

  const testNow = async () => {
    setTestStatus('Testing connection…');
    try {
      const code = await ping(current);
      setTestStatus(`✓ Connected (${code}) — AI Ready!`);
    } catch (e) {
      setTestStatus(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const saveGgufOpts = (next: LocalAiState) => {
    setGguf(next);
    if (isAndroidApp()) {
      LocalAi.saveOptions({
        context: next.context,
        threads: next.threads,
        maxTokens: next.maxTokens,
        temperature: next.temperature,
      }).catch(() => {});
    }
  };

  const doImportGguf = async () => {
    setGgufBusy(true);
    try {
      const st = await LocalAi.importModel();
      setGguf(st);
      const picked = st.loaded || st.imported || st.models[0] || '';
      if (picked) {
        setSelectedGguf(picked);
        updateCurrent({ model: picked });
        setActiveId('gguf');
      }
    } catch (e) {
      setGguf((p) => ({ ...p, status: e instanceof Error ? e.message : 'Import cancelled' }));
    } finally {
      setGgufBusy(false);
    }
  };

  const doDownloadGguf = async () => {
    setGgufBusy(true);
    try {
      const st = await LocalAi.downloadModel({ url: dlUrl });
      setGguf(st);
      const picked = st.loaded || st.downloaded || st.models[0] || '';
      if (picked) {
        setSelectedGguf(picked);
        updateCurrent({ model: picked });
        setActiveId('gguf');
      }
    } catch (e) {
      setGguf((p) => ({ ...p, status: e instanceof Error ? e.message : 'Download failed' }));
    } finally {
      setGgufBusy(false);
    }
  };

  const doLoadGguf = async () => {
    if (!selectedGguf) return;
    setGgufBusy(true);
    try {
      await LocalAi.saveOptions({
        context: gguf.context,
        threads: gguf.threads,
        maxTokens: gguf.maxTokens,
        temperature: gguf.temperature,
      });
      const st = await LocalAi.loadModel({ name: selectedGguf });
      setGguf(st);
      updateCurrent({ model: selectedGguf });
      setActiveId('gguf');
    } catch (e) {
      setGguf((p) => ({ ...p, status: e instanceof Error ? e.message : 'Load failed' }));
    } finally {
      setGgufBusy(false);
    }
  };

  const doUnloadGguf = async () => {
    const st = await LocalAi.unloadModel();
    setGguf(st);
  };

  const doDeleteGguf = async () => {
    if (!selectedGguf) return;
    const st = await LocalAi.deleteModel({ name: selectedGguf });
    setGguf(st);
    setSelectedGguf(st.models[0] ?? '');
  };

  // Merge scanned models + built-in suggested models so dropdown is never empty
  const modelOptions = Array.from(
    new Set([
      ...scannedModels,
      ...getSuggestedModels(current.id, current.baseUrl, current.apiKey),
      ...(current.model ? [current.model] : []),
    ]),
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>AI Setup (Online API + Offline GGUF)</h3>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Mode selector: Offline GGUF vs API vs Local Server */}
        <label className="field">
          <span>Active AI Mode / Provider</span>
          <select
            value={activeId}
            onChange={(e) => {
              setActiveId(e.target.value);
              setTestStatus('');
              setScannedModels([]);
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.kind === 'gguf' ? '· Offline' : p.kind === 'local' ? '· Local HTTP' : '· Online API'}
              </option>
            ))}
          </select>
        </label>

        {/* ======= OFFLINE GGUF IN-APP PANEL ======= */}
        {current.kind === 'gguf' ? (
          <div className="provider-box gguf-box">
            <div className="provider-box-title">
              Offline GGUF Engine (In-App llama.cpp · No Internet / No API Key)
            </div>
            <div className="gguf-status">
              {gguf.loaded ? `✓ Loaded & Ready: ${gguf.loaded}` : `Status: ${gguf.status}`}
            </div>

            <div className="gguf-row">
              <button className="btn primary sm" disabled={ggufBusy} onClick={doImportGguf}>
                📂 Import .gguf File (Auto-Load)
              </button>
              {ggufBusy && (
                <button
                  className="btn sm"
                  onClick={() => LocalAi.cancelTransfer().catch(() => {})}
                >
                  Cancel
                </button>
              )}
            </div>

            <label className="field">
              <span>Ya Curated GGUF Model Download karo (HTTPS)</span>
              <div className="inline-row">
                <select value={dlUrl} onChange={(e) => setDlUrl(e.target.value)}>
                  {GGUF_CATALOGUE.map((c) => (
                    <option key={c.url} value={c.url}>
                      {c.label} ({c.size})
                    </option>
                  ))}
                </select>
                <button className="btn sm" disabled={ggufBusy} onClick={doDownloadGguf}>
                  ⬇ Download
                </button>
              </div>
            </label>

            <label className="field">
              <span>Saved GGUF Models ({gguf.models.length})</span>
              <div className="inline-row">
                <select
                  value={selectedGguf}
                  onChange={(e) => setSelectedGguf(e.target.value)}
                >
                  {gguf.models.length === 0 && <option value="">— Koi .gguf model nahi —</option>}
                  {gguf.models.map((m) => (
                    <option key={m} value={m}>
                      {m} {gguf.loaded === m ? '✓ (LOADED)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="btn primary sm"
                  disabled={ggufBusy || !selectedGguf}
                  onClick={doLoadGguf}
                >
                  Load
                </button>
                {gguf.loaded && (
                  <button className="btn sm" disabled={ggufBusy} onClick={doUnloadGguf}>
                    Unload
                  </button>
                )}
                {selectedGguf && (
                  <button className="btn sm" disabled={ggufBusy} onClick={doDeleteGguf}>
                    🗑
                  </button>
                )}
              </div>
            </label>

            {/* All 3 controls as clean Dropdowns (Threads, Context, Max Tokens) */}
            <div className="gguf-grid">
              <label className="field">
                <span>Threads</span>
                <select
                  value={gguf.threads}
                  onChange={(e) => saveGgufOpts({ ...gguf, threads: Number(e.target.value) })}
                >
                  {THREAD_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t} {t === 4 ? '(Recommended)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Context</span>
                <select
                  value={gguf.context}
                  onChange={(e) => saveGgufOpts({ ...gguf, context: Number(e.target.value) })}
                >
                  {CONTEXT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Max Reply Tokens</span>
                <select
                  value={gguf.maxTokens}
                  onChange={(e) => saveGgufOpts({ ...gguf, maxTokens: Number(e.target.value) })}
                >
                  {TOKEN_OPTIONS.map((tok) => (
                    <option key={tok} value={tok}>
                      {tok} tokens
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : (
          /* ======= ONLINE API KEY / LOCAL SERVER PANEL ======= */
          <div className="provider-box">
            <div className="provider-box-title">{current.label} Setup</div>

            {current.kind === 'cloud' && (
              <label className="field">
                <span>Provider Preset (URL + Models auto-set)</span>
                <select
                  value={CLOUD_PRESETS.find((p) => p.baseUrl === current.baseUrl)?.id ?? ''}
                  onChange={(e) => {
                    if (e.target.value) applyPreset(e.target.value);
                  }}
                >
                  <option value="">— Preset chuno —</option>
                  {CLOUD_PRESETS.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>API Key {current.kind === 'local' ? '(Local pe khali chhod do)' : '(Paste key here)'}</span>
              <div className="inline-row">
                <input
                  type="password"
                  value={current.apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="AIza... (Gemini) / gsk_... (Groq) / sk-..."
                />
                <button
                  className="btn primary sm"
                  disabled={scanning}
                  onClick={() => scanModels()}
                >
                  {scanning ? 'Scanning…' : '🔍 Detect Models'}
                </button>
              </div>
            </label>

            <label className="field">
              <span>Select Model ({modelOptions.length} available)</span>
              <select
                value={current.model}
                onChange={(e) => updateCurrent({ model: e.target.value })}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Ya Custom Model ID likho</span>
              <input
                value={current.model}
                onChange={(e) => updateCurrent({ model: e.target.value })}
                placeholder="gemini-2.5-flash / llama-3.3-70b-versatile"
              />
            </label>

            <label className="field">
              <span>Base URL</span>
              <input
                value={current.baseUrl}
                onChange={(e) => updateCurrent({ baseUrl: e.target.value })}
                placeholder="https://generativelanguage.googleapis.com/v1beta"
              />
            </label>

            <div className="test-row">
              <button className="btn primary sm" onClick={testNow}>
                ⚡ Test Connection
              </button>
              <span className="test-status">{testStatus}</span>
            </div>
          </div>
        )}

        {/* Auto-Fallback */}
        <label className="field check">
          <input
            type="checkbox"
            checked={autoFallback}
            onChange={(e) => setAutoFallback(e.target.checked)}
          />
          <span>Cloud limit (429) aaye to auto-switch →</span>
          <select
            value={fallbackId ?? ''}
            onChange={(e) => setFallbackId(e.target.value || null)}
          >
            <option value="">Off</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {/* Visual Mode */}
        <label className="field">
          <span>Visual Stage Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="text">Sirf Text (0 extra token)</option>
            <option value="auto">Auto (jab diagram zaroori ho tab)</option>
            <option value="visual">Visual (diagram + animation)</option>
          </select>
        </label>

        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            ✓ Done (Auto-Saved)
          </button>
        </div>
      </div>
    </div>
  );
}
