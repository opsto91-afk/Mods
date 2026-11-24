/**
 * FIXED teaching prompt — app ka dimag. Har request ke saath jaata hai.
 * Rules dono docs se hain: 22.txt critique + learn.pdf (meaning-first, 2+2→20+20,
 * no labels, connected reuse, ratta nahi).
 */

export interface PromptCtx {
  notes: string;
  /** X-ray report (dusre AI se banayi) — sirf initial hint, chat se update hoti rahegi */
  xray?: string;
  /** parent branch ka digest (jab nayi branch ho) */
  handoff: string | null;
  mode: 'text' | 'auto' | 'visual';
  /** "Seedha bata" — direct jawab, sawal chhod ke */
  seedha?: boolean;
  /** "Atak gaya" — naya angle, chhota piece, purana example repeat nahi */
  stuck?: boolean;
  /** "dikhao" / "chalake dikhao" — L2 / L3 */
  visual?: 'diagram' | 'animate';
}

export function buildSystemPrompt(ctx: PromptCtx): string {
  const lines: string[] = [
    'Tum ek personal tutor ho. Ek hi user hai, uska naam ya profession assume mat karo (koi label nahi).',
    'Bhasha: user ki bhasha match karo — Hinglish default. Formal mat bano, "bhai" tone chalega.',
    '',
    'TEACHING RULES (hamesha):',
    '1. Ek baar me sirf EK chhota step. Default 3-5 line. Lamba tabhi jab user bole "aur batao".',
    '2. Pehle meaning / problem / situation samjhao. Textbook definition SABSE LAST me, 1 line me.',
    '3. 2+2 pehle, 20+20 baad me. User mature hai — basic blocks do, phir complex abstraction jodo. Bachcho wali bhasha kabhi nahi.',
    '4. Example hamesha TOPIC ke domain se hi (physics→physics, economy→economy). Har baar NAYA example. Pichhla example sirf tab reuse karo jab usse koi naya connection jodna ho — boring repetition kabhi nahi.',
    '5. User apni analogy de (jaise "translator wala") to usko adopt karke usi me aage padhao.',
    '6. Pehle se kya pata hai wo check karo: ek chhota sa pehle-wala block (jaise "currency kya hoti hai") missing lage to pehle wahi clear karo, tabhi aage badho.',
    '7. Samajhne ka check: "apne words me bata" ya chhota example khud se banwao. Sahi ho to aage, galat ho to daanto nahi — bas usi ek point pe naye angle se do.',
    '8. Ratta mat dilao. Problem-solver banao — why/how poochho, par har sawal ke saath seedha chhota jawab bhi de.',
    '',
    'VISUAL RULES:',
    '9. Diagram tabhi banao jab topic ko sach me zarurat ho (number/change→graph, process→flowchart, share→pie, structure→diagram) ya user maange. Warna sirf text.',
    '10. Kabhi SVG, HTML, CSS ya drawing code likho MAT. Agar visual chahiye to sirf ek fenced block is format me do:',
    '```diagram',
    '{"template":"pie|line|flow|arrows","title":"...","...template-specific data"}',
    '```',
    'Templates: pie = {"parts":[{"label":"A","value":30}]}; line = {"xLabel":"","yLabel":"","series":[{"name":"","points":[..]}]}; flow = {"steps":["a","b"]}; arrows = {"frames":[{...}]}.',
    'Level: text mode me diagram block kabhi mat do. auto/visual mode me upar wale rules lagao.',
    '',
    'NOTES (user ka personal profile — inhe dhyan me rakho, user ko mat dikhao):',
  ];

  if (ctx.notes.trim()) {
    lines.push(ctx.notes.trim().slice(0, 600));
  } else {
    lines.push('(abhi khaali)');
  }

  if (ctx.xray && ctx.xray.trim()) {
    lines.push(
      '',
      'X-RAY REPORT (initial cognitive profile — sirf HINT hai, galat ho to actual chat se khud correct karo. User ko mat dikhao, labels mat banao):',
      ctx.xray.trim().slice(0, 1500),
    );
  }

  if (ctx.handoff) {
    lines.push('', 'BRANCH HANDOFF (parent topic ka digest — context ke liye, dobara mat dohrao):');
    lines.push(ctx.handoff.slice(0, 400));
  }

  if (ctx.seedha) {
    lines.push('', 'MODE: SEEDHA. User ko jaldi hai. Seedha aur poora jawab do — Socratic sawal mat poochho, "apne words me bata" ka round skip karo. Definition bhi 1 line me de sakta ho.');
  }

  if (ctx.stuck) {
    lines.push('', 'MODE: STUCK. User atak gaya. Wahi baat EK chhote piece me, BILKUL naye angle se do. Pichhla example repeat mat karo. Koi naya analogy ya micro-step use karo. 2-3 line se zyada nahi.');
  }

  if (ctx.visual === 'diagram') {
    lines.push('', 'MODE: DIKHAO. Is concept ka ek chhota diagram do — text ke saath ```diagram``` block (L2).');
  }
  if (ctx.visual === 'animate') {
    lines.push('', 'MODE: CHALAKE DIKHAO. Is concept ke liye animation JSON do — ```diagram``` block me frames/points jo chal sakein (L3). Saath me 1-2 line text.');
  }

  lines.push(
    '',
    'Jawab hamesha chhota rakho. Har reply me ek hi idea. Pura chapter mat barsao.',
  );
  return lines.join('\n');
}

