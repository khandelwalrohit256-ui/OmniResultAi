import type { OutputBlock } from '@/lib/routerEngine';

export type AgentId = 'gpt-planner' | 'claude-logic' | 'gemini-research' | 'perplexity-search' | 'deepseek-reasoning';

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  specialty: string;
  model: string;
  accent: 'emerald' | 'amber' | 'sky' | 'teal' | 'violet';
  keywords: string[];
}

export type Domain = 'coding' | 'hinglish' | 'meal' | 'schedule' | 'facts' | 'reasoning' | 'general';

const AGENTS: AgentDef[] = [
  {
    id: 'gpt-planner',
    name: 'GPT',
    role: 'Executive Structuring',
    specialty: 'Daily/exam schedules, priorities & prompt architecture',
    model: 'GPT-4o Planner',
    accent: 'emerald',
    keywords: [],
  },
  {
    id: 'claude-logic',
    name: 'Claude',
    role: 'Logic & Tutor',
    specialty: 'Deep debugging, clean code & tough concepts in simple Hinglish',
    model: 'Claude 3.5 Logic',
    accent: 'amber',
    keywords: [],
  },
  {
    id: 'gemini-research',
    name: 'Gemini',
    role: 'Research & Nutrition',
    specialty: 'Practical synthesis, budget/fridge meal plans & multimodal insights',
    model: 'Gemini Pro Research',
    accent: 'sky',
    keywords: [],
  },
  {
    id: 'perplexity-search',
    name: 'Perplexity',
    role: 'Cited Search',
    specialty: 'Live-style cited facts, benchmarks, sources & quick verification',
    model: 'Perplexity Search',
    accent: 'teal',
    keywords: [],
  },
  {
    id: 'deepseek-reasoning',
    name: 'DeepSeek',
    role: 'Chain-of-Thought',
    specialty: 'Step-by-step reasoning, math/algorithm optimization & edge-case analysis',
    model: 'DeepSeek Reasoner',
    accent: 'violet',
    keywords: [],
  },
];

export const AGENT_LIST = AGENTS;

export function getAgent(id: AgentId): AgentDef {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0];
}

const DOMAIN_RULES: { domain: Domain; keywords: string[] }[] = [
  {
    domain: 'coding',
    keywords: ['code', 'bug', 'error', 'debug', 'fix', 'python', 'javascript', 'typescript', 'function', 'exception', 'traceback', 'crash', 'refactor'],
  },
  {
    domain: 'hinglish',
    keywords: ['hinglish', 'hindi', 'simple hindi', 'easy language', 'samjhao', 'samjha', 'batao', 'kya hai', 'kaise'],
  },
  {
    domain: 'meal',
    keywords: ['meal', 'diet', 'recipe', 'food', 'eat', 'ingredients', 'budget meal', 'leftover', 'fridge', 'healthy', 'protein', 'khana'],
  },
  {
    domain: 'schedule',
    keywords: ['schedule', 'plan my day', 'timetable', 'exam', 'priority', 'priorities', 'routine', 'study plan', 'deadline', 'planner'],
  },
  {
    domain: 'facts',
    keywords: ['search', 'latest', 'news', 'benchmark', 'compare', 'price', 'trend', 'market', 'sources', 'cite', 'statistics', 'data'],
  },
  {
    domain: 'reasoning',
    keywords: ['math', 'prove', 'algorithm', 'optimize', 'optimization', 'complexity', 'derivation', 'puzzle', 'probability', 'how many', 'edge case'],
  },
];

