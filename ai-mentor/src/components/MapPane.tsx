import { useEffect, useMemo, useRef, useState } from 'react';
import { MindProfile, MindScores } from '../types';

interface Props {
  latestProfile: MindProfile | null;
  onGoMind: () => void;
}

export interface BrainPartSpec {
  id: string;
  name: string;
  hiName: string;
  layer: 'cortex' | 'deep' | 'hind';
  scoreKey?: keyof MindScores;
  color: string;
  location: string;
  role: string;
  anatomy: string;
  functions: string[];
  damageEffect: string;
  /** 3D explode direction vector */
  explodeVec: [number, number, number];
  /** 3D label anchor */
  anchor: [number, number, number];
}

export const BRAIN_PARTS: BrainPartSpec[] = [
  {
    id: 'frontal',
    name: 'Frontal Lobe & Prefrontal Cortex',
    hiName: 'तर्क, निर्णय, योजना और आत्म-नियंत्रण',
    layer: 'cortex',
    scoreKey: 'logic',
    color: '#5ea1ff',
    location: 'Brain ke sabse aage (maathe ke peeche), Left + Right hemispheres',
    role: 'Executive Reasoning · Planning · Decision Making · Impulse Control · Broca Speech',
    anatomy:
      'Insani dimag ka sabse bada lobe (~35% cortex). Iske aage ka hissa Prefrontal Cortex kehlata hai jahan گہरी gyri/sulci folds hoti hain.',
    functions: [
      'Logical reasoning aur step-by-step problem solving',
      'Future planning aur pros/cons compare karna',
      'Impulse control (galat reaction rokna)',
      'Working memory aur bolne ki bhasha (Broca area)',
    ],
    damageEffect: 'Focus tootna, bina soche faisle lena, planning me dikkat.',
    explodeVec: [-0.85, 0.35, 0.55],
    anchor: [-0.58, 0.28, 0.36],
  },
  {
    id: 'parietal',
    name: 'Parietal Lobe & Somatosensory Cortex',
    hiName: 'पैटर्न पहचान, स्पेस मैप और स्पर्श',
    layer: 'cortex',
    scoreKey: 'pattern',
    color: '#a678ff',
    location: 'Frontal lobe ke peeche, dimag ke upari-beech hisse me',
    role: 'Pattern Recognition · 3D Spatial Map · Number/Math Sense · Touch Integration',
    anatomy:
      'Central sulcus ke theek peeche Postcentral Gyrus (touch map) aur Superior/Inferior Parietal Lobules hote hain.',
    functions: [
      'Alag-alag cheezon me chhupa pattern aur structure pakadna',
      '3D space, direction aur mental rotation samajhna',
      'Numbers, calculation aur geometry processing',
      'Skin se aane wale touch, pressure aur pain signals jodna',
    ],
    damageEffect: 'Direction bhoolna, math/pattern samajhne me rukawat, left-right confusion.',
    explodeVec: [0.25, 0.85, 0.55],
    anchor: [0.22, 0.55, 0.36],
  },
  {
    id: 'temporal',
    name: 'Temporal Lobe & Wernicke Area',
    hiName: 'भाषा की समझ, सुनना और अर्थपूर्ण याददाश्त',
    layer: 'cortex',
    scoreKey: 'memory',
    color: '#3ddc97',
    location: 'Dono kaano ke theek upar-andar (Left aur Right sides pe)',
    role: 'Language Meaning · Auditory Processing · Face/Object Recognition · Semantic Memory',
    anatomy:
      'Lateral fissure (Sylvian fissure) ke neeche sthit lobe; andar ki taraf Hippocampus aur Amygdala se juda rehta hai.',
    functions: [
      'Suni aur padhi hui bhasha ka asli arth (meaning) nikalna',
      'Awaaz, music aur chehre (fusiform gyrus) pehchanna',
      'Facts aur concepts ki long-term semantic memory rakhna',
    ],
    damageEffect: 'Shabd sunai dena par unka matlab samajh na aana (Wernicke aphasia).',
    explodeVec: [-0.15, -0.35, 0.95],
    anchor: [-0.08, -0.18, 0.58],
  },
  {
    id: 'occipital',
    name: 'Occipital Lobe (Visual Cortex V1–V5)',
    hiName: 'दृष्टि, रंग, आकार और विज़ुअल इमेजिनेशन',
    layer: 'cortex',
    color: '#38bdf8',
    location: 'Dimag ke sabse pichhle hisse me (sar ke peeche)',
    role: 'Vision Decoding · Color & Motion · Shape Recognition · Mental Imagery',
    anatomy:
      'Primary Visual Cortex (V1) calcarine sulcus ke aas-paas hota hai jo retina se optic nerve/thalamus ke zariye judta hai.',
    functions: [
      'Aankhon se aane wale light signals ko 3D tasveer me badalna',
      'Rang, edge, depth aur motion track karna',
      'Aankh band karke dimag me diagram ya scene imagine karna',
    ],
    damageEffect: 'Aankhein sahi hone pe bhi visual blind spots ya shapes na pehchanna.',
    explodeVec: [0.95, 0.15, 0.35],
    anchor: [0.72, 0.08, 0.25],
  },
  {
    id: 'cerebellum',
    name: 'Cerebellum (Hindbrain)',
    hiName: 'संतुलन, मोटर टाइमिंग और मसल मेमोरी',
    layer: 'hind',
    color: '#f59e0b',
    location: 'Occipital lobe ke neeche aur Brainstem ke peeche',
    role: 'Balance & Posture · Fine Motor Coordination · Timing · Procedural Skill Memory',
    anatomy:
      'Barik parallel grooves (folia) wala hissa — size me brain ka ~10% par poore brain ke 50% se zyada neurons yahin hote hain!',
    functions: [
      'Chalne, daudne aur haath-pair ka perfect balance banana',
      'Typing, cycling, gaming jaise fast motor skills automatic karna',
      'Thought aur speech ki millisecond timing smooth rakhna',
    ],
    damageEffect: 'Haath kaampna, balance bigadna, fast movements me galti.',
    explodeVec: [0.85, -0.75, 0.25],
    anchor: [0.56, -0.52, 0.2],
  },
  {
    id: 'brainstem',
    name: 'Brainstem (Midbrain · Pons · Medulla)',
    hiName: 'साँस, धड़कन, नींद और जीवन-रक्षा',
    layer: 'hind',
    color: '#94a3b8',
    location: 'Brain ke base pe jo neeche Spinal Cord se judta hai',
    role: 'Breathing & Heartbeat · Sleep-Wake Alertness · Autonomic Survival · Nerve Highway',
    anatomy:
      'Teen hisson ka stambh: upar Midbrain, beech me fula hua Pons, aur neeche Medulla Oblongata.',
    functions: [
      'Bina soche 24x7 saans aur dil ki dhadkan chalana',
      'Reticular Activating System (RAS) se dimag ko jagana / alertness dena',
      'Brain aur poore shareer ke beech har signal ka main cable',
    ],
    damageEffect: 'Vital survival functions aur consciousness pe seedha asar.',
    explodeVec: [0.15, -0.95, 0.0],
    anchor: [0.1, -0.72, 0.0],
  },
  {
    id: 'corpus_callosum',
    name: 'Corpus Callosum',
    hiName: 'लेफ्ट और राइट ब्रेन को जोड़ने वाला महासेतु',
    layer: 'deep',
    color: '#e879f9',
    location: 'Dono hemispheres ke beechों-beech C-shape nerve bridge',
    role: 'Inter-Hemispheric High-Speed Bridge (200 Million+ Axons)',
    anatomy:
      'White matter (myelinated nerve fibers) ka sabse bada C-aakar ka pul: Rostrum, Genu, Body aur Splenium.',
    functions: [
      'Left brain (logic/speech) aur Right brain (visual/spatial) ko real-time sync karna',
      'Dono aankhon aur dono haathon ke kaam me talmel bithana',
    ],
    damageEffect: 'Split-brain effect — ek haath/aankh ki jankari dusre hemisphere tak na pahunchna.',
    explodeVec: [0.0, 0.55, 0.0],
    anchor: [0.0, 0.22, 0.0],
  },
  {
    id: 'cingulate',
    name: 'Anterior Cingulate Cortex (ACC)',
    hiName: 'फोकस लॉक, गलती पकड़ना और ध्यान नियंत्रण',
    layer: 'deep',
    scoreKey: 'focus',
    color: '#facc15',
    location: 'Corpus Callosum ke theek upar collar ki tarah lipta hua',
    role: 'Deep Focus Lock · Error Detection · Conflict Monitoring · Cognitive Effort',
    anatomy:
      'Prefrontal logic (upar) aur Limbic emotion (neeche) ke beech ka direct neural ring.',
    functions: [
      'Attention ko ek task pe lock karke distractions filter karna',
      'Koi galti ya contradiction hote hi turant alarm dena',
      'Mushkil task me mental effort banaye rakhna',
    ],
    damageEffect: 'Dhyan bhatakna, task adhura chhodna, indecision.',
    explodeVec: [-0.35, 0.55, 0.0],
    anchor: [-0.22, 0.32, 0.0],
  },
  {
    id: 'thalamus',
    name: 'Thalamus (Central Relay Station)',
    hiName: 'इंद्रियों के सिग्नल सही हिस्से तक पहुँचाने वाला राउटर',
    layer: 'deep',
    color: '#2dd4bf',
    location: 'Brain ke bilkul center me (Brainstem ke theek upar, dono taraf egg-shape)',
    role: 'Sensory Router · Consciousness Gatekeeper · Motor Relay',
    anatomy:
      'Do akhrot/egg aakar ke grey-matter nuclei jo 3rd ventricle ke dono taraf baithe hote hain.',
    functions: [
      'Aankh, kaan, skin aur taste ke 98% signals ko sahi cortex lobe me route karna',
      'Neend me sensory gate band karna aur jaagne pe kholna',
      'Cortex aur Cerebellum/Basal Ganglia ke beech loop chalana',
    ],
    damageEffect: 'Sensory overload ya signals ka cortex tak na pahunchna.',
    explodeVec: [0.0, 0.1, -0.45],
    anchor: [0.02, 0.02, 0.0],
  },
  {
    id: 'hypothalamus',
    name: 'Hypothalamus & Pituitary Gland',
    hiName: 'भूख, प्यास, तापमान और हार्मोन कंट्रोल',
    layer: 'deep',
    color: '#fb923c',
    location: 'Thalamus ke theek neeche (badam ke barabar par behad shaktishali)',
    role: 'Homeostasis · Hunger/Thirst · Body Temp · Hormones & Stress Axis (HPA)',
    anatomy:
      'Chhota sa cluster jo Pituitary gland (master hormone gland) ko सीधा command deta hai.',
    functions: [
      'Bhookh, pyaas, thakan aur shareer ka 37°C temperature maintain karna',
      '24-hour biological clock (circadian rhythm) chalana',
      'Dopamine/oxytocin/cortisol hormones ke zariye drive aur stress control karna',
    ],
    damageEffect: 'Neend, bhookh, energy aur hormone balance bigadna.',
    explodeVec: [-0.28, -0.35, 0.0],
    anchor: [-0.16, -0.18, 0.0],
  },
  {
    id: 'hippocampus',
    name: 'Hippocampus',
    hiName: 'नई यादें सेव करने और मैप बनाने वाला इंजन',
    layer: 'deep',
    scoreKey: 'memory',
    color: '#34d399',
    location: 'Temporal lobe ke andar gahrai me (seahorse aakar ki C-structure)',
    role: 'Short-to-Long Term Memory Consolidation · Spatial GPS · Context Linking',
    anatomy:
      'Seahorse (समुद्री घोड़े) jaisa curved structure jahan adult brain me naye neurons (neurogenesis) bante hain.',
    functions: [
      'Aaj jo seekha usko permanent long-term memory me encode karna',
      'Nayi jankari ko purane concepts se jodna (meaning-based memory)',
      'Mental map aur jagahon ka rasta yaad rakhna (Place cells)',
    ],
    damageEffect: 'Nayi baatein 5 minute me bhool jana (purani yaadein rehti hain par nayi save nahi hoti).',
    explodeVec: [0.22, -0.25, 0.55],
    anchor: [0.14, -0.16, 0.24],
  },
  {
    id: 'amygdala',
    name: 'Amygdala',
    hiName: 'डर, गुस्सा, खतरा पहचान और इमोशनल अलार्म',
    layer: 'deep',
    scoreKey: 'calm',
    color: '#f87171',
    location: 'Hippocampus ke bilkul aage-nok pe (almond/badam aakar)',
    role: 'Threat Radar · Fear & Anger · Fight-or-Flight · Emotional Memory Tagging',
    anatomy:
      'Dono Temporal lobes ke andar badam-akar ka nuclei cluster jo Prefrontal aur Hypothalamus se juda hai.',
    functions: [
      'Khatra, insult ya stress ko 20 milliseconds me pehchanna',
      'Fear, anger ya excitement ka instant alarm bajana',
      'Jis ghatna me strong emotion ho us memory ko गहराई se mark karna',
    ],
    damageEffect: 'Overactive hone pe anxiety/gussa (Amygdala hijack); calm रहने pe Prefrontal logic jeetta hai.',
    explodeVec: [-0.32, -0.28, 0.55],
    anchor: [-0.2, -0.18, 0.24],
  },
  {
    id: 'basal_ganglia',
    name: 'Basal Ganglia (Striatum · Putamen · Caudate)',
    hiName: 'आदतें (Habits), ऑटोपायलट एक्शन और डोपामाइन रिवॉर्ड',
    layer: 'deep',
     scoreKey: 'social',
    color: '#f472b6',
    location: 'Thalamus ke charon taraf lipta hua deep subcortical network',
    role: 'Habit Loop · Action Selection · Automatic Routines · Dopamine Motivation',
    anatomy:
      'Caudate nucleus, Putamen, Globus Pallidus aur Substantia Nigra ka interconnected loop.',
    functions: [
      'Baar-baar kiye kaam ko "Habit" (autopilot) me badalna taaki Prefrontal load bache',
      'Kaunsa action shuru karna hai aur kaunsa rokna hai',
      'Reward milne pe dopamine signal se motivation badhana',
    ],
    damageEffect: 'Aadatein banane ya action start/stop karne me dikkat.',
    explodeVec: [-0.1, 0.15, 0.65],
    anchor: [-0.08, 0.08, 0.28],
  },
];

