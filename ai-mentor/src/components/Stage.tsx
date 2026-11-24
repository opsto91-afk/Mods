import { useEffect, useMemo, useRef, useState } from 'react';
import type { Topic } from '../types';

export interface DiagramSpec {
  template: 'pie' | 'line' | 'flow' | 'arrows';
  title?: string;
  parts?: { label: string; value: number }[];
  xLabel?: string;
  yLabel?: string;
  series?: { name: string; points: number[] }[];
  steps?: string[];
  frames?: { label?: string; items?: { x: number; y: number; label?: string }[]; arrows?: string[] }[];
  [k: string]: unknown;
}

/** last assistant message se ```diagram``` block nikalo */
export function extractDiagram(text: string): DiagramSpec | null {
  const m = text.match(/```diagram\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const spec = JSON.parse(m[1].trim()) as DiagramSpec;
    if (spec && typeof spec.template === 'string') return spec;
  } catch {
    /* bad JSON */
  }
  return null;
}

/** chat bubble se raw ```diagram```, ```note```, ```xray``` blocks hatao */
export function stripDiagram(text: string): string {
  return text
    .replace(/```diagram[\s\S]*?```/gi, '')
    .replace(/```note[\s\S]*?```/gi, '')
    .replace(/```xray[\s\S]*?```/gi, '')
    .trim();
}

const COLORS = ['#6ea8fe', '#7ee0a3', '#ffb454', '#c792ea', '#ff6b6b', '#82aaff', '#f78c6c'];

function Pie({ spec }: { spec: DiagramSpec }) {
  const parts = spec.parts?.length ? spec.parts : [{ label: 'A', value: 1 }];
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  let angle = -Math.PI / 2;
  const R = 70;
  const cx = 90;
  const cy = 85;
  const arcs = parts.map((p, i) => {
    const frac = Math.max(0, p.value) / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const x0 = cx + R * Math.cos(a0);
    const y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d =
      frac >= 0.999
        ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy}`
        : `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    return { d, color: COLORS[i % COLORS.length], p };
  });
  return (
    <svg viewBox="0 0 260 170" width="100%" style={{ maxHeight: '100%' }}>
      {spec.title && (
        <text x="130" y="14" textAnchor="middle" fill="#e8ecf3" fontSize="12" fontWeight="600">
          {spec.title}
        </text>
      )}
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} stroke="#0f1115" strokeWidth="1">
          <title>{`${a.p.label}: ${a.p.value}`}</title>
        </path>
      ))}
      {parts.map((p, i) => (
        <g key={i} transform={`translate(178, ${34 + i * 18})`}>
          <rect width="10" height="10" y="-9" rx="2" fill={COLORS[i % COLORS.length]} />
          <text x="15" y="0" fill="#c5cddb" fontSize="10.5">
            {p.label} ({Math.round((Math.max(0, p.value) / total) * 100)}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

function LineChart({ spec, t }: { spec: DiagramSpec; t: number }) {
  const series = spec.series?.length ? spec.series : [{ name: 'y', points: [1, 3, 2, 5, 4] }];
  const all = series.flatMap((s) => s.points);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const W = 260;
  const H = 150;
  const pad = { l: 30, r: 10, t: 22, b: 24 };
  const n = Math.max(...series.map((s) => s.points.length), 2);
  const px = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const py = (v: number) => {
    const rel = (v - min) / (max - min || 1);
    return H - pad.b - rel * (H - pad.t - pad.b);
  };
  // animation: points progressively dikhayein (t: 0..1)
  const shown = Math.max(1, Math.ceil(t * n));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: '100%' }}>
      {spec.title && (
        <text x={W / 2} y="13" textAnchor="middle" fill="#e8ecf3" fontSize="12" fontWeight="600">
          {spec.title}
        </text>
      )}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#2a3140" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#2a3140" />
      {spec.xLabel && (
        <text x={W - pad.r} y={H - 6} textAnchor="end" fill="#8b94a7" fontSize="9">
          {spec.xLabel}
        </text>
      )}
      {spec.yLabel && (
        <text x="4" y={pad.t - 6} fill="#8b94a7" fontSize="9">
          {spec.yLabel}
        </text>
      )}
      {series.map((s, si) => {
        const pts = s.points.slice(0, shown);
        const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth="2.2" strokeLinejoin="round" />
            {pts.map((v, i) => (
              <circle key={i} cx={px(i)} cy={py(v)} r="2.6" fill={COLORS[si % COLORS.length]} />
            ))}
            <text x={pad.l + 4} y={pad.t + 10 + si * 12} fill={COLORS[si % COLORS.length]} fontSize="9.5">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Flow({ spec, t }: { spec: DiagramSpec; t: number }) {
  const steps = spec.steps?.length ? spec.steps : ['Step 1', 'Step 2'];
  const shown = Math.max(1, Math.ceil(t * steps.length));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {spec.title && <div style={{ fontSize: 12, fontWeight: 600 }}>{spec.title}</div>}
      {steps.slice(0, shown).map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {i > 0 && <div style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}>↓</div>}
          <div
            style={{
              border: `1.5px solid ${COLORS[i % COLORS.length]}`,
              background: 'var(--panel2)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12.5,
              maxWidth: 240,
              textAlign: 'center',
            }}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  );
}

function Arrows({ spec, t }: { spec: DiagramSpec; t: number }) {
  const frames = spec.frames?.length ? spec.frames : [{ items: [{ x: 20, y: 50 }] }];
  const idx = Math.min(frames.length - 1, Math.floor(t * frames.length));
  const f = frames[Math.max(0, idx)];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 110 }}>
      {spec.title && (
        <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>{spec.title}</div>
      )}
      <svg viewBox="0 0 260 120" width="100%">
        {(f.items ?? []).map((it, i) => (
          <g key={i}>
            <circle cx={(it.x / 100) * 240 + 10} cy={(it.y / 100) * 100 + 10} r="9" fill={COLORS[i % COLORS.length]} opacity="0.9" />
            {it.label && (
              <text x={(it.x / 100) * 240 + 10} y={(it.y / 100) * 100 + 30} textAnchor="middle" fill="#c5cddb" fontSize="9">
                {it.label}
              </text>
            )}
          </g>
        ))}
        {(f.arrows ?? []).map((a, i) => (
          <text key={i} x="130" y={20 + i * 14} textAnchor="middle" fill="#8b94a7" fontSize="9">
            {a}
          </text>
        ))}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--dim)' }}>
        frame {idx + 1}/{frames.length}
      </div>
    </div>
  );
}

/** Stage: visual area — sirf tab dikhta hai jab diagram ho */
export function Stage({
  spec,
  topic,
  height,
}: {
  spec?: DiagramSpec | null;
  topic?: Topic;
  height?: number;
}) {
  const lastDiag = useMemo(() => {
    if (spec !== undefined) return spec;
    if (!topic) return null;
    for (let i = topic.messages.length - 1; i >= 0; i--) {
      const m = topic.messages[i];
      if (m.role !== 'assistant') continue;
      const d = extractDiagram(m.text);
      if (d) return d;
    }
    return null;
  }, [spec, topic]);

  const animated = lastDiag && (lastDiag.template === 'line' || lastDiag.template === 'flow' || lastDiag.template === 'arrows');
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    setT(1);
    setPlaying(false);
  }, [lastDiag]);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - t * 4000;
    const tick = (now: number) => {
      const v = (now - start) / 4000;
      if (v >= 1) {
        setT(1);
        setPlaying(false);
        return;
      }
      setT(v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lastDiag) return null;

  return (
    <div className="stage" style={height ? { height } : undefined}>
      <div className="stage-inner" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {lastDiag.template === 'pie' ? (
          <Pie spec={lastDiag} />
        ) : lastDiag.template === 'line' ? (
          <LineChart spec={lastDiag} t={t} />
        ) : lastDiag.template === 'flow' ? (
          <Flow spec={lastDiag} t={t} />
        ) : (
          <Arrows spec={lastDiag} t={t} />
        )}
      </div>
      {lastDiag && animated && (
        <div className="stage-controls">
          <button style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value) / 1000);
            }}
          />
          <button
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => {
              setT(0);
              setPlaying(true);
            }}
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}
