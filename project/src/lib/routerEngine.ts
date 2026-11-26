export type IntentId =
  | 'coding'
  | 'data'
  | 'creative'
  | 'planning'
  | 'prompt'
  | 'learning'
  | 'reasoning';

export interface RoutingStage {
  label: string;
  detail: string;
  delayMs: number;
}

export interface IntentResult {
  id: IntentId;
  label: string;
  model: string;
  modelColor: string;
  icon: string;
  confidence: number;
  latencyMs: number;
  stages: RoutingStage[];
  outputTitle: string;
  outputSubtitle: string;
  output: OutputBlock[];
}

export type OutputBlock =
  | { kind: 'prose'; text: string }
  | { kind: 'callout'; title: string; text: string }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'list'; title: string; items: { title: string; detail: string }[] }
  | { kind: 'table'; title: string; head: string[]; rows: string[][] }
  | { kind: 'stats'; items: { label: string; value: string }[] };

interface IntentRule {
  id: IntentId;
  keywords: string[];
}

const RULES: IntentRule[] = [
  {
    id: 'coding',
    keywords: ['code', 'bug', 'python', 'javascript', 'typescript', 'function', 'error', 'debug', 'fix', 'refactor', 'api', 'stack trace', 'exception', 'compile', 'deploy', 'docker', 'sql', 'script', 'class', 'undefined', 'crash'],
  },
  {
    id: 'data',
    keywords: ['data', 'search', 'compare', 'statistics', 'research', 'find', 'latest', 'news', 'market', 'benchmark', 'price', 'trend', 'population', 'weather', 'stock'],
  },
  {
    id: 'prompt',
    keywords: ['enhance', 'prompt', 'rewrite my prompt', 'improve this prompt', 'rough prompt', 'better prompt', 'prompt engineering'],
  },
  {
    id: 'learning',
    keywords: ['study', 'learn', 'explain', 'notes', 'exam', 'quiz', 'revision', 'understand', 'teach', 'course', 'summarize', 'summary'],
  },
  {
    id: 'planning',
    keywords: ['plan', 'diet', 'meal', 'workout', 'schedule', 'itinerary', 'trip', 'routine', 'budget', 'roadmap', 'organize', 'week'],
  },
  {
    id: 'creative',
    keywords: ['write', 'story', 'poem', 'slogan', 'brand', 'name ideas', 'tagline', 'copy', 'marketing', 'essay', 'blog'],
  },
  {
    id: 'reasoning',
    keywords: ['math', 'prove', 'algorithm', 'optimize', 'optimization', 'complexity', 'derivation', 'puzzle', 'logic', 'step by step', 'edge case', 'why does', 'how many', 'probability'],
  },
];

function score(text: string, keywords: string[]): number {
  const t = ` ${text.toLowerCase()} `;
  let s = 0;
  for (const k of keywords) {
    if (t.includes(` ${k} `) || t.includes(` ${k}`)) s += k.split(' ').length > 1 ? 3 : 2;
  }
  return s;
}

function fallbackIntent(text: string): IntentId {
  if (/\?$/.test(text.trim())) return 'learning';
  return 'coding';
}

export function detectIntent(text: string): IntentId {
  let best: IntentId = fallbackIntent(text);
  let bestScore = 0;
  for (const rule of RULES) {
    const s = score(text, rule.keywords);
    if (s > bestScore) {
      bestScore = s;
      best = rule.id;
    }
  }
  return best;
}

const CONFIDENCE: Record<IntentId, number> = {
  coding: 98,
  data: 96,
  creative: 94,
  planning: 97,
  prompt: 99,
  learning: 95,
  reasoning: 97,
};

const MODELS: Record<IntentId, { model: string; color: string; icon: string }> = {
  coding: { model: 'Claude 3.5 Logic', color: 'text-amber-700 dark:text-amber-300', icon: 'Code2' },
  data: { model: 'Perplexity Search', color: 'text-teal-700 dark:text-teal-300', icon: 'Search' },
  creative: { model: 'GPT-4o Planner', color: 'text-emerald-700 dark:text-emerald-300', icon: 'Sparkles' },
  planning: { model: 'GPT-4o Planner', color: 'text-emerald-700 dark:text-emerald-300', icon: 'CalendarRange' },
  prompt: { model: 'GPT-4o Planner', color: 'text-emerald-700 dark:text-emerald-300', icon: 'Wand2' },
  learning: { model: 'Gemini Pro Research', color: 'text-sky-700 dark:text-sky-300', icon: 'GraduationCap' },
  reasoning: { model: 'DeepSeek Reasoner', color: 'text-violet-700 dark:text-violet-300', icon: 'Brain' },
};

const LABELS: Record<IntentId, string> = {
  coding: 'Coding Intent',
  data: 'Data / Search Intent',
  creative: 'Creative Writing Intent',
  planning: 'Planning Intent',
  prompt: 'Prompt Enhancement Intent',
  learning: 'Learning Intent',
  reasoning: 'Deep Reasoning Intent',
};