export function detectDomain(text: string): Domain {
  const t = ` ${text.toLowerCase()} `;
  let best: Domain = 'general';
  let bestScore = 0;
  for (const rule of DOMAIN_RULES) {
    let s = 0;
    for (const k of rule.keywords) {
      if (t.includes(` ${k} `) || t.includes(` ${k}`)) s += k.split(' ').length > 1 ? 3 : 2;
    }
    if (s > bestScore) {
      bestScore = s;
      best = rule.domain;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Per-agent, per-domain mock output bodies (demo-safe, no API keys)   */
/* ------------------------------------------------------------------ */

type Body = OutputBlock[];

const SPECIALTY_INTRO: Record<AgentId, string> = {
  'gpt-planner': 'Structured into a clear, prioritized framework you can execute immediately.',
  'claude-logic': 'Reasoned through carefully from first principles, with the reasoning shown.',
  'gemini-research': 'Synthesized from practical, real-world patterns and multimodal context.',
  'perplexity-search': 'Verified against multiple cited sources, ranked by recency and reliability.',
  'deepseek-reasoning': 'Derived step-by-step, with every assumption and edge case made explicit.',
};

function codingBody(agent: AgentId): Body {
  switch (agent) {
    case 'claude-logic':
      return [
        {
          kind: 'callout',
          title: 'Root cause',
          text: 'The loop walks one index past the end of the array, and the accumulator list is mutated while iterating — that combination produces the IndexError.',
        },
        {
          kind: 'code',
          lang: 'python',
          code: `def moving_average(values, window):\n    if window <= 0 or window > len(values):\n        raise ValueError("window must be in range (0, len(values)]")\n    return [\n        sum(values[i : i + window]) / window\n        for i in range(len(values) - window + 1)\n    ]`,
        },
        {
          kind: 'list',
          title: 'Walkthrough',
          items: [
            { title: 'Why it crashed', detail: 'range(len(values) - window + 1) guarantees every slice is full-size.' },
            { title: 'Why it corrupted data', detail: 'Returning a new list avoids editing the input mid-iteration.' },
            { title: 'Mental model', detail: 'Treat the input as read-only; build the answer beside it, not inside it.' },
          ],
        },
      ];
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Fix plan (in order)',
          items: [
            { title: '1. Reproduce', detail: 'Add a test with window = len(values) and window > len(values) to pin both failure modes.' },
            { title: '2. Patch bounds', detail: 'Stop the loop at len(values) - window + 1 so every slice is full.' },
            { title: '3. Stop mutation', detail: 'Return a new list instead of editing the input in place.' },
            { title: '4. Guard clause', detail: 'Fail fast with a clear ValueError for impossible window sizes.' },
            { title: '5. Verify', detail: 'Run the suite, then lint. Only then commit with a note on the root cause.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Timebox',
          text: 'Roughly 20 minutes end-to-end: 5 to reproduce, 5 to patch, 10 to test and review the diff.',
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'stats',
          items: [
            { label: 'Sources cited', value: '5' },
            { label: 'Similar issues', value: '12' },
            { label: 'Fix confidence', value: '96%' },
          ],
        },
        {
          kind: 'prose',
          text: 'This exact IndexError pattern is widely documented in sliding-window code. Cited fixes agree with the other agents: clamp the loop bounds and never mutate the input while iterating.',
        },
        {
          kind: 'table',
          title: 'Cited sources',
          head: ['#', 'Source', 'Reliability'],
          rows: [
            ['1', 'Python docs — common sequence pitfalls', 'Official'],
            ['2', 'Stack Overflow — sliding window IndexError thread', 'High'],
            ['3', 'Real Python — windowed iteration patterns', 'High'],
            ['4', 'CPython source — itertools.window implementation', 'Official'],
            ['5', 'Engineering blog — production postmortem, 2025', 'Medium'],
          ],
        },
      ];
    case 'deepseek-reasoning':
      return [
        {
          kind: 'list',
          title: 'Step-by-step derivation',
          items: [
            { title: 'Step 1', detail: 'A valid window needs indices i … i+window-1 to exist, so i ≤ len(values) − window.' },
            { title: 'Step 2', detail: 'Therefore the loop bound is len(values) − window + 1 — the original code overshot by one.' },
            { title: 'Step 3', detail: 'Mutating the input while iterating invalidates the loop invariant; a pure return fixes it.' },
            { title: 'Step 4', detail: 'window > len(values) yields zero valid i values — reject it explicitly rather than silently returning [].' },
          ],
        },
        {
          kind: 'callout',
          title: 'Complexity check',
          text: 'O(n × window) time, O(n) space. For repeated queries on large inputs, a prefix-sum variant drops time to O(n).',
        },
      ];
    default: // gemini-research
      return [
        {
          kind: 'prose',
          text: 'Across codebases I reviewed, this bug almost always comes from a hand-rolled loop. The cleanest practical fix — and the pattern most libraries use — is a declarative window function with built-in bounds checking.',
        },
        {
          kind: 'code',
          lang: 'python',
          code: `from collections import deque\n\ndef moving_average(values, window):\n    buf, out = deque(maxlen=window), []\n    for v in values:\n        buf.append(v)\n        if len(buf) == window:\n            out.append(sum(buf) / window)\n    return out`,
        },
        {
          kind: 'callout',
          title: 'Why this variant',
          text: 'The deque enforces window size structurally — the off-by-one bug becomes impossible to write.',
        },
      ];
  }
}

function hinglishBody(agent: AgentId): Body {
  switch (agent) {
    case 'claude-logic':
      return [
        {
          kind: 'prose',
          text: 'Simple Hinglish explanation, step by step — bilkul jaise dost baith ke samjha raha ho.',
        },
        {
          kind: 'list',
          title: 'Concept in easy Hinglish',
          items: [
            { title: 'Basic idea', detail: 'Socho concept ek chai ki tarah hai — base simple hai, flavour aage add karte hain.' },
            { title: 'Kyun important hai', detail: 'Yehi foundation aage ke saare topics ko easy banata hai. Skip karo toh baad mein confusion hota hai.' },
            { title: 'Ek example', detail: 'Roz ke life se example lo — jaise kharche ka hisaab, ya cricket mein scoring pattern.' },
            { title: 'Self-check', detail: 'Notes band karo aur 30 second mein apne shabdon mein bolo. Nikal gaya? Samajh aa gaya.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Yaad rakhne ka tareeka',
          text: '24 ghante baad revise karo, phir 3 din baad, phir ek hafte baad — yeh spaced repetition lagbhag 80% yaad rakhta hai.',
        },
      ];
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Learning plan (Hinglish-friendly)',
          items: [
            { title: 'Din 1', detail: 'Core definition + ek example. 25 minute focused padhai, 5 minute break.' },
            { title: 'Din 2', detail: 'Self-quiz banao — 5 chote questions. Jo galat hua, usko highlight karo.' },
            { title: 'Din 3', detail: 'Kisi ko samjhao (ya bol ke record karo). Jahan atako, wahi weak point hai.' },
            { title: 'Din 7', detail: 'Full revision + ek mixed practice set. Ab concept permanent hai.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Priority',
          text: 'Pehle 20% core concepts cover karo jo 80% questions cover karte hain — exam ke perspective se sabse efficient hai.',
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'prose',
          text: 'Hinglish mein samjhana students ke liye proven hai — bilingual explanation cognitive load kam karta hai, isliye concept faster stick karta hai.',
        },
        {
          kind: 'table',
          title: 'Cited evidence',
          head: ['#', 'Finding', 'Source type'],
          rows: [
            ['1', 'Bilingual explanation reduces cognitive load', 'Peer-reviewed study'],
            ['2', 'Hinglish explainer channels dominate search', 'Platform data'],
            ['3', 'Peer discussion in Hinglish clears doubts faster', 'Survey, n = 1,200'],
          ],
        },
      ];
    case 'deepseek-reasoning':
      return [
        {
          kind: 'list',
          title: 'Step-by-step (Hinglish)',
          items: [
            { title: 'Step 1', detail: 'Pehle problem ko apne shabdon mein likho — jo clear nahi hai wahi asli problem hai.' },
            { title: 'Step 2', detail: 'Ek chota example solve karo haath se — pattern khud dikhne lagta hai.' },
            { title: 'Step 3', detail: 'Pattern ko general rule mein badlo — yahi concept hai.' },
            { title: 'Step 4', detail: 'Rule ko wapas chote example pe check karo — match hua toh samajh pakka hai.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Edge case tip',
          text: 'Jahan bhi confusion ho, wahan "zero ho toh kya hoga?" aur "sabse bada case ho toh kya hoga?" poochho — dono se depth test hoti hai.',
        },
      ];
    default: // gemini-research
      return [
        {
          kind: 'prose',
          text: 'Hinglish-first learning is one of the most effective study hacks for Indian students — visual + desi context dono ek saath kaam karte hain.',
        },
        {
          kind: 'list',
          title: 'Practical resources pattern',
          items: [
            { title: 'Visual-first', detail: 'Diagram wale Hinglish explainers retention sabse zyada badhate hain.' },
            { title: 'Study groups', detail: 'Hinglish discussion normal hai peer groups mein — doubt jaldi clear hota hai.' },
            { title: 'Flashcards', detail: 'Hinglish cards likhne se recall better hota hai kyunki dobaara translate nahi karna padta.' },
          ],
        },
      ];
  }
}

function mealBody(agent: AgentId): Body {
  switch (agent) {
    case 'gemini-research':
      return [
        {
          kind: 'stats',
          items: [
            { label: 'Est. cost/plate', value: '₹55' },
            { label: 'Prep time', value: '25 min' },
            { label: 'Protein/plate', value: '32 g' },
          ],
        },
        {
          kind: 'table',
          title: 'Budget meals from pantry staples',
          head: ['Meal', 'Main ingredients', 'Cost'],
          rows: [
            ['Chana masala + rice', 'Chickpeas, onion, tomato, rice', '₹40'],
            ['Egg fried rice', 'Eggs, leftover rice, peas, carrot', '₹45'],
            ['Curd rice + peanuts', 'Curd, rice, peanuts, curry leaves', '₹30'],
            ['Dal khichdi', 'Moong dal, rice, ghee, cumin', '₹38'],
          ],
        },
        {
          kind: 'callout',
          title: 'Leftover strategy',
          text: 'Cook dal and rice once, repurpose across 3 days: day 1 khichdi, day 2 fried rice, day 3 tawa-tossed paratha filling.',
        },
      ];
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Weekly meal workflow',
          items: [
            { title: 'Sunday 40 min', detail: 'Batch-cook dal, rice, and 2 boiled-egg portions. Chop and box vegetables.' },
            { title: 'Weekday mornings', detail: 'Zero-cook breakfasts: curd + fruit, or poha with peanuts.' },
            { title: 'Every night (2 min)', detail: 'Check tomorrow’s box; soak dal/grains if needed. Removes morning decisions.' },
            { title: 'Friday', detail: 'Leftover-clearing fried rice or khichdi — zero waste, zero extra cost.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Budget guardrail',
          text: 'Fix a weekly grocery number, shop once with a list, and keep 2 emergency meals (eggs + bread) as backup.',
        },
      ];
    case 'claude-logic':
      return [
        {
          kind: 'prose',
          text: 'Balance beats perfection: a plate of dal/rice, a vegetable, and a protein source covers most micronutrient needs at student-budget prices.',
        },
        {
          kind: 'list',
          title: 'Nutrition anchors',
          items: [
            { title: 'Protein each meal', detail: 'Dal, eggs, curd, or peanuts — cheapest reliable sources.' },
            { title: 'Half plate veg', detail: 'Seasonal vegetables are the cheapest micronutrient insurance.' },
            { title: 'Hydration check', detail: 'Most “hunger” between meals is dehydration — water first.' },
          ],
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'table',
          title: 'Cited price comparison',
          head: ['Protein source', 'Cost per 30 g protein', 'Source'],
          rows: [
            ['Soya chunks', '₹9', 'Local mandi avg'],
            ['Eggs', '₹15', 'Supermarket avg'],
            ['Chana (dry)', '₹11', 'Wholesale index'],
            ['Paneer', '₹34', 'Supermarket avg'],
          ],
        },
        {
          kind: 'callout',
          title: 'Verification note',
          text: 'Prices cross-checked across two retail chains and a wholesale index this week — soy chunks remain the cheapest complete protein.',
        },
      ];
    default: // deepseek-reasoning
      return [
        {
          kind: 'list',
          title: 'Optimizing the meal math',
          items: [
            { title: 'Step 1', detail: 'Define the constraint: protein target per day ÷ cost per gram = efficiency score.' },
            { title: 'Step 2', detail: 'Rank your available ingredients by efficiency, not by habit.' },
            { title: 'Step 3', detail: 'Build plates greedily from the top of the ranking until the target is met.' },
            { title: 'Step 4', detail: 'Edge case: if a day’s budget is half, cut variety first, never protein.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Result',
          text: 'On typical Indian pantry staples, the greedy ranking hits 100 g protein/day at roughly 40% less cost than an unplanned diet.',
        },
      ];
  }
}

function scheduleBody(agent: AgentId): Body {
  switch (agent) {
    case 'gpt-planner':
      return [
        {
          kind: 'table',
          title: 'Priority day plan',
          head: ['Block', 'Focus', 'Why'],
          rows: [
            ['07:00–08:30', 'Hardest subject (deep work)', 'Mind freshest, zero interruptions'],
            ['09:00–12:00', 'Classes / main work', 'Fixed commitments'],
            ['14:00–15:30', 'Practice problems', 'Active recall beats rereading'],
            ['17:00–17:45', 'Revision + flashcards', 'Same-day review locks memory'],
            ['20:00–20:30', 'Plan tomorrow', 'Closes loops, removes morning friction'],
          ],
        },
        {
          kind: 'callout',
          title: 'Priority rule',
          text: 'Rank tasks by “exam weight × weakness”. Do the top item in the first block, no matter what — everything else flexes around it.',
        },
      ];
    case 'claude-logic':
      return [
        {
          kind: 'prose',
          text: 'A schedule only works if it respects how memory actually forms — short spaced sessions outperform long blocks.',
        },
        {
          kind: 'list',
          title: 'Study-science tweaks',
          items: [
            { title: '50/10 cycles', detail: 'Focus decays after ~50 minutes; short breaks restore it fully.' },
            { title: 'Interleave subjects', detail: 'Alternate topics within a day — discrimination improves recall.' },
            { title: 'Recall first', detail: 'Start each session by recalling yesterday, not rereading it.' },
          ],
        },
      ];
    case 'gemini-research':
      return [
        {
          kind: 'stats',
          items: [
            { label: 'Deep-work hrs/day', value: '3.5' },
            { label: 'Break count', value: '6' },
            { label: 'Sleep target', value: '7.5 h' },
          ],
        },
        {
          kind: 'prose',
          text: 'Real student schedules that stick share one trait: they protect sleep first. Every performance metric — focus, recall, mood — degrades before sleep does.',
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'table',
          title: 'Cited technique comparison',
          head: ['Technique', 'Evidence', 'Source'],
          rows: [
            ['Spaced repetition', 'Strongest recall gains', 'Meta-analysis, 2024'],
            ['Pomodoro 50/10', 'Best for sustained focus', 'Productivity lab trial'],
            ['Interleaving', 'Better problem transfer', 'Cognitive science journal'],
          ],
        },
        {
          kind: 'callout',
          title: 'Quick verification',
          text: 'All three techniques are replicated across multiple studies — none rely on a single paper.',
        },
      ];
    default: // deepseek-reasoning
      return [
        {
          kind: 'list',
          title: 'Optimal schedule derivation',
          items: [
            { title: 'Step 1', detail: 'Model the day as blocks with a focus-decay curve after ~50 minutes.' },
            { title: 'Step 2', detail: 'Place the highest-difficulty subject at the focus peak (morning).' },
            { title: 'Step 3', detail: 'Schedule recall sessions 24 h and 7 d after first contact — the retention curve demands it.' },
            { title: 'Step 4', detail: 'Edge case: back-to-back exams collapse spacing — prioritize past-paper practice instead.' },
          ],
        },
      ];
  }
}

function factsBody(agent: AgentId): Body {
  switch (agent) {
    case 'perplexity-search':
      return [
        {
          kind: 'stats',
          items: [
            { label: 'Sources cited', value: '6' },
            { label: 'Agreement', value: '0.93' },
            { label: 'Freshness', value: '< 1 day' },
          ],
        },
        {
          kind: 'table',
          title: 'Findings with citations',
          head: ['#', 'Finding', 'Source'],
          rows: [
            ['1', 'Primary trend confirmed across datasets', 'Indexed news corpus'],
            ['2', 'Figures match within 0.4%', 'Statistical database'],
            ['3', 'Trend direction agreed', 'Domain report'],
            ['4', 'Contextual support only', 'Expert commentary'],
          ],
        },
        {
          kind: 'callout',
          title: 'Verification',
          text: 'Two sources are under 24 hours old; figures are stable across the whole window. Citation links available on request.',
        },
      ];
    case 'gemini-research':
      return [
        {
          kind: 'prose',
          text: 'Synthesizing across sources and modalities: the signal is consistent, and the practical implication matters more than the headline number.',
        },
        {
          kind: 'list',
          title: 'What this means practically',
          items: [
            { title: 'Short term', detail: 'Expect continued movement in the same direction for the next few weeks.' },
            { title: 'Watch for', detail: 'The next data release is the decision point — everything before it is noise.' },
            { title: 'Actionable angle', detail: 'The second-order effect is where the opportunity is, not the headline stat.' },
          ],
        },
      ];
    case 'deepseek-reasoning':
      return [
        {
          kind: 'list',
          title: 'Reasoning over the numbers',
          items: [
            { title: 'Step 1', detail: 'Separate raw growth from base effects — most headline claims skip this.' },
            { title: 'Step 2', detail: 'Check whether the trend survives removal of the single largest outlier.' },
            { title: 'Step 3', detail: 'Project the conservative band, not the average — plan for the floor, enjoy the ceiling.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Edge case',
          text: 'If two sources disagree, check measurement date before trusting either — stale data is the most common cause.',
        },
      ];
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Decision framework',
          items: [
            { title: 'Frame it', detail: 'Write the decision as a question with a deadline attached.' },
            { title: 'Bound it', detail: 'Two to three realistic options — more is procrastination.' },
            { title: 'Pre-commit', detail: 'Choose now what evidence would change your mind next month.' },
          ],
        },
      ];
    default: // claude-logic
      return [
        {
          kind: 'prose',
          text: 'The cited facts are consistent, but their implication depends on one assumption — that current conditions persist. Test that assumption before acting on the numbers.',
        },
        {
          kind: 'callout',
          title: 'Key insight',
          text: 'Agreement between sources tells you the data is right, not that the popular interpretation is.',
        },
      ];
  }
}

function reasoningBody(agent: AgentId): Body {
  switch (agent) {
    case 'deepseek-reasoning':
      return [
        {
          kind: 'list',
          title: 'Chain-of-thought solution',
          items: [
            { title: 'Step 1 — Restate', detail: 'Convert the problem into its formal structure (variables, constraints, goal).' },
            { title: 'Step 2 — Simplify', detail: 'Solve the smallest case by hand to expose the underlying pattern.' },
            { title: 'Step 3 — Generalize', detail: 'Lift the pattern into a general formula or algorithm.' },
            { title: 'Step 4 — Verify', detail: 'Check the answer against the small case and probe boundary inputs.' },
          ],
        },
        {
          kind: 'callout',
          title: 'Edge-case sweep',
          text: 'Empty input, single-element input, and maximum-size input all verified — the solution holds with no special-casing.',
        },
      ];
    case 'claude-logic':
      return [
        {
          kind: 'prose',
          text: 'Arrived at the same result from first principles. The key move most people miss: naming the invariant that stays true between steps — once you can state it, the solution writes itself.',
        },
        {
          kind: 'callout',
          title: 'Conceptual shortcut',
          text: 'If you can explain why the invariant holds, you understand the problem. If you can’t, you’ve memorized the solution.',
        },
      ];
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Practice plan to master it',
          items: [
            { title: 'Today', detail: 'Re-derive the solution once, closed-book.' },
            { title: 'Day 3', detail: 'Solve two variations without hints.' },
            { title: 'Day 7', detail: 'Teach it to someone (or rubber-duck it) in five minutes.' },
          ],
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'table',
          title: 'Cited technique benchmarks',
          head: ['#', 'Approach', 'Benchmark result'],
          rows: [
            ['1', 'Pattern-recognition route', 'Fastest on standard cases'],
            ['2', 'First-principles route', 'Most robust on novel cases'],
            ['3', 'Hybrid (recommended)', 'Best combined accuracy'],
          ],
        },
      ];
    default: // gemini-research
      return [
        {
          kind: 'prose',
          text: 'Visual intuition helps here: sketch the smallest case as a diagram before touching the algebra. Most insights arrive from the picture, not the symbols.',
        },
      ];
  }
}

function generalBody(agent: AgentId): Body {
  switch (agent) {
    case 'gpt-planner':
      return [
        {
          kind: 'list',
          title: 'Action plan',
          items: [
            { title: 'Clarify the goal', detail: 'Write the outcome in one sentence — ambiguity is the top time-killer.' },
            { title: 'Split into steps', detail: 'Three to five steps, each doable in under an hour.' },
            { title: 'Sequence and timebox', detail: 'Order the steps and give each a deadline today.' },
            { title: 'Review at day-end', detail: 'Two minutes: what moved, what slipped, what’s first tomorrow.' },
          ],
        },
      ];
    case 'claude-logic':
      return [
        {
          kind: 'callout',
          title: 'Key insight',
          text: 'Most problems like this hide one wrong assumption. State your assumptions explicitly — the weak one usually reveals itself immediately.',
        },
        {
          kind: 'list',
          title: 'Reasoning steps',
          items: [
            { title: 'Define terms', detail: 'What exactly is being asked? Restate it in your own words.' },
            { title: 'List constraints', detail: 'Time, budget, skill, tools — what’s actually fixed?' },
            { title: 'Test the simplest case', detail: 'Solve the smallest version first; scale the pattern up.' },
          ],
        },
      ];
    case 'gemini-research':
      return [
        {
          kind: 'list',
          title: 'Practical angles',
          items: [
            { title: 'Consensus view', detail: 'Sources agree on the core facts; details vary at the edges.' },
            { title: 'Contrarian angle', detail: 'One recent source challenges the mainstream take — worth a read.' },
            { title: 'What to watch', detail: 'The next 2–4 weeks decide which interpretation wins.' },
          ],
        },
      ];
    case 'perplexity-search':
      return [
        {
          kind: 'stats',
          items: [
            { label: 'Sources', value: '5' },
            { label: 'Agreement', value: '0.91' },
            { label: 'Freshness', value: '< 1 day' },
          ],
        },
        {
          kind: 'table',
          title: 'Cited sources',
          head: ['#', 'Source', 'Reliability'],
          rows: [
            ['1', 'Primary dataset', 'High'],
            ['2', 'Independent analysis', 'High'],
            ['3', 'Expert commentary', 'Medium'],
          ],
        },
      ];
    default: // deepseek-reasoning
      return [
        {
          kind: 'list',
          title: 'Step-by-step take',
          items: [
            { title: 'Step 1', detail: 'Define success in one measurable sentence.' },
            { title: 'Step 2', detail: 'List what must be true for that to happen — those are your real constraints.' },
            { title: 'Step 3', detail: 'Test the weakest constraint first; it decides everything downstream.' },
          ],
        },
      ];
  }
}

export function agentBody(agent: AgentId, domain: Domain): Body {
  switch (domain) {
    case 'coding':
      return codingBody(agent);
    case 'hinglish':
      return hinglishBody(agent);
    case 'meal':
      return mealBody(agent);
    case 'schedule':
      return scheduleBody(agent);
    case 'facts':
      return factsBody(agent);
    case 'reasoning':
      return reasoningBody(agent);
    default:
      return generalBody(agent);
  }
}

export function agentIntro(agentId: AgentId): string {
  return SPECIALTY_INTRO[agentId];
}

/* ------------------------------------------------------------------ */
/* Broadcast runner: mock by default, live API hook via promise        */
/* ------------------------------------------------------------------ */

export interface AgentRunResult {
  agentId: AgentId;
  ok: boolean;
  blocks?: Body;
  latencyMs: number;
  error?: string;
}

export type AgentInvoker = (agent: AgentDef, prompt: string, domain: Domain) => Promise<Body>;

/**
 * Placeholder live-API hook. Implement this to call real providers and
 * return OutputBlock[]; broadcast() will pick it up automatically.
 */
export const liveAgentInvoker: AgentInvoker | null = null;

export function broadcast(
  agentIds: AgentId[],
  prompt: string,
  domain: Domain,
  onAgentDone: (result: AgentRunResult) => void,
  onAgentStart: (agentId: AgentId) => void,
): void {
  const useLive = Boolean(liveAgentInvoker);
  agentIds.forEach((agentId) => {
    onAgentStart(agentId);
    const t0 = Date.now();
    const work: Promise<Body> = useLive
      ? liveAgentInvoker!(getAgent(agentId), prompt, domain)
      : new Promise<Body>((resolve) => {
          const stagger: Record<AgentId, number> = {
            'gpt-planner': 0,
            'claude-logic': 250,
            'gemini-research': 500,
            'perplexity-search': 350,
            'deepseek-reasoning': 600,
          };
          const delay = 900 + Math.floor(Math.random() * 900) + stagger[agentId];
          setTimeout(() => resolve(agentBody(agentId, domain)), delay);
        });
    work
      .then((blocks) => onAgentDone({ agentId, ok: true, blocks, latencyMs: Date.now() - t0 }))
      .catch((err) =>
        onAgentDone({
          agentId,
          ok: false,
          latencyMs: Date.now() - t0,
          error: err instanceof Error ? err.message : 'Agent failed',
        }),
      );
  });
}
