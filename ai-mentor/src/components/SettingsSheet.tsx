import { useEffect, useState } from 'react';
import { ping } from '../ai';
import {
  CLOUD_PRESETS,
  GGUF_CATALOGUE,
  LocalAi,
  LocalAiState,
  fetchProviderModels,
  isAndroidApp,
} from '../localAi';
import { Action } from '../store';
import { Mode, Provider, Settings } from '../types';

interface Props {
  settings: Settings;
  dispatch: (a: Action) => void;
  onClose: () => void;
}

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
    setScannedModels([]);
  };

  const scanModels = async () => {
    setScanning(true);
    setTestStatus('Models scan ho rahe hain…');
    try {
      const list = await fetchProviderModels(current.baseUrl, current.apiKey);
      setScannedModels(list);
      if (list.length) {
        if (!current.model || !list.includes(current.model)) {
          updateCurrent({ model: list[0] });
        }
        setTestStatus(`✓ ${list.length} models mile — neeche se chuno`);
      } else {
        setTestStatus('List khali mili — model naam manually likh sakte ho');
      }
    } catch (e) {
      setTestStatus(`Scan fail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScanning(false);
    }
  };

  const save = () => {
    dispatch({
      t: 'settings',
      patch: { providers, activeId, fallbackId, autoFallback, mode },
    });
    onClose();
  };

  const testNow = async () => {
    setTestStatus('Checking…');
    try {
      const code = await ping(current);
      setTestStatus(`✓ Connected (${code}) — Ready!`);
    } catch (e) {
      setTestStatus(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const doImportGguf = async () => {
    setGgufBusy(true);
    try {
      const st = await LocalAi.importModel();
      setGguf(st);
      if (st.imported) {
        setSelectedGguf(st.imported);
        updateCurrent({ model: st.imported });
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
      if (st.downloaded) {
        setSelectedGguf(st.downloaded);
        updateCurrent({ model: st.downloaded });
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>AI Setup (API + Offline GGUF)</h3>
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
                {p.label} {p.kind === 'gguf' ? '· Offline' : p.kind === 'local' ? '· Local HTTP' : '· API Key'}
              </option>
            ))}
          </select>
        </label>

        {/* ======= OFFLINE GGUF IN-APP PANEL ======= */}
        {current.kind === 'gguf' ? (
          <div className="provider-box gguf-box">
            <div className="provider-box-title">
              Offline GGUF Engine (llama.cpp In-App · No Internet / No API Key)
            </div>
            <div className="gguf-status">Status: {gguf.status}</div>

            <div className="gguf-row">
              <button className="btn primary sm" disabled={ggufBusy} onClick={doImportGguf}>
                📂 Import .gguf File
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
              <span>Available GGUF Models ({gguf.models.length})</span>
              <div className="inline-row">
                <select
                  value={selectedGguf}
                  onChange={(e) => setSelectedGguf(e.target.value)}
                >
                  {gguf.models.length === 0 && <option value="">— Koi .gguf model nahi —</option>}
                  {gguf.models.map((m) => (
                    <option key={m} value={m}>
                      {m} {gguf.loaded === m ? '(LOADED)' : ''}
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

            <div className="gguf-grid">
              <label className="field">
                <span>Threads (1-8)</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={gguf.threads}
                  onChange={(e) => setGguf({ ...gguf, threads: Number(e.target.value) || 4 })}
                />
              </label>
              <label className="field">
                <span>Context</span>
                <select
                  value={gguf.context}
                  onChange={(e) => setGguf({ ...gguf, context: Number(e.target.value) })}
                >
                  <option value={2048}>2048 (Fast / Low RAM)</option>
                  <option value={4096}>4096 (Balanced)</option>
                  <option value={8192}>8192 (Large RAM)</option>
                </select>
              </label>
              <label className="field">
                <span>Max Reply Tokens</span>
                <input
                  type="number"
                  min={128}
                  max={2048}
                  step={64}
                  value={gguf.maxTokens}
                  onChange={(e) => setGguf({ ...gguf, maxTokens: Number(e.target.value) || 512 })}
                />
              </label>
            </div>
          </div>
        ) : (
          /* ======= API KEY / LOCAL SERVER PANEL ======= */
          <div className="provider-box">
            <div className="provider-box-title">{current.label} Setup</div>

            {current.kind === 'cloud' && (
              <label className="field">
                <span>Quick Preset (URL auto-fill — bas Key daalo)</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) applyPreset(e.target.value);
                  }}
                >
                  <option value="">— Preset chuno (optional) —</option>
                  {CLOUD_PRESETS.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>API Key {current.kind === 'local' ? '(Local pe khali chhod do)' : '(Required)'}</span>
              <div className="inline-row">
                <input
                  type="password"
                  value={current.apiKey}
                  onChange={(e) => updateCurrent({ apiKey: e.target.value })}
                  placeholder="AIza... / gsk_... / sk-..."
                />
                <button
                  className="btn sm"
                  disabled={scanning}
                  onClick={scanModels}
                  title="Key se available models fetch karo"
                >
                  {scanning ? '…' : 'Scan Models'}
                </button>
              </div>
            </label>

            {scannedModels.length > 0 && (
              <label className="field">
                <span>Available Models ({scannedModels.length} found)</span>
                <select
                  value={current.model}
                  onChange={(e) => updateCurrent({ model: e.target.value })}
                >
                  {scannedModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Model Name</span>
              <input
                value={current.model}
                onChange={(e) => updateCurrent({ model: e.target.value })}
                placeholder="gemini-2.0-flash / llama-3.3-70b-versatile / llama3.2"
              />
            </label>

            <label className="field">
              <span>Base URL (OpenAI-compatible)</span>
              <input
                value={current.baseUrl}
                onChange={(e) => updateCurrent({ baseUrl: e.target.value })}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
              />
            </label>

            <div className="test-row">
              <button className="btn sm" onClick={testNow}>
                Test Connection
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
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