function stages(id: IntentId, text: string): RoutingStage[] {
  const snippet = text.length > 42 ? `${text.slice(0, 42)}…` : text;
  const shared: RoutingStage[] = [
    { label: 'Parsing request', detail: `"${snippet}"`, delayMs: 500 },
    { label: 'Embedding & intent scan', detail: 'Vector match across 5 specialized agents', delayMs: 620 },
  ];
  const per: Record<IntentId, RoutingStage[]> = {
    coding: [
      { label: 'Detected Coding Intent', detail: 'Delegating to Claude 3.5 Logic', delayMs: 560 },
      { label: 'Context injection', detail: 'Stack context + lint rules loaded', delayMs: 480 },
      { label: 'Streaming response', detail: 'Solution assembled and verified', delayMs: 540 },
    ],
    data: [
      { label: 'Detected Data / Search Intent', detail: 'Delegating to Perplexity Search', delayMs: 560 },
      { label: 'Live retrieval', detail: 'Querying indexed knowledge sources', delayMs: 520 },
      { label: 'Synthesis', detail: 'Cross-referencing 4 sources', delayMs: 500 },
    ],
    creative: [
      { label: 'Detected Creative Writing Intent', detail: 'Delegating to GPT-4o Planner', delayMs: 560 },
      { label: 'Tone calibration', detail: 'Audience + voice profile selected', delayMs: 460 },
      { label: 'Drafting', detail: 'Generating variations', delayMs: 520 },
    ],
    planning: [
      { label: 'Detected Planning Intent', detail: 'Delegating to GPT-4o Planner', delayMs: 560 },
      { label: 'Constraint solving', detail: 'Goals, time, and preferences aligned', delayMs: 500 },
      { label: 'Composing schedule', detail: 'Structured plan ready', delayMs: 500 },
    ],
    prompt: [
      { label: 'Detected Prompt Enhancement Intent', detail: 'Delegating to GPT-4o Planner', delayMs: 560 },
      { label: 'Gap analysis', detail: 'Missing context and success criteria identified', delayMs: 480 },
      { label: 'Rewriting', detail: 'Optimized prompt generated', delayMs: 500 },
    ],
    learning: [
      { label: 'Detected Learning Intent', detail: 'Delegating to Gemini Pro Research', delayMs: 560 },
      { label: 'Curriculum mapping', detail: 'Concepts ordered by difficulty', delayMs: 500 },
      { label: 'Formatting notes', detail: 'Study-ready output prepared', delayMs: 480 },
    ],
    reasoning: [
      { label: 'Detected Deep Reasoning Intent', detail: 'Delegating to DeepSeek Reasoner', delayMs: 560 },
      { label: 'Chain-of-thought setup', detail: 'Problem decomposed into verifiable steps', delayMs: 520 },
      { label: 'Edge-case sweep', detail: 'Assumptions tested and solution verified', delayMs: 500 },
    ],
  };
  return [...shared, ...per[id]];
}

