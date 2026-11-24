import { useState } from 'react';
import { MindProfile, MindScores } from '../types';

interface Props {
  latestProfile: MindProfile | null;
  onGoMind: () => void;
}

interface BrainRegion {
  id: string;
  name: string;
  hiName: string;
  scoreKey: keyof MindScores;
  color: string;
  cx: number;
  cy: number;
  r: number;
  role: string;
  detail: string;
  signals: string[];
}

const REGIONS: BrainRegion[] = [
  {
    id: 'prefrontal',
    name: 'Prefrontal Cortex (Frontal Lobe)',
    hiName: 'तर्क, निर्णय और समस्या-समाधान',
    scoreKey: 'logic',
    color: '#6ea8fe',
    cx: 88,
    cy: 86,
    r: 28,
    role: 'Logic · Planning · Self-Control · Working Memory',
    detail:
      'Dimag ka CEO. Jab tu "pehle meaning batao, 2+2 se 20+20 jodo" sochta hai to yahi hissa active hota hai. Ye impulse rokta hai aur step-by-step decision banata hai.',
    signals: ['Why/How poochhna', 'Pros vs Cons', 'Focus control', 'Impulse brake'],
  },
  {
    id: 'parietal',
    name: 'Parietal Lobe',
    hiName: 'पैटर्न मैचिंग और कनेक्शन',
    scoreKey: 'pattern',
    color: '#a370f7',
    cx: 170,
    cy: 66,
    r: 26,
    role: 'Pattern Recognition · Spatial Map · Number Sense',
    detail:
      'Insaan ke ~95% fast decisions pattern matching se hote hain. Do alag topics me ek jaisa ढांचा (structure) pakadna aur visual diagrams samajhna isi ka kaam hai.',
    signals: ['Analogy pakadna', 'Mental diagrams', 'Hidden links', 'Speed intuition'],
  },
  {
    id: 'hippocampus',
    name: 'Hippocampus & Temporal Lobe',
    hiName: 'याददाश्त और भाषा का अर्थ',
    scoreKey: 'memory',
    color: '#4dd4ac',
    cx: 150,
    cy: 122,
    r: 22,
    role: 'Deep Memory Encoding · Language Meaning',
    detail:
      'Ratta (shallow text) jaldi bhoolta hai kyunki Hippocampus cheezon ko tabhi pakka save karta hai jab unka "meaning" aur purane gyaan se link jude.',
    signals: ['Story/Meaning memory', 'Concept linking', 'Long-term recall'],
  },
  {
    id: 'cingulate',
    name: 'Anterior Cingulate & Attention Net',
    hiName: 'ध्यान और फोकस लॉक',
    scoreKey: 'focus',
    color: '#ffd166',
    cx: 132,
    cy: 88,
    r: 16,
    role: 'Focus Switch · Error Detection · Cognitive Effort',
    detail:
      'Ye तय karta hai ki dimag ek waqt me kitna load lega. Chhote 3-5 line ke steps isliye kaam karte hain kyunki working attention overload nahi hoti.',
    signals: ['Deep work', 'Mistake spotting', 'Micro-chunk learning'],
  },
  {
    id: 'amygdala',
    name: 'Amygdala (Limbic System)',
    hiName: 'गुस्सा, डर और स्ट्रेस कंट्रोल',
    scoreKey: 'calm',
    color: '#ff7b72',
    cx: 126,
    cy: 132,
    r: 14,
    role: 'Threat Alarm · Anger/Fear · Emotional Reactivity',
    detail:
      'Jab koi cheez samajh na aaye aur frustration/gussa aaye, to Amygdala hijack karta hai aur Prefrontal logic band hone lagta hai. Calm score jitna high, dimag mushkil me utna thanda.',
    signals: ['Calm under stress', 'Frustration recovery', 'Emotional balance'],
  },
  {
    id: 'social',
    name: 'Social & Mirror Network (Big Five)',
    hiName: 'व्यक्तित्व: Introvert / Extrovert / Persuasion',
    scoreKey: 'social',
    color: '#f783ac',
    cx: 218,
    cy: 108,
    r: 22,
    role: 'Empathy · Social Strategy · Extraversion vs Solitude',
    detail:
      'Logon ko padhna, apni baat manwana (persuasion), ya akele deep sochna (introversion) — ye network Big Five personality traits ko chalata hai.',
    signals: ['Introvert vs Outgoing', 'Reading people', 'Communication style'],
  },
];

const DEFAULT_SCORES: MindScores = {
  logic: 50,
  pattern: 50,
  memory: 50,
  focus: 50,
  calm: 50,
  social: 50,
};

