import { useState } from 'react';
import { AppState, MindProfile, MindScores, Provider, uid } from '../types';
import { Action } from '../store';
import { XRAY_QUESTIONS, buildXrayAiPrompt } from '../prompt';
import { streamChat } from '../ai';

interface Props {
  state: AppState;
  dispatch: (a: Action) => void;
}

function clampScore(n: number): number {
  return Math.max(15, Math.min(98, Math.round(n)));
}

function pickBestProvider(state: AppState): Provider | undefined {
  const active = state.settings.providers.find((p) => p.id === state.settings.activeId);
  if (active && (active.kind !== 'cloud' || active.apiKey.trim())) return active;
  return state.settings.providers.find((p) => p.kind === 'cloud' && p.apiKey.trim()) ?? active;
}

export function MindPane({ state, dispatch }: Props) {
  const [mode, setMode] = useState<'card' | 'quiz'>('card');
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const profiles = state.profiles ?? [];
  const latest = profiles[0] ?? null;

  const computeBaseFromQuiz = (choices: number[]): { scores: MindScores; traits: string[]; summaryLines: string } => {
    const raw: MindScores = { logic: 42, pattern: 42, memory: 42, focus: 42, calm: 42, social: 38 };
    const traits: string[] = [];
    const lines: string[] = [];

    XRAY_QUESTIONS.forEach((q, idx) => {
      const optIdx = choices[idx] ?? 0;
      const opt = q.options[optIdx] ?? q.options[0];
      lines.push(`${q.part}: Q="${q.q}" -> A="${opt.label}"`);
      if (opt.trait && !traits.includes(opt.trait)) traits.push(opt.trait);
      for (const [k, v] of Object.entries(opt.delta)) {
        const key = k as keyof MindScores;
        raw[key] = (raw[key] ?? 40) + (v ?? 0);
      }
    });

    const scores: MindScores = {
      logic: clampScore(raw.logic),
      pattern: clampScore(raw.pattern),
      memory: clampScore(raw.memory),
      focus: clampScore(raw.focus),
      calm: clampScore(raw.calm),
      social: clampScore(raw.social),
    };
    return { scores, traits, summaryLines: lines.join('\n') };
  };

  const defaultArchetype = (s: MindScores): string => {
    if (s.pattern >= 75 && s.logic >= 75) return 'Pattern & Logic Architect';
    if (s.pattern >= 75) return 'Visual Pattern Navigator';
    if (s.logic >= 75 && s.calm >= 70) return 'Calm Systems Thinker';
    if (s.social >= 70) return 'Strategic Communicator';
    if (s.focus >= 75) return 'Deep Focus Builder';
    return 'Meaning-First Explorer';
  };

  const finishQuiz = async (finalChoices: number[]) => {
    setBusy(true);
    setErr(null);
    const { scores, traits, summaryLines } = computeBaseFromQuiz(finalChoices);

    const userMsgs = state.topics
      .flatMap((t) => t.messages)
      .filter((m) => m.role === 'user')
      .slice(-10)
      .map((m) => m.text.slice(0, 120))
      .join(' | ');

    let archetype = defaultArchetype(scores);
    let strengths = [
      scores.logic >= 65 ? 'First-principles reasoning (kyun/kaise pehle)' : 'Step-by-step practical grasp',
      scores.pattern >= 65 ? 'Do alag concepts me fast pattern link' : 'Concrete example se pakad',
      scores.calm >= 65 ? 'Atakne pe shant rehke naya angle lena' : 'High energy execution',
    ];
    let blindspots = [
      'Bina meaning ke lamba textbook text aate hi attention drop',
      'Repetitive examples se jaldi bore hona',
    ];
    let summary =
      'Dimag pehle core problem aur meaning pakadta hai, phir pattern jodta hai. Chhote 3-4 line ke practical steps aur real examples se sabse tez seekhta hai.';

    const provider = pickBestProvider(state);
    if (provider && (provider.apiKey.trim() || provider.kind !== 'cloud')) {
      try {
        let raw = '';
        for await (const d of streamChat(provider, [
          { role: 'user', content: buildXrayAiPrompt(summaryLines, userMsgs) },
        ])) {
          raw += d;
        }
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const j = JSON.parse(match[0]);
          if (typeof j.archetype === 'string' && j.archetype.trim()) archetype = j.archetype.trim();
          if (Array.isArray(j.strengths) && j.strengths.length) strengths = j.strengths.map(String).slice(0, 4);
          if (Array.isArray(j.blindspots) && j.blindspots.length) blindspots = j.blindspots.map(String).slice(0, 3);
          if (typeof j.summary === 'string' && j.summary.trim()) summary = j.summary.trim();
        }
      } catch {
        // AI optional — deterministic neuro-quiz profile is already complete
      }
    }

    const profile: MindProfile = {
      id: uid(),
      ts: Date.now(),
      source: 'xray-test',
      archetype,
      scores,
      traits,
      strengths,
      blindspots,
      summary,
    };
    dispatch({ t: 'addProfile', profile });
    setBusy(false);
    setMode('card');
    setStep(0);
    setPicked([]);
  };

  const analyzeFromChats = async () => {
    const userMsgs = state.topics
      .flatMap((t) => t.messages)
      .filter((m) => m.role === 'user')
      .slice(-15)
      .map((m) => m.text.slice(0, 140));

    if (userMsgs.length < 1 && !state.notes.trim()) {
      setErr('Pehle Chat me 1-2 baatein karo ya "Start X-Ray Test" chalao.');
      return;
    }
    setBusy(true);
    setErr(null);
    const baseScores: MindScores = latest?.scores ?? {
      logic: 76,
      pattern: 80,
      memory: 70,
      focus: 72,
      calm: 74,
      social: 60,
    };
    const provider = pickBestProvider(state);
    try {
      if (!provider) throw new Error('Settings (⚙) me AI provider select karo');
      let raw = '';
      for await (const d of streamChat(provider, [
        {
          role: 'user',
          content: buildXrayAiPrompt(
            `Current X-Ray: ${state.xray || '(empty)'}\nNotes: ${state.notes || '(empty)'}`,
            userMsgs.join('\n'),
          ),
        },
      ])) {
        raw += d;
      }
      const match = raw.match(/\{[\s\S]*\}/);
      const j = match ? JSON.parse(match[0]) : {};
      const profile: MindProfile = {
        id: uid(),
        ts: Date.now(),
        source: 'chat-observe',
        archetype: j.archetype || defaultArchetype(baseScores),
        scores: baseScores,
        traits: latest?.traits?.length ? latest.traits : ['Meaning-first thinker', 'Pattern connector'],
        strengths: Array.isArray(j.strengths) ? j.strengths.map(String) : ['Direct problem framing'],
        blindspots: Array.isArray(j.blindspots) ? j.blindspots.map(String) : ['Long textbook definitions'],
        summary: j.summary || raw.slice(0, 320) || 'Chat pattern analyzed.',
      };
      dispatch({ t: 'addProfile', profile });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'quiz') {
    const q = XRAY_QUESTIONS[step];
    return (
      <div className="pane mind-pane">
        <div className="xray-quiz-card">
          <div className="quiz-top">
            <span className="quiz-part">{q.part}</span>
            <span className="quiz-step">
              {step + 1} / {XRAY_QUESTIONS.length}
            </span>
          </div>
          <div className="quiz-q">{q.q}</div>
          <div className="quiz-opts">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                className="quiz-opt"
                disabled={busy}
                onClick={() => {
                  const next = [...picked, idx];
                  setPicked(next);
                  if (step + 1 < XRAY_QUESTIONS.length) {
                    setStep(step + 1);
                  } else {
                    finishQuiz(next);
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="quiz-foot">
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => {
                setMode('card');
                setStep(0);
                setPicked([]);
              }}
            >
              Cancel
            </button>
            {busy && <span className="quiz-busy">AI Building Virtual Identity…</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pane mind-pane">
      {/* Top Action Bar */}
      <div className="mind-actions-card">
        <div>
          <div className="brain-title">AI Mind X-Ray & Virtual Identity</div>
          <div className="brain-sub">
            AI tumhari chats se live samajhta hai ki tumhara dimag kaise kaam karta hai, aur khud yahan note down karta hai
          </div>
        </div>
        <div className="mind-btn-row">
          <button
            className="btn primary sm"
            disabled={busy}
            onClick={() => {
              setStep(0);
              setPicked([]);
              setMode('quiz');
            }}
          >
            ⚡ Start X-Ray Test (6 Qs)
          </button>
          <button className="btn sm" disabled={busy} onClick={analyzeFromChats}>
            {busy ? 'AI Analyzing…' : '🤖 AI se Live X-Ray Update Karwao'}
          </button>
        </div>
        {err && <div className="err-banner">{err}</div>}
      </div>

      {/* Live AI-Controlled X-Ray Notebook (Read + Write by AI) */}
      <div className="notes-card">
        <div className="notes-head">
          <div>
            <div className="brain-title">🤖 Live AI X-Ray Memory (AI Read + Write)</div>
            <div className="brain-sub">
              Chat karte waqt AI jo tumhare mind/learning style ke baare me observe karta hai wo live yahan update hota hai
            </div>
          </div>
          {state.xray.trim() && (
            <button className="btn sm" onClick={() => dispatch({ t: 'xray', value: '' })}>
              Clear
            </button>
          )}
        </div>
        <textarea
          className="notes-area"
          style={{ minHeight: 110 }}
          value={state.xray}
          onChange={(e) => dispatch({ t: 'xray', value: e.target.value })}
          placeholder="AI abhi tumhare mind pattern ko observe kar raha hai — chat me baat karo ya upar X-Ray Test chalao…"
        />
      </div>

      {/* Latest Virtual Identity Card */}
      {latest ? (
        <div className="identity-card">
          <div className="id-header">
            <div>
              <div className="id-badge">
                VIRTUAL IDENTITY · {latest.source === 'xray-test' ? 'X-RAY TEST' : 'AI LIVE OBSERVATION'}
              </div>
              <div className="id-archetype">{latest.archetype}</div>
            </div>
            <div className="id-date">{new Date(latest.ts).toLocaleDateString()}</div>
          </div>

          <p className="id-summary">{latest.summary}</p>

          <div className="id-traits">
            {latest.traits.map((t) => (
              <span key={t} className="id-trait-chip">
                {t}
              </span>
            ))}
          </div>

          <div className="id-grid">
            <div className="id-box">
              <div className="id-box-title ok">Strengths (Power Zones)</div>
              <ul>
                {latest.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="id-box">
              <div className="id-box-title warn">Blindspots (Avoid in Teaching)</div>
              <ul>
                {latest.blindspots.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-card">
          Abhi Virtual Identity card nahi bana. Upar <b>⚡ Start X-Ray Test</b> ya <b>🤖 AI se Live X-Ray Update Karwao</b> dabao!
        </div>
      )}

      {/* Saved History */}
      {profiles.length > 1 && (
        <div className="history-card">
          <div className="sec-title">Saved X-Ray History ({profiles.length})</div>
          {profiles.map((p, idx) => (
            <div key={p.id} className="history-row">
              <div>
                <div className="history-title">
                  {idx === 0 ? '★ ' : ''}
                  {p.archetype}{' '}
                  <span className="history-sub">
                    · L:{p.scores.logic} P:{p.scores.pattern} M:{p.scores.memory} C:{p.scores.calm}
                  </span>
                </div>
                <div className="history-date">
                  {new Date(p.ts).toLocaleString()} · {p.source}
                </div>
              </div>
              <button className="icon-btn danger" onClick={() => dispatch({ t: 'delProfile', id: p.id })}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