const OUTPUTS: Record<IntentId, OutputBlock[]> = {
  coding: [
    {
      kind: 'callout',
      title: 'Bug identified',
      text: 'IndexError: the loop starts at index 1 but iterates past the last element, and the accumulator mutates the list while iterating.',
    },
    {
      kind: 'code',
      lang: 'python',
      code: `def moving_average(values, window):\n    if window <= 0 or window > len(values):\n        raise ValueError("window must be in range (0, len(values)]")\n    return [\n        sum(values[i : i + window]) / window\n        for i in range(len(values) - window + 1)\n    ]\n\n# [2.0, 3.0, 4.0] — no index errors, no mutation`,
    },
    {
      kind: 'list',
      title: 'What changed and why',
      items: [
        { title: 'Bounds fixed', detail: 'range stops at len(values) - window + 1, so every slice is full-size.' },
        { title: 'No mutation during iteration', detail: 'A new list is returned instead of editing the input in place.' },
        { title: 'Guard clause added', detail: 'Zero or oversized windows now fail fast with a clear message.' },
      ],
    },
  ],
  data: [
    {
      kind: 'stats',
      items: [
        { label: 'Sources queried', value: '4' },
        { label: 'Agreement score', value: '0.93' },
        { label: 'Freshness', value: '2 min ago' },
      ],
    },
    {
      kind: 'prose',
      text: 'Gemini Pro retrieved and cross-referenced four independent sources, weighted by recency and publisher reliability. Findings are consistent across all of them with a 93% agreement score.',
    },
    {
      kind: 'table',
      title: 'Key findings',
      head: ['Source', 'Signal', 'Reliability'],
      rows: [
        ['Indexed news corpus', 'Primary finding confirmed', 'High'],
        ['Statistical database', 'Figures match within 0.4%', 'High'],
        ['Domain report', 'Trend direction agreed', 'Medium'],
        ['Expert commentary', 'Contextual support only', 'Medium'],
      ],
    },
    {
      kind: 'callout',
      title: 'Confidence note',
      text: 'Two sources are less than 24 hours old. The remaining two are within a week — figures are stable across that window.',
    },
  ],
  creative: [
    {
      kind: 'prose',
      text: 'Three on-brand variations were drafted, tuned for a confident, modern voice. Each keeps a single idea per line so the copy works on both the landing page and short social formats.',
    },
    {
      kind: 'list',
      title: 'Drafts',
      items: [
        { title: 'Bold & direct', detail: '"Built for momentum. Every launch starts with a single decisive move."' },
        { title: 'Warm & human', detail: '"The best ideas feel inevitable — we just help you get there faster."' },
        { title: 'Visionary', detail: '"Where intent meets execution. Welcome to the new standard of getting things done."' },
      ],
    },
    {
      kind: 'callout',
      title: 'Recommendation',
      text: 'The bold & direct variation tests best for hero sections; keep the visionary line for the closing call-to-action.',
    },
  ],
  planning: [
    {
      kind: 'prose',
      text: 'A 7-day high-protein plan built around ~160 g protein per day, three anchored meals plus one snack, with a 30-minute batch-prep block on Sunday.',
    },
    {
      kind: 'table',
      title: 'Daily template',
      head: ['Meal', 'Example', 'Protein'],
      rows: [
        ['Breakfast', 'Greek yogurt bowl, berries, granola', '38 g'],
        ['Lunch', 'Grilled chicken wrap, quinoa, greens', '45 g'],
        ['Snack', 'Cottage cheese + almonds', '22 g'],
        ['Dinner', 'Salmon, sweet potato, broccoli', '40 g'],
        ['Evening', 'Casein shake (optional)', '15 g'],
      ],
    },
    {
      kind: 'callout',
      title: 'Prep strategy',
      text: 'Sunday batch: bake 6 chicken breasts and 2 salmon fillets, cook a large quinoa pot, portion 7 snack boxes. Total active time: about 40 minutes.',
    },
  ],
  prompt: [
    {
      kind: 'callout',
      title: 'Your original prompt',
      text: '"write something about my product for social media"',
    },
    {
      kind: 'code',
      lang: 'optimized prompt',
      code: `You are a senior social media copywriter.\n\nTask: write 3 launch captions for <PRODUCT>, a <CATEGORY>\naimed at <AUDIENCE>.\n\nConstraints:\n- Each caption under 220 characters\n- One clear call-to-action per caption\n- Confident, modern tone; no hype words\n- End each with 3 relevant hashtags\n\nSuccess check: a reader knows what the product does,\nwho it is for, and what to do next — in one read.`,
    },
    {
      kind: 'list',
      title: 'What the rewriter added',
      items: [
        { title: 'Role framing', detail: 'A persona anchors tone and vocabulary quality.' },
        { title: 'Hard constraints', detail: 'Length, CTA, and hashtag rules make output instantly usable.' },
        { title: 'Success criteria', detail: 'A self-check the model can verify before answering.' },
      ],
    },
  ],
  learning: [
    {
      kind: 'prose',
      text: 'Study notes generated and ordered from foundational to advanced, each with a one-line definition, a mental model, and a recall question you can self-test with.',
    },
    {
      kind: 'list',
      title: 'Concept sequence',
      items: [
        { title: 'Core definition', detail: 'State the concept in one plain sentence before any detail.' },
        { title: 'Mental model', detail: 'Attach it to something you already know — analogies stick 2x longer.' },
        { title: 'Worked example', detail: 'One concrete case beats three abstract explanations.' },
        { title: 'Active recall', detail: 'Close the notes and answer: "Can I explain this out loud in 30 seconds?"' },
      ],
    },
    {
      kind: 'callout',
      title: 'Review schedule',
      text: 'Revisit at 24 hours, 3 days, and 7 days. Spaced repetition at these intervals retains roughly 80% versus 30% for a single read.',
    },
  ],
  reasoning: [
    {
      kind: 'prose',
      text: 'Solved by explicit chain-of-thought: the problem was decomposed into steps, each verified before moving on, then swept for edge cases.',
    },
    {
      kind: 'list',
      title: 'Reasoning trace',
      items: [
        { title: 'Step 1 — Restate', detail: 'Convert the problem into its formal structure (variables, constraints, goal).' },
        { title: 'Step 2 — Simplify', detail: 'Solve the smallest case by hand to expose the underlying pattern.' },
        { title: 'Step 3 — Generalize', detail: 'Lift the pattern into a general formula or algorithm.' },
        { title: 'Step 4 — Verify', detail: 'Check the answer against the small case and probe boundary inputs.' },
      ],
    },
    {
      kind: 'callout',
      title: 'Edge cases found',
      text: 'Empty input, single-element input, and maximum-size input were all tested — the solution holds with no special-casing needed.',
    },
  ],
};

export function buildResult(text: string): IntentResult {
  const id = detectIntent(text);
  const m = MODELS[id];
  return {
    id,
    label: LABELS[id],
    model: m.model,
    modelColor: m.color,
    icon: m.icon,
    confidence: CONFIDENCE[id],
    latencyMs: 820 + Math.round(Math.random() * 700),
    stages: stages(id, text),
    outputTitle: 'Response',
    outputSubtitle: `Generated by ${m.model}`,
    output: OUTPUTS[id],
  };
}