interface Tri3D {
  partId: string;
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  norm: [number, number, number];
  color: string;
  layer: 'cortex' | 'deep' | 'hind';
  sulcus: number; // 0..1 surface fold shading
}

function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normVec(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Organic cortical gyri/sulci wrinkle displacement */
function gyriNoise(x: number, y: number, z: number, freq = 13): { disp: number; crease: number } {
  const w =
    Math.sin(x * freq + Math.cos(y * (freq * 0.9))) *
      Math.cos(z * freq + Math.sin(x * (freq * 0.8))) +
    0.5 * Math.sin((x + y - z) * (freq * 1.4));
  const crease = Math.max(0, -w); // sulci grooves
  return { disp: w * 0.028, crease: Math.min(1, crease * 0.65) };
}

/** Generate an organic 3D anatomical lobe/organ ellipsoid or curved tube mesh */
function buildEllipsoidPart(
  partId: string,
  color: string,
  layer: 'cortex' | 'deep' | 'hind',
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  uSteps: number,
  vSteps: number,
  wrinkleFreq: number,
  mirrorZ = true,
): Tri3D[] {
  const out: Tri3D[] = [];
  const sides = mirrorZ ? [1, -1] : [1];

  for (const s of sides) {
    const grid: { pt: [number, number, number]; crease: number }[][] = [];
    for (let i = 0; i <= uSteps; i++) {
      const u = (i / uSteps) * Math.PI;
      const row: { pt: [number, number, number]; crease: number }[] = [];
      for (let j = 0; j <= vSteps; j++) {
        const v = (j / vSteps) * Math.PI * 2;
        let nx = Math.sin(u) * Math.cos(v);
        let ny = Math.cos(u);
        let nz = Math.sin(u) * Math.sin(v);
        // Flatten medial inner wall where left & right hemispheres meet
        if (mirrorZ && nz * s < -0.15) {
          nz = -0.15 * s + (nz + 0.15 * s) * 0.25;
        }
        let px = cx + nx * rx;
        let py = cy + ny * ry;
        let pz = (cz + nz * rz) * s;

        let crease = 0;
        if (wrinkleFreq > 0) {
          const g = gyriNoise(px, py, pz, wrinkleFreq);
          px += nx * g.disp;
          py += ny * g.disp;
          pz += nz * g.disp;
          crease = g.crease;
        }
        row.push({ pt: [px, py, pz], crease });
      }
      grid.push(row);
    }

    for (let i = 0; i < uSteps; i++) {
      for (let j = 0; j < vSteps; j++) {
        const a = grid[i][j];
        const b = grid[i + 1][j];
        const c = grid[i + 1][j + 1];
        const d = grid[i][j + 1];
        const n1 = normVec(cross(sub(b.pt, a.pt), sub(c.pt, a.pt)));
        const n2 = normVec(cross(sub(c.pt, a.pt), sub(d.pt, a.pt)));
        out.push({
          partId,
          v0: a.pt,
          v1: b.pt,
          v2: c.pt,
          norm: s < 0 ? [-n1[0], -n1[1], -n1[2]] : n1,
          color,
          layer,
          sulcus: (a.crease + b.crease + c.crease) / 3,
        });
        out.push({
          partId,
          v0: a.pt,
          v1: c.pt,
          v2: d.pt,
          norm: s < 0 ? [-n2[0], -n2[1], -n2[2]] : n2,
          color,
          layer,
          sulcus: (a.crease + c.crease + d.crease) / 3,
        });
      }
    }
  }
  return out;
}

/** Generate a curved C-arch 3D tube (for Corpus Callosum, Hippocampus, Cingulate, Striatum) */
function buildCurvedArchPart(
  partId: string,
  color: string,
  layer: 'cortex' | 'deep' | 'hind',
  arcFn: (t: number) => [number, number, number, number], // [x,y,z,radius]
  tSteps: number,
  rSteps: number,
  mirrorZ: boolean,
): Tri3D[] {
  const out: Tri3D[] = [];
  const sides = mirrorZ ? [1, -1] : [1];

  for (const s of sides) {
    const rings: [number, number, number][][] = [];
    for (let i = 0; i <= tSteps; i++) {
      const t = i / tSteps;
      const [cx, cy, cz, rad] = arcFn(t);
      const tNext = Math.min(1, t + 0.02);
      const [nx, ny] = arcFn(tNext);
      const tx = nx - cx;
      const ty = ny - cy;
      const len = Math.hypot(tx, ty) || 1;
      const px = -ty / len;
      const py = tx / len;

      const ring: [number, number, number][] = [];
      for (let j = 0; j <= rSteps; j++) {
        const ang = (j / rSteps) * Math.PI * 2;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        ring.push([
          cx + px * cos * rad,
          cy + py * cos * rad,
          (cz + sin * rad * 0.9) * s,
        ]);
      }
      rings.push(ring);
    }

    for (let i = 0; i < tSteps; i++) {
      for (let j = 0; j < rSteps; j++) {
        const a = rings[i][j];
        const b = rings[i + 1][j];
        const c = rings[i + 1][j + 1];
        const d = rings[i][j + 1];
        const n1 = normVec(cross(sub(b, a), sub(c, a)));
        const n2 = normVec(cross(sub(c, a), sub(d, a)));
        out.push({ partId, v0: a, v1: b, v2: c, norm: n1, color, layer, sulcus: 0.1 });
        out.push({ partId, v0: a, v1: c, v2: d, norm: n2, color, layer, sulcus: 0.1 });
      }
    }
  }
  return out;
}

function buildCompleteBrainMesh(): Tri3D[] {
  const tris: Tri3D[] = [];

  // 1. Frontal Lobe (anterior large folded hemisphere)
  tris.push(
    ...buildEllipsoidPart('frontal', '#5ea1ff', 'cortex', -0.46, 0.22, 0.34, 0.48, 0.44, 0.34, 12, 16, 15, true),
  );
  // 2. Parietal Lobe (superior-posterior folded hemisphere)
  tris.push(
    ...buildEllipsoidPart('parietal', '#a678ff', 'cortex', 0.22, 0.42, 0.34, 0.42, 0.36, 0.33, 11, 14, 15, true),
  );
  // 3. Temporal Lobe (lateral inferior lobe)
  tris.push(
    ...buildEllipsoidPart('temporal', '#3ddc97', 'cortex', -0.05, -0.16, 0.48, 0.46, 0.24, 0.22, 10, 14, 14, true),
  );
  // 4. Occipital Lobe (posterior visual pole)
  tris.push(
    ...buildEllipsoidPart('occipital', '#38bdf8', 'cortex', 0.68, 0.08, 0.26, 0.28, 0.28, 0.25, 10, 12, 16, true),
  );
  // 5. Cerebellum (hindbrain with fine folia ridges)
  tris.push(
    ...buildEllipsoidPart('cerebellum', '#f59e0b', 'hind', 0.52, -0.46, 0.24, 0.28, 0.22, 0.24, 10, 14, 28, true),
  );
  // 6. Brainstem (central pillar: midbrain + pons bulge + medulla)
  tris.push(
    ...buildCurvedArchPart(
      'brainstem',
      '#94a3b8',
      'hind',
      (t) => {
        const x = 0.02 + t * 0.16;
        const y = -0.18 - t * 0.72;
        const ponsBulge = Math.exp(-Math.pow((t - 0.35) * 4, 2)) * 0.06;
        return [x - ponsBulge * 0.5, y, 0, 0.13 + ponsBulge - t * 0.03];
      },
      10,
      12,
      false,
    ),
  );
  // 7. Corpus Callosum (central C-shaped white matter bridge)
  tris.push(
    ...buildCurvedArchPart(
      'corpus_callosum',
      '#e879f9',
      'deep',
      (t) => {
        const ang = Math.PI * 0.88 - t * Math.PI * 0.95;
        return [-0.04 + Math.cos(ang) * 0.34, 0.04 + Math.sin(ang) * 0.22, 0, 0.065];
      },
      12,
      10,
      false,
    ),
  );
  // 8. Anterior Cingulate Cortex (collar arch above corpus callosum)
  tris.push(
    ...buildCurvedArchPart(
      'cingulate',
      '#facc15',
      'deep',
      (t) => {
        const ang = Math.PI * 0.92 - t * Math.PI * 0.72;
        return [-0.05 + Math.cos(ang) * 0.44, 0.06 + Math.sin(ang) * 0.31, 0, 0.055];
      },
      10,
      10,
      false,
    ),
  );
  // 9. Thalamus (dual central relay eggs)
  tris.push(
    ...buildEllipsoidPart('thalamus', '#2dd4bf', 'deep', 0.02, 0.02, 0.1, 0.16, 0.12, 0.09, 8, 10, 0, true),
  );
  // 10. Hypothalamus & Pituitary (below anterior thalamus)
  tris.push(
    ...buildEllipsoidPart('hypothalamus', '#fb923c', 'deep', -0.16, -0.16, 0.0, 0.09, 0.1, 0.08, 7, 9, 0, false),
  );
  // 11. Hippocampus (bilateral seahorse C-curves in medial temporal)
  tris.push(
    ...buildCurvedArchPart(
      'hippocampus',
      '#34d399',
      'deep',
      (t) => {
        const ang = -Math.PI * 0.65 + t * Math.PI * 1.1;
        return [0.06 + Math.cos(ang) * 0.22, -0.08 + Math.sin(ang) * 0.18, 0.22, 0.048];
      },
      11,
      9,
      true,
    ),
  );
  // 12. Amygdala (almond nuclei at anterior tip of hippocampus)
  tris.push(
    ...buildEllipsoidPart('amygdala', '#f87171', 'deep', -0.2, -0.18, 0.22, 0.075, 0.065, 0.065, 7, 9, 0, true),
  );
  // 13. Basal Ganglia / Striatum (arched loop outside thalamus)
  tris.push(
    ...buildCurvedArchPart(
      'basal_ganglia',
      '#f472b6',
      'deep',
      (t) => {
        const ang = Math.PI * 0.85 - t * Math.PI * 1.25;
        return [-0.04 + Math.cos(ang) * 0.26, 0.02 + Math.sin(ang) * 0.22, 0.22, 0.052];
      },
      11,
      9,
      true,
    ),
  );

  return tris;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const DEFAULT_SCORES: MindScores = {
  logic: 50,
  pattern: 50,
  memory: 50,
  focus: 50,
  calm: 50,
  social: 50,
};

export function MapPane({ latestProfile, onGoMind }: Props) {
  const [selectedId, setSelectedId] = useState<string>('frontal');
  // 3D camera & bio-lab dissection state
  const [yaw, setYaw] = useState<number>(-0.45);
  const [pitch, setPitch] = useState<number>(0.22);
  const [zoom, setZoom] = useState<number>(1.08);
  const [explode, setExplode] = useState<number>(0.28); // default slightly open so internal parts peek through
  const [viewMode, setViewMode] = useState<'all' | 'xray' | 'deep' | 'solo'>('xray');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    pinchDist: number;
  }>({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false, pinchDist: 0 });

  // Screen-space projected part centers for tap hit-testing
  const hitCentersRef = useRef<{ id: string; x: number; y: number; z: number }[]>([]);

  const mesh = useMemo(() => buildCompleteBrainMesh(), []);
  const partMap = useMemo(() => new Map(BRAIN_PARTS.map((p) => [p.id, p])), []);
  const active = partMap.get(selectedId) ?? BRAIN_PARTS[0];
  const scores = latestProfile?.scores ?? DEFAULT_SCORES;

  // Render 3D scene onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(280, Math.floor(rect.width));
    const H = Math.max(260, Math.floor(rect.height));
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background lab grid glow
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.48, 10, W * 0.5, H * 0.5, W * 0.65);
    bgGrad.addColorStop(0, '#162038');
    bgGrad.addColorStop(1, '#0b0e17');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const scale = Math.min(W, H) * 0.42 * zoom;
    const cx = W * 0.5;
    const cy = H * 0.52;
    const fov = 3.2;

    const project = (pt: [number, number, number]): [number, number, number] => {
      // Rotate Y (yaw)
      const x1 = pt[0] * cosY + pt[2] * sinY;
      const z1 = -pt[0] * sinY + pt[2] * cosY;
      // Rotate X (pitch)
      const y2 = pt[1] * cosP - z1 * sinP;
      const z2 = pt[1] * sinP + z1 * cosP;
      const persp = fov / (fov + z2 + 1.4);
      return [cx + x1 * scale * persp, cy - y2 * scale * persp, z2];
    };

    const rotNorm = (n: [number, number, number]): [number, number, number] => {
      const x1 = n[0] * cosY + n[2] * sinY;
      const z1 = -n[0] * sinY + n[2] * cosY;
      const y2 = n[1] * cosP - z1 * sinP;
      const z2 = n[1] * sinP + z1 * cosP;
      return [x1, y2, z2];
    };

    interface DrawTri {
      p0: [number, number, number];
      p1: [number, number, number];
      p2: [number, number, number];
      z: number;
      fill: string;
      stroke: string;
      alpha: number;
    }

    const drawList: DrawTri[] = [];
    const lightDir: [number, number, number] = normVec([-0.45, 0.65, -0.6]);

    for (const t of mesh) {
      if (viewMode === 'deep' && t.layer === 'cortex') continue;
      if (viewMode === 'solo' && t.partId !== selectedId) continue;

      const spec = partMap.get(t.partId);
      const ev = spec?.explodeVec ?? [0, 0, 0];
      const isSel = t.partId === selectedId;

      // Explode offset + extra pull-out when a part is selected
      let pull = explode * 0.55;
      if (isSel && viewMode !== 'solo') {
        pull += 0.22; // Pull selected part outward like a bio-lab model!
      }
      const offX = ev[0] * pull;
      const offY = ev[1] * pull;
      const offZ = ev[2] * pull * (t.v0[2] < 0 ? -1 : 1);

      const v0: [number, number, number] = [t.v0[0] + offX, t.v0[1] + offY, t.v0[2] + offZ];
      const v1: [number, number, number] = [t.v1[0] + offX, t.v1[1] + offY, t.v1[2] + offZ];
      const v2: [number, number, number] = [t.v2[0] + offX, t.v2[1] + offY, t.v2[2] + offZ];

      const p0 = project(v0);
      const p1 = project(v1);
      const p2 = project(v2);

      const rn = rotNorm(t.norm);
      const diff = Math.max(0, rn[0] * lightDir[0] + rn[1] * lightDir[1] + rn[2] * lightDir[2]);
      const rim = Math.pow(1 - Math.abs(rn[2]), 2) * 0.25;
      const sulcusShade = 1 - t.sulcus * 0.38;
      const bright = (0.36 + diff * 0.64 + rim) * sulcusShade * (isSel ? 1.18 : 0.92);

      const [r, g, b] = hexToRgb(t.color);
      const rr = Math.min(255, Math.round(r * bright));
      const gg = Math.min(255, Math.round(g * bright));
      const bb = Math.min(255, Math.round(b * bright));

      let alpha = 0.95;
      if (viewMode === 'xray' && t.layer === 'cortex' && !isSel) {
        alpha = 0.26; // Translucent X-Ray glass cortex so deep organs shine through!
      } else if (!isSel && viewMode === 'all') {
        alpha = 0.84;
      }

      drawList.push({
        p0,
        p1,
        p2,
        z: (p0[2] + p1[2] + p2[2]) / 3,
        fill: `rgb(${rr},${gg},${bb})`,
        stroke: isSel ? 'rgba(255,255,255,0.28)' : `rgba(${rr},${gg},${bb},0.35)`,
        alpha,
      });
    }

    // Painter's algorithm (back-to-front depth sort)
    drawList.sort((a, b) => b.z - a.z);

    for (const d of drawList) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.moveTo(d.p0[0], d.p0[1]);
      ctx.lineTo(d.p1[0], d.p1[1]);
      ctx.lineTo(d.p2[0], d.p2[1]);
      ctx.closePath();
      ctx.fillStyle = d.fill;
      ctx.fill();
      ctx.strokeStyle = d.stroke;
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }

    // Draw interactive 3D anatomical pins / labels
    ctx.globalAlpha = 1;
    const hits: { id: string; x: number; y: number; z: number }[] = [];
    for (const part of BRAIN_PARTS) {
      if (viewMode === 'deep' && part.layer === 'cortex') continue;
      if (viewMode === 'solo' && part.id !== selectedId) continue;

      const isSel = part.id === selectedId;
      let pull = explode * 0.55;
      if (isSel && viewMode !== 'solo') pull += 0.22;

      const pt: [number, number, number] = [
        part.anchor[0] + part.explodeVec[0] * pull,
        part.anchor[1] + part.explodeVec[1] * pull,
        part.anchor[2] + part.explodeVec[2] * pull,
      ];
      const [sx, sy, sz] = project(pt);
      hits.push({ id: part.id, x: sx, y: sy, z: sz });

      // Glowing node pin
      ctx.beginPath();
      ctx.arc(sx, sy, isSel ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#ffffff' : part.color;
      ctx.fill();
      ctx.lineWidth = isSel ? 2.5 : 1.2;
      ctx.strokeStyle = isSel ? part.color : '#0b0e17';
      ctx.stroke();

      // Label pill for selected or visible parts
      if (isSel || zoom >= 1.15 || explode >= 0.35) {
        const shortName = part.name.split(/[(&]/)[0].trim();
        ctx.font = `${isSel ? '700 11.5px' : '600 10px'} -apple-system, Inter, sans-serif`;
        const tw = ctx.measureText(shortName).width;
        const px = sx - tw / 2 - 6;
        const py = sy - (isSel ? 24 : 20);
        ctx.fillStyle = isSel ? 'rgba(14, 21, 38, 0.92)' : 'rgba(11, 14, 23, 0.75)';
        ctx.strokeStyle = isSel ? part.color : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = isSel ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.roundRect(px, py, tw + 12, 16, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isSel ? '#ffffff' : '#d6e0ff';
        ctx.fillText(shortName, px + 6, py + 11.5);
      }
    }
    hitCentersRef.current = hits;
    ctx.restore();
  }, [mesh, partMap, selectedId, yaw, pitch, zoom, explode, viewMode]);

  const handlePointerTap = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: { id: string; dist: number } | null = null;
    for (const h of hitCentersRef.current) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < 36 && (!best || d < best.dist)) {
        best = { id: h.id, dist: d };
      }
    }
    if (best) setSelectedId(best.id);
  };

  return (
    <div className="pane map-pane">
      {/* 3D Interactive Bio-Lab Brain Card */}
      <div className="brain-card">
        <div className="brain-header">
          <div>
            <div className="brain-title">3D Human Brain Bio-Lab (13 Parts)</div>
            <div className="brain-sub">
              Ungli se 360° ghumao · Zoom karo · Parts ko bahar nikal (Explode/Solo) ke dekho
            </div>
          </div>
          <button className="btn sm primary" onClick={onGoMind}>
            ⚡ Mind X-Ray
          </button>
        </div>

        {/* View Mode Selector: X-Ray Glass / All / Deep Only / Solo Part Dissect */}
        <div className="lab-toolbar">
          <button
            className={`chip-btn ${viewMode === 'xray' ? 'active-chip' : ''}`}
            onClick={() => setViewMode('xray')}
          >
            🔮 X-Ray Glass
          </button>
          <button
            className={`chip-btn ${viewMode === 'all' ? 'active-chip' : ''}`}
            onClick={() => setViewMode('all')}
          >
            🧠 Solid 3D
          </button>
          <button
            className={`chip-btn ${viewMode === 'deep' ? 'active-chip' : ''}`}
            onClick={() => setViewMode('deep')}
          >
            🧬 Deep Inner Core
          </button>
          <button
            className={`chip-btn ${viewMode === 'solo' ? 'active-chip' : ''}`}
            onClick={() => setViewMode((m) => (m === 'solo' ? 'xray' : 'solo'))}
          >
            🔍 {viewMode === 'solo' ? 'Back to Full Brain' : 'Part Bahar Nikalo (Solo)'}
          </button>
        </div>

        {/* 3D Interactive Canvas */}
        <div className="brain-3d-stage">
          <canvas
            ref={canvasRef}
            className="brain-3d-canvas"
            onMouseDown={(e) => {
              dragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                lastX: e.clientX,
                lastY: e.clientY,
                moved: false,
                pinchDist: 0,
              };
            }}
            onMouseMove={(e) => {
              if (!dragRef.current.active) return;
              const dx = e.clientX - dragRef.current.lastX;
              const dy = e.clientY - dragRef.current.lastY;
              if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 5) {
                dragRef.current.moved = true;
              }
              dragRef.current.lastX = e.clientX;
              dragRef.current.lastY = e.clientY;
              setYaw((y) => y + dx * 0.011);
              setPitch((p) => Math.max(-1.2, Math.min(1.2, p + dy * 0.011)));
            }}
            onMouseUp={(e) => {
              if (!dragRef.current.moved) handlePointerTap(e.clientX, e.clientY);
              dragRef.current.active = false;
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const d = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY,
                );
                dragRef.current.pinchDist = d;
              } else if (e.touches.length === 1) {
                const t = e.touches[0];
                dragRef.current = {
                  active: true,
                  startX: t.clientX,
                  startY: t.clientY,
                  lastX: t.clientX,
                  lastY: t.clientY,
                  moved: false,
                  pinchDist: 0,
                };
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && dragRef.current.pinchDist > 0) {
                const d = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY,
                );
                const ratio = d / dragRef.current.pinchDist;
                dragRef.current.pinchDist = d;
                setZoom((z) => Math.max(0.65, Math.min(2.5, z * ratio)));
                dragRef.current.moved = true;
              } else if (e.touches.length === 1 && dragRef.current.active) {
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.lastX;
                const dy = t.clientY - dragRef.current.lastY;
                if (Math.hypot(t.clientX - dragRef.current.startX, t.clientY - dragRef.current.startY) > 6) {
                  dragRef.current.moved = true;
                }
                dragRef.current.lastX = t.clientX;
                dragRef.current.lastY = t.clientY;
                setYaw((y) => y + dx * 0.012);
                setPitch((p) => Math.max(-1.2, Math.min(1.2, p + dy * 0.012)));
              }
            }}
            onTouchEnd={(e) => {
              if (!dragRef.current.moved && e.changedTouches.length === 1) {
                const t = e.changedTouches[0];
                handlePointerTap(t.clientX, t.clientY);
              }
              dragRef.current.active = false;
              dragRef.current.pinchDist = 0;
            }}
          />

          {/* Floating 3D Camera Controls */}
          <div className="brain-3d-overlay">
            <button
              className="cam-btn"
              onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(2)))}
              title="Zoom In"
            >
              ＋
            </button>
            <button
              className="cam-btn"
              onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.2).toFixed(2)))}
              title="Zoom Out"
            >
              －
            </button>
            <button
              className="cam-btn"
              onClick={() => {
                setYaw(-0.45);
                setPitch(0.22);
                setZoom(1.08);
              }}
              title="Reset Angle"
            >
              ⟲
            </button>
          </div>
        </div>

        {/* Bio-Lab Dissection / Explode Slider */}
        <div className="explode-bar">
          <span>🔬 Bio-Lab Dissect (Parts Alag Karo): {Math.round(explode * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(e) => setExplode(Number(e.target.value) / 100)}
          />
        </div>

        {/* All 13 Brain Parts Quick Selector Pills */}
        <div className="parts-strip">
          {BRAIN_PARTS.map((p) => {
            const isSel = p.id === active.id;
            return (
              <button
                key={p.id}
                className={`part-pill ${isSel ? 'sel' : ''}`}
                style={isSel ? { borderColor: p.color, color: p.color } : undefined}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="part-dot" style={{ background: p.color }} />
                {p.name.split(/[(&]/)[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Detailed Bio-Lab Card for Selected Brain Part */}
        <div className="brain-detail" style={{ borderColor: active.color }}>
          <div className="brain-detail-top">
            <div>
              <div className="brain-region-name" style={{ color: active.color }}>
                {active.name}
              </div>
              <div className="brain-region-hi">{active.hiName}</div>
            </div>
            {active.scoreKey && (
              <div
                className="brain-score-pill"
                style={{ borderColor: active.color, color: active.color }}
              >
                {latestProfile ? `Level: ${scores[active.scoreKey]}%` : 'X-Ray Pending'}
              </div>
            )}
          </div>

          <div className="brain-role">{active.role}</div>

          <div className="bio-meta">
            <div>
              <b>📍 Location:</b> {active.location}
            </div>
            <div>
              <b>🧬 Structure:</b> {active.anatomy}
            </div>
          </div>

          <div className="bio-list-title">Is Hisse ke Main Kaam (Functions):</div>
          <ul className="bio-list">
            {active.functions.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>

          <div className="bio-warn">
            <b>⚡ Agar weak ya overload ho:</b> {active.damageEffect}
          </div>
        </div>
      </div>

      {/* Cognitive Measurement Levels */}
      <div className="brain-meters">
        <div className="sec-title">
          Live Cognitive Levels{' '}
          {latestProfile ? `· ${latestProfile.archetype}` : '(Mind X-Ray tab me test/AI se measure karo)'}
        </div>
        {BRAIN_PARTS.filter((p) => p.scoreKey).map((r) => {
          const v = scores[r.scoreKey!];
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
                  style={{ width: `${latestProfile ? v : 22}%`, background: r.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