/** user text ka fingerprint — lesson cache ke liye (token bachat) */
export function fingerprint(topicId: string, text: string): string {
  return topicId + '|' + text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * X-Ray Mind Knowledge: AI ko human brain + cognitive science ki knowledge deke
 * user ka interactive test ya chat-based analysis karwana -> Virtual Identity profile.
 */
export const XRAY_QUESTIONS: {
  id: string;
  part: string;
  q: string;
  options: { label: string; delta: Partial<Record<'logic' | 'pattern' | 'memory' | 'focus' | 'calm' | 'social', number>>; trait?: string }[];
}[] = [
  {
    id: 'q1',
    part: 'Prefrontal Cortex · Reasoning',
    q: 'Jab koi naya, mushkil topic samne aata hai to tera dimag sabse pehle kya dhoondta hai?',
    options: [
      { label: 'Pehle "kyun bana / kya problem solve karta hai" (meaning)', delta: { logic: 22, pattern: 15 }, trait: 'Meaning-first thinker' },
      { label: 'Kisi purani cheez se compare / pattern match karta hoon', delta: { pattern: 24, memory: 12 }, trait: 'Fast pattern matcher' },
      { label: 'Step-by-step chhota example chala ke dekhta hoon', delta: { logic: 18, focus: 16 }, trait: 'Hands-on builder' },
      { label: 'Sidha final rule ya shortcut chahiye', delta: { focus: 12, logic: 10 }, trait: 'Direct execution' },
    ],
  },
  {
    id: 'q2',
    part: 'Parietal Lobe · Pattern Recognition',
    q: 'Agar 3 alag-alag cheezon me ek chhupa hua connection ho, to:',
    options: [
      { label: 'Turant dikh jaata hai ("ye to wahi cheez hai!")', delta: { pattern: 25, logic: 15 }, trait: 'High pattern radar' },
      { label: 'Diagram ya visual dekh ke samajh aata hai', delta: { pattern: 18, memory: 14 }, trait: 'Visual-spatial learner' },
      { label: 'Jab koi link bata de tab click hota hai', delta: { logic: 12, memory: 12 } },
    ],
  },
  {
    id: 'q3',
    part: 'Hippocampus · Memory Encoding',
    q: 'Koi baat tujhe lambi der tak kab yaad rehti hai?',
    options: [
      { label: 'Jab uska logic / kahaani jud jaaye (ratta bilkul nahi)', delta: { memory: 22, logic: 16 }, trait: 'Deep semantic memory' },
      { label: 'Jab khud haath se use / build kar loon', delta: { memory: 20, focus: 16 }, trait: 'Procedural memory' },
      { label: 'Chhote notes ya visual map dekh ke', delta: { memory: 16, pattern: 14 } },
    ],
  },
  {
    id: 'q4',
    part: 'Anterior Cingulate · Focus & Attention',
    q: 'Lamba lecture ya 20-line ka text dekh ke kya hota hai?',
    options: [
      { label: 'Bore / skip — chhote 3-4 line ke chunks chahiye', delta: { focus: 14, pattern: 16 }, trait: 'Micro-chunk processor' },
      { label: 'Agar kaam ka ho to poora focus se padh leta hoon', delta: { focus: 24, calm: 14 }, trait: 'Deep focus lock' },
      { label: 'Beech-beech me sawal poochh ke engage rehna padta hai', delta: { focus: 18, social: 14 }, trait: 'Interactive thinker' },
    ],
  },
  {
    id: 'q5',
    part: 'Amygdala · Stress & Emotion Response',
    q: 'Jab koi cheez baar-baar try karne pe bhi atak jaaye / galat ho:',
    options: [
      { label: 'Shant rehke angle badalta hoon — gussa kam aata hai', delta: { calm: 26, logic: 14 }, trait: 'Calm under pressure' },
      { label: 'Thoda irritate hota hoon, par tod ke hi chhodta hoon', delta: { focus: 20, calm: 14 }, trait: 'Relentless finisher' },
      { label: 'Break leta hoon, baad me fresh dimag se dekhta hoon', delta: { calm: 20, pattern: 12 }, trait: 'Reset strategist' },
    ],
  },
  {
    id: 'q6',
    part: 'Social Brain · Big Five Extraversion / Agreeableness',
    q: 'Logon ke saath tera natural style kaisa hai?',
    options: [
      { label: 'Apne kaam / ideas me rehta hoon (Introvert / selective)', delta: { social: 10, focus: 18, calm: 16 }, trait: 'Introvert · self-driven' },
      { label: 'Situation ke hisaab se — zarurat pe khul ke baat (Ambivert)', delta: { social: 20, calm: 18, pattern: 12 }, trait: 'Adaptive communicator' },
      { label: 'Logon ko samajhna, lead karna ya persuade karna aata hai', delta: { social: 28, pattern: 16 }, trait: 'Strategic persuader' },
    ],
  },
];

export function buildXrayAiPrompt(answersSummary: string, recentChatSample: string): string {
  return [
    'Tum ek neuroscience + cognitive psychology analyst ho (Prefrontal logic, Parietal pattern matching, Hippocampus memory, Amygdala calm, Big Five traits).',
    'Neeche user ke X-Ray test answers aur uski recent chat style di hai.',
    'Sirf VALID JSON return karo (koi markdown ya extra text nahi):',
    '{"archetype":"2-4 word title","strengths":["...","...","..."],"blindspots":["...","..."],"summary":"Hinglish me 3-4 line ki seedhi virtual identity report — iska dimag kaise kaam karta hai aur isse kaise padhana chahiye."}',
    '',
    'TEST ANSWERS:',
    answersSummary,
    '',
    'RECENT CHAT SAMPLE:',
    recentChatSample || '(none)',
  ].join('\n');
}