export function MapPane({ latestProfile, onGoMind }: Props) {
  const [selectedId, setSelectedId] = useState<string>('prefrontal');
  const scores = latestProfile?.scores ?? DEFAULT_SCORES;
  const active = REGIONS.find((r) => r.id === selectedId) ?? REGIONS[0];

  return (
    <div className="pane map-pane">
      {/* Interactive Human Brain SVG */}
      <div className="brain-card">
        <div className="brain-header">
          <div>
            <div className="brain-title">Human Brain & Cognitive Map</div>
            <div className="brain-sub">Kisi bhi part pe tap karo — uska kaam aur apna level dekho</div>
          </div>
          <button className="btn sm primary" onClick={onGoMind}>
            {latestProfile ? 'Update X-Ray' : 'Run X-Ray Test'}
          </button>
        </div>

        <svg viewBox="0 0 310 190" className="brain-svg">
          {/* Outer cortex silhouette */}
          <path
            d="M55,115 C42,95 48,60 75,45 C98,30 135,25 172,32 C212,38 248,62 252,98 C255,126 235,148 205,152 C192,168 165,172 148,158 L112,155 C85,155 64,138 55,115 Z"
            fill="#141923"
            stroke="#2c3650"
            strokeWidth="2"
          />
          {/* Brainstem */}
          <path
            d="M140,152 L146,182 L168,182 L162,152 Z"
            fill="#1b2230"
            stroke="#2c3650"
            strokeWidth="1.5"
          />
          {/* Neural pathways connecting regions */}
          <g stroke="#2a3550" strokeWidth="1.2" strokeDasharray="3 3">
            <line x1="88" y1="86" x2="170" y2="66" />
            <line x1="88" y1="86" x2="132" y2="88" />
            <line x1="132" y1="88" x2="150" y2="122" />
            <line x1="132" y1="88" x2="126" y2="132" />
            <line x1="170" y1="66" x2="218" y2="108" />
            <line x1="150" y1="122" x2="218" y2="108" />
          </g>

          {/* Interactive nodes */}
          {REGIONS.map((r) => {
            const isSel = r.id === active.id;
            const val = scores[r.scoreKey];
            return (
              <g
                key={r.id}
                className="brain-node"
                onClick={() => setSelectedId(r.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={isSel ? r.r + 3 : r.r}
                  fill={r.color}
                  fillOpacity={isSel ? 0.34 : 0.16}
                  stroke={r.color}
                  strokeWidth={isSel ? 2.6 : 1.4}
                />
                <text
                  x={r.cx}
                  y={r.cy - 2}
                  textAnchor="middle"
                  fill="#eef2ff"
                  fontSize="9.5"
                  fontWeight="600"
                >
                  {r.id === 'prefrontal'
                    ? 'Logic'
                    : r.id === 'parietal'
                    ? 'Pattern'
                    : r.id === 'hippocampus'
                    ? 'Memory'
                    : r.id === 'cingulate'
                    ? 'Focus'
                    : r.id === 'amygdala'
                    ? 'Calm'
                    : 'Social'}
                </text>
                <text
                  x={r.cx}
                  y={r.cy + 10}
                  textAnchor="middle"
                  fill={r.color}
                  fontSize="8.5"
                  fontWeight="700"
                >
                  {latestProfile ? `${val}%` : '—'}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Active Region Detail */}
        <div className="brain-detail" style={{ borderColor: active.color }}>
          <div className="brain-detail-top">
            <div>
              <div className="brain-region-name" style={{ color: active.color }}>
                {active.name}
              </div>
              <div className="brain-region-hi">{active.hiName}</div>
            </div>
            <div className="brain-score-pill" style={{ borderColor: active.color, color: active.color }}>
              {latestProfile ? `${scores[active.scoreKey]} / 100` : 'Not tested'}
            </div>
          </div>
          <div className="brain-role">{active.role}</div>
          <p className="brain-desc">{active.detail}</p>
          <div className="brain-chips">
            {active.signals.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* All 6 Measurement Bars */}
      <div className="brain-meters">
        <div className="sec-title">
          Cognitive & Brain Levels {latestProfile ? `· ${latestProfile.archetype}` : '(Default — X-Ray test se measure karo)'}
        </div>
        {REGIONS.map((r) => {
          const v = scores[r.scoreKey];
          return (
            <div
              key={r.id}
              className={`meter-row ${r.id === active.id ? 'sel' : ''}`}
              onClick={() => setSelectedId(r.id)}
            >
              <div className="meter-label">
                <span>{r.name.split('(')[0].trim()}</span>
                <span style={{ color: r.color }}>{latestProfile ? `${v}%` : '—'}</span>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{ width: `${latestProfile ? v : 18}%`, background: r.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
