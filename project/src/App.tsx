import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Columns3,
  Copy,
  Cpu,
  History,
  LayoutGrid,
  ListX,
  Loader2,
  Mic,
  MicOff,
  Moon,
  Radio,
  Route,
  Search,
  Sparkles,
  Sun,
  Terminal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { buildResult, type IntentResult } from '@/lib/routerEngine';
import {
  AGENT_LIST,
  broadcast,
  detectDomain,
  getAgent,
  type AgentId,
  type AgentRunResult,
  type Domain,
} from '@/lib/agents';
import { BlockView, blocksToText, copyText } from '@/components/OutputBlocks';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

type Theme = 'dark' | 'light';

type BroadcastStatus =
  | { state: 'running' }
  | { state: 'done'; result: AgentRunResult }
  | { state: 'error'; message: string };

type Phase =
  | { state: 'idle' }
  | { state: 'routing'; result: IntentResult; stageIndex: number }
  | { state: 'done'; result: IntentResult }
  | {
      state: 'broadcasting';
      prompt: string;
      domain: Domain;
      agents: AgentId[];
      statuses: Record<AgentId, BroadcastStatus>;
    }
  | {
      state: 'broadcastDone';
      prompt: string;
      domain: Domain;
      agents: AgentId[];
      statuses: Record<AgentId, BroadcastStatus>;
    };

interface HistoryItem {
  prompt: string;
  mode: 'smart' | 'broadcast';
  ts: number;
}

const HISTORY_KEY = 'omnirouter.history.v1';
const THEME_KEY = 'omnirouter.theme';

const DOMAIN_CHIPS: { label: string; prompt: string }[] = [
  {
    label: 'Fix this coding bug',
    prompt:
      'Fix this Python bug: my moving_average function throws IndexError when the window is bigger than expected and sometimes mutates the list while iterating',
  },
  {
    label: 'Explain in simple Hinglish',
    prompt: 'Explain recursion and dynamic programming in simple Hinglish with easy examples',
  },
  {
    label: 'Budget meal plan from leftovers',
    prompt:
      'Make a healthy budget meal plan for a week using leftover rice, dal, eggs and seasonal vegetables I already have',
  },
  {
    label: 'Priority exam-day schedule',
    prompt: 'Create a priority daily schedule for my exam week balancing classes, revision and sleep',
  },
  {
    label: 'Optimize this algorithm',
    prompt:
      'Optimize this algorithm: find the maximum subarray sum and analyze time complexity and edge cases step by step',
  },
];

const AGENT_ACCENTS: Record<string, { dot: string; border: string; text: string; glow: string }> = {
  emerald: {
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    border: 'border-emerald-500/50 dark:border-emerald-400/40',
    text: 'text-emerald-600 dark:text-emerald-300',
    glow: 'shadow-[0_0_30px_-10px_rgba(52,211,153,0.4)]',
  },
  amber: {
    dot: 'bg-amber-500 dark:bg-amber-400',
    border: 'border-amber-500/50 dark:border-amber-400/40',
    text: 'text-amber-600 dark:text-amber-300',
    glow: 'shadow-[0_0_30px_-10px_rgba(251,191,36,0.4)]',
  },
  sky: {
    dot: 'bg-sky-500 dark:bg-sky-400',
    border: 'border-sky-500/50 dark:border-sky-400/40',
    text: 'text-sky-600 dark:text-sky-300',
    glow: 'shadow-[0_0_30px_-10px_rgba(56,189,248,0.4)]',
  },
  teal: {
    dot: 'bg-teal-500 dark:bg-teal-400',
    border: 'border-teal-500/50 dark:border-teal-400/40',
    text: 'text-teal-600 dark:text-teal-300',
    glow: 'shadow-[0_0_30px_-10px_rgba(45,212,191,0.4)]',
  },
  violet: {
    dot: 'bg-violet-500 dark:bg-violet-400',
    border: 'border-violet-500/50 dark:border-violet-400/40',
    text: 'text-violet-600 dark:text-violet-300',
    glow: 'shadow-[0_0_30px_-10px_rgba(167,139,250,0.4)]',
  },
};

const DOMAIN_LABEL: Record<Domain, string> = {
  coding: 'Coding domain',
  hinglish: 'Hinglish explanation',
  meal: 'Meal / nutrition domain',
  schedule: 'Schedule / planning domain',
  facts: 'Cited facts domain',
  reasoning: 'Deep reasoning domain',
  general: 'General domain',
};

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  'gpt-planner': Sparkles,
  'claude-logic': Brain,
  'gemini-research': Search,
  'perplexity-search': Search,
  'deepseek-reasoning': Brain,
};

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === 'light' || t === 'dark') return t;
    } catch {
      /* storage unavailable */
    }
    return 'dark';
  });
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'smart' | 'broadcast'>('smart');
  const [selectedAgents, setSelectedAgents] = useState<Set<AgentId>>(
    () => new Set(AGENT_LIST.map((a) => a.id)),
  );
  const [phase, setPhase] = useState<Phase>({ state: 'idle' });
  const [log, setLog] = useState<{ text: string; sub: string }[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [broadcastView, setBroadcastView] = useState<'grid' | 'tabs'>('grid');
  const [activeTab, setActiveTab] = useState<AgentId>(AGENT_LIST[0].id);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runIdRef = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // THEME FIX: Tailwind's `dark:` variants need the `dark` class on <html>,
  // so we toggle both `dark` and `light` classes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const { micState, micError, start, stop, setTranscript } = useSpeechRecognition(setInput);
  const listening = micState === 'listening';

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const busy = phase.state === 'routing' || phase.state === 'broadcasting';

  const pushHistory = useCallback((prompt: string, m: 'smart' | 'broadcast') => {
    setHistory((prev) => {
      const next = [{ prompt, mode: m, ts: Date.now() }, ...prev.filter((h) => h.prompt !== prompt)].slice(0, 8);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — history stays in memory */
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const scrollToResults = useCallback(() => {
    timersRef.current.push(
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80),
    );
  }, []);

  const run = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;
      stop();
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      if (mode === 'smart') {
        const runId = ++runIdRef.current;
        const result = buildResult(prompt);
        setLog([]);
        setPhase({ state: 'routing', result, stageIndex: 0 });
        pushHistory(prompt, 'smart');
        scrollToResults();

        let t = 0;
        result.stages.forEach((stage, i) => {
          t += stage.delayMs;
          timersRef.current.push(
            setTimeout(() => {
              if (runIdRef.current !== runId) return;
              setLog((prev) => [...prev, { text: stage.label, sub: stage.detail }]);
              if (i === result.stages.length - 1) {
                timersRef.current.push(
                  setTimeout(() => {
                    if (runIdRef.current !== runId) return;
                    setPhase({ state: 'done', result });
                  }, 650),
                );
              }
            }, t),
          );
        });
      } else {
        const agents = AGENT_LIST.filter((a) => selectedAgents.has(a.id)).map((a) => a.id);
        if (agents.length === 0) return;
        const runId = ++runIdRef.current;
        const domain = detectDomain(prompt);
        const statuses = Object.fromEntries(
          agents.map((id) => [id, { state: 'running' } as BroadcastStatus]),
        ) as Record<AgentId, BroadcastStatus>;
        setLog([]);
        setPhase({ state: 'broadcasting', prompt, domain, agents, statuses });
        pushHistory(prompt, 'broadcast');
        scrollToResults();

        broadcast(
          agents,
          prompt,
          domain,
          (result) => {
            if (runIdRef.current !== runId) return;
            setPhase((prev) => {
              if (
                (prev.state !== 'broadcasting' && prev.state !== 'broadcastDone') ||
                !prev.agents.includes(result.agentId)
              ) {
                return prev;
              }
              const nextStatuses: Record<AgentId, BroadcastStatus> = {
                ...prev.statuses,
                [result.agentId]: result.ok
                  ? { state: 'done', result }
                  : { state: 'error', message: result.error ?? 'Agent failed' },
              };
              const allSettled = prev.agents.every(
                (id) => nextStatuses[id].state === 'done' || nextStatuses[id].state === 'error',
              );
              return {
                state: allSettled ? 'broadcastDone' : 'broadcasting',
                prompt: prev.prompt,
                domain: prev.domain,
                agents: prev.agents,
                statuses: nextStatuses,
              };
            });
          },
          () => {
            /* agent start already reflected in initial statuses */
          },
        );
      }
    },
    [busy, mode, pushHistory, scrollToResults, selectedAgents, stop],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') run(input);
  };

  const toggleAgent = (id: AgentId) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one selected
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setAllAgents = (all: boolean) => {
    setSelectedAgents(all ? new Set(AGENT_LIST.map((a) => a.id)) : new Set([AGENT_LIST[0].id]));
  };

  const doCopy = useCallback((key: string, text: string) => {
    copyText(text).then((ok) => {
      if (!ok) return;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    });
  }, []);

  const smartRunning = phase.state === 'routing';
  const smartDone = phase.state === 'done';
  const broadcastRunning = phase.state === 'broadcasting';
  const broadcastDone = phase.state === 'broadcastDone';
  const inBroadcast = broadcastRunning || broadcastDone;
  const smartActive = smartRunning || smartDone;
  const showResults = smartActive || inBroadcast;

  const traceLines = useMemo(() => {
    if (inBroadcast) {
      const p = phase as Extract<Phase, { state: 'broadcasting' | 'broadcastDone' }>;
      return p.agents.map((id) => {
        const agent = getAgent(id);
        const st = p.statuses[id];
        return {
          key: id,
          text: `Delegating to ${agent.name} · ${agent.role}`,
          sub:
            st.state === 'running'
              ? `${agent.model} — ${DOMAIN_LABEL[p.domain]} context injected`
              : st.state === 'done'
                ? `Completed in ${st.result.latencyMs} ms`
                : `Failed: ${st.message}`,
          running: st.state === 'running',
          error: st.state === 'error',
        };
      });
    }
    if (smartRunning) {
      const p = phase as Extract<Phase, { state: 'routing' }>;
      return p.result.stages.map((stage, i) => ({
        key: `s${i}`,
        text: stage.label,
        sub: stage.detail,
        running: i === log.length,
        error: false,
      }));
    }
    return [];
  }, [inBroadcast, phase, smartRunning, log.length]);

  const broadcastDoneCount = inBroadcast
    ? (phase as Extract<Phase, { state: 'broadcasting' | 'broadcastDone' }>).agents.filter(
        (id) => (phase as Extract<Phase, { state: 'broadcasting' | 'broadcastDone' }>).statuses[id].state === 'done',
      ).length
    : 0;

  const copyAllBroadcast = () => {
    if (!inBroadcast) return;
    const p = phase as Extract<Phase, { state: 'broadcasting' | 'broadcastDone' }>;
    const text = p.agents
      .map((id) => {
        const agent = getAgent(id);
        const st = p.statuses[id];
        if (st.state !== 'done' || !st.result.blocks) return '';
        return `## ${agent.name} — ${agent.role}\n\n${blocksToText(st.result.blocks)}`;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
    doCopy('all', text);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-700 dark:bg-[#050810] dark:text-slate-200">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-sky-400/20 blur-[140px] dark:bg-cyan-500/10" />
        <div className="absolute -left-40 top-1/3 h-[400px] w-[500px] rounded-full bg-blue-400/15 blur-[120px] dark:bg-blue-600/10" />
        <div className="absolute -right-32 bottom-0 h-[400px] w-[600px] rounded-full bg-emerald-400/15 blur-[130px] dark:bg-emerald-500/[0.07]" />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(rgba(100,116,139,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.08) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {/* header */}
        <header className="flex items-center justify-between pb-14 pt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 dark:border-cyan-400/30">
              <Cpu className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              <span className="absolute inset-0 rounded-xl border border-cyan-500/20 animate-ping-slow dark:border-cyan-400/20" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                OmniRouter<span className="text-cyan-600 dark:text-cyan-400"> AI</span>
              </h1>
              <p className="text-[11px] tracking-wide text-slate-500">One input. Every intelligence.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse dark:bg-emerald-400" />
              {mode === 'smart'
                ? 'Router online · 5 agents'
                : `Broadcast ready · ${selectedAgents.size} agents armed`}
            </div>
            {/* theme toggle */}
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-500 backdrop-blur transition-colors hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-white"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* hero */}
        <section className="text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-xs text-slate-500 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400">
            {mode === 'smart' ? (
              <>
                <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                Smart Auto-Route · one best agent from five
              </>
            ) : (
              <>
                <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                Multi-Agent Broadcast · 5 agents, one prompt
              </>
            )}
          </div>
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            What do you want to{' '}
            <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-sky-400 dark:to-emerald-300">
              achieve today?
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            {mode === 'smart'
              ? 'Type, speak, or tap a chip — the router detects your intent and delegates to the best of 5 agents automatically.'
              : 'Type or speak once — every selected agent answers in parallel so you can compare perspectives side by side.'}
          </p>
        </section>

        {/* mode toggle */}
        <section className="mt-8 flex flex-col items-center gap-2.5">
          <div className="flex rounded-full border border-slate-200 bg-white/70 p-1 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60">
            {(
              [
                { id: 'smart', label: 'Smart Route', icon: Route },
                { id: 'broadcast', label: 'Multi-Agent Broadcast', icon: Radio },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={busy}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all disabled:opacity-40 ${
                  mode === m.id
                    ? m.id === 'smart'
                      ? 'bg-cyan-500/15 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.35)] dark:bg-cyan-500/15 dark:text-cyan-200 dark:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                      : 'bg-emerald-500/15 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)] dark:bg-emerald-500/15 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {mode === 'smart'
              ? 'One best agent answers your prompt automatically.'
              : 'Your prompt is sent to every selected agent at once — then hit Broadcast.'}
          </p>
        </section>

        {/* input */}
        <section className="mt-6">
          <div
            className={`group relative rounded-2xl border bg-white/80 backdrop-blur-xl transition-all duration-500 dark:bg-slate-900/60 ${
              busy
                ? mode === 'smart'
                  ? 'border-cyan-500/60 shadow-[0_0_45px_-8px_rgba(6,182,212,0.4)] dark:border-cyan-400/50 dark:shadow-[0_0_45px_-8px_rgba(34,211,238,0.45)]'
                  : 'border-emerald-500/60 shadow-[0_0_45px_-8px_rgba(16,185,129,0.35)] dark:border-emerald-400/50 dark:shadow-[0_0_45px_-8px_rgba(52,211,153,0.4)]'
                : listening
                  ? 'border-rose-400/60 shadow-[0_0_35px_-10px_rgba(239,68,68,0.4)]'
                  : 'border-slate-200 shadow-[0_0_35px_-15px_rgba(6,182,212,0.2)] hover:border-slate-300 dark:border-slate-700/60 dark:shadow-[0_0_35px_-15px_rgba(34,211,238,0.25)] dark:hover:border-slate-500/80'
            }`}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <Terminal
                className={`h-5 w-5 shrink-0 transition-colors ${
                  busy
                    ? mode === 'smart'
                      ? 'text-cyan-600 dark:text-cyan-300'
                      : 'text-emerald-600 dark:text-emerald-300'
                    : listening
                      ? 'text-rose-500'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? 'Listening… speak now' : mode === 'smart'
                  ? 'Ask for code, a meal plan, research, a better prompt…'
                  : 'One prompt, broadcast to every selected agent…'}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
                disabled={busy}
              />
              {/* mic button */}
              <button
                onClick={() => (listening ? stop() : start())}
                title={micError ?? (listening ? 'Stop listening' : 'Speak your prompt (English / Hinglish)')}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  listening
                    ? 'border-rose-400/60 bg-rose-500/10 text-rose-500 animate-mic'
                    : 'border-slate-200 bg-slate-100/60 text-slate-400 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white'
                }`}
              >
                {micState === 'unsupported' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => run(input)}
                disabled={!input.trim() || busy || (mode === 'broadcast' && selectedAgents.size === 0)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === 'smart'
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === 'broadcast' ? (
                  <Radio className="h-4 w-4" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {busy
                    ? mode === 'smart'
                      ? 'Routing'
                      : 'Broadcasting'
                    : mode === 'smart'
                      ? 'Route'
                      : `Broadcast to ${selectedAgents.size} agent${selectedAgents.size === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
            {busy && (
              <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden rounded-b-2xl">
                <div
                  className={`h-full w-1/3 bg-gradient-to-r from-transparent ${
                    mode === 'smart' ? 'via-cyan-400' : 'via-emerald-400'
                  } to-transparent animate-scan`}
                />
              </div>
            )}
          </div>

          {/* mic status line */}
          {(listening || micError) && (
            <p
              className={`mt-2 flex items-center justify-center gap-1.5 text-xs ${
                listening ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {listening ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Listening… speak in English or Hinglish, click the mic again to stop.
                </>
              ) : (
                micError
              )}
            </p>
          )}

          {/* agent pills — broadcast mode only */}
          {mode === 'broadcast' && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-center gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Select agents to receive your prompt
                </p>
                <span className="flex gap-1.5">
                  <button
                    onClick={() => setAllAgents(true)}
                    disabled={busy || selectedAgents.size === AGENT_LIST.length}
                    className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-40 dark:border-emerald-400/40 dark:text-emerald-300"
                  >
                    All 5
                  </button>
                  <button
                    onClick={() => setAllAgents(false)}
                    disabled={busy || selectedAgents.size === 1}
                    className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-700/60"
                  >
                    Reset
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5">
                {AGENT_LIST.map((agent) => {
                  const active = selectedAgents.has(agent.id);
                  const accent = AGENT_ACCENTS[agent.accent];
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      disabled={busy}
                      title={agent.specialty}
                      className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] backdrop-blur transition-all disabled:opacity-40 ${
                        active
                          ? `${accent.border} ${accent.glow} bg-white text-slate-900 dark:bg-slate-900/80 dark:text-white`
                          : 'border-slate-200 bg-white/50 text-slate-400 hover:text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:text-slate-300'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${active ? accent.dot : 'bg-slate-400 dark:bg-slate-600'} ${
                          active && broadcastRunning ? 'animate-pulse' : ''
                        }`}
                      />
                      <span className="font-medium">{agent.name}</span>
                      <span className={`hidden text-[11px] sm:inline ${active ? accent.text : 'text-slate-400 dark:text-slate-600'}`}>
                        {agent.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* domain quick chips */}
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {DOMAIN_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setInput(chip.prompt);
                  run(chip.prompt);
                }}
                disabled={busy}
                className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-2 text-[13px] text-slate-600 backdrop-blur transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-700 disabled:opacity-40 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 transition-colors group-hover:bg-cyan-500 dark:bg-slate-600 dark:group-hover:bg-cyan-400" />
                {chip.label}
              </button>
            ))}
          </div>

          {/* recent prompts */}
          {history.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/60 p-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/40">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <History className="h-3.5 w-3.5" />
                  Recent prompts
                </div>
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-rose-400/40 hover:text-rose-500 dark:border-slate-700/60 dark:text-slate-400 dark:hover:text-rose-300"
                >
                  <ListX className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h.ts}
                    onClick={() => {
                      setInput(h.prompt);
                      setMode(h.mode);
                      run(h.prompt);
                    }}
                    disabled={busy}
                    title={`${h.mode === 'smart' ? 'Smart Route' : 'Broadcast'} · click to re-run`}
                    className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-100/60 px-3 py-1.5 text-xs text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
                  >
                    {h.mode === 'broadcast' ? (
                      <Radio className="h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400/70" />
                    ) : (
                      <Route className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400/70" />
                    )}
                    <span className="truncate">{h.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* results */}
        {showResults && (
          <div ref={resultsRef} className="mt-10 scroll-mt-6 space-y-5">
            {smartActive && <SmartBadge phase={phase} />}
            {inBroadcast && <BroadcastBadge phase={phase} doneCount={broadcastDoneCount} />}

            {/* trace */}
            {(smartRunning || broadcastRunning) && (
              <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
                <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <Brain className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  {broadcastRunning ? 'Parallel agent trace' : 'Router trace'}
                </div>
                <ol className="space-y-3">
                  {traceLines.map((entry) => (
                    <li key={entry.key} className={`flex items-start gap-3 ${entry.running ? 'animate-rise' : ''}`}>
                      {entry.running ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${entry.error ? 'text-rose-500' : 'text-emerald-500 dark:text-emerald-400'}`}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{entry.text}</p>
                        <p className="truncate text-xs text-slate-500">{entry.sub}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* smart output */}
            {smartDone && (
              <OutputCard
                title="Response"
                subtitle={`Generated by ${phase.result.model}`}
                copyKey="smart"
                copied={copiedKey === 'smart'}
                text={blocksToText(phase.result.output)}
                onCopy={doCopy}
              >
                <div className="space-y-5">
                  {phase.result.output.map((block, i) => (
                    <BlockView key={i} block={block} />
                  ))}
                </div>
              </OutputCard>
            )}

            {/* broadcast output */}
            {inBroadcast && (
              <BroadcastResults
                phase={phase}
                view={broadcastView}
                onViewChange={setBroadcastView}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                copiedKey={copiedKey}
                onCopy={doCopy}
                onCopyAll={copyAllBroadcast}
              />
            )}
          </div>
        )}

        {phase.state === 'idle' && (
          <p className="mt-12 text-center text-xs text-slate-400 dark:text-slate-600">
            {mode === 'smart'
              ? 'Click a quick-test chip above to watch the router in action — or type (or speak) your own prompt.'
              : 'Pick a quick-test chip, choose your agents, then press Broadcast to compare all perspectives side by side.'}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Smart route badge & output ---------------- */

function SmartBadge({ phase }: { phase: Phase }) {
  if (phase.state !== 'routing' && phase.state !== 'done') return null;
  const result = phase.result;
  const routingNow = phase.state === 'routing';
  const Icon = routingNow ? Brain : CheckCircle2;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-xl transition-all duration-700 ${
        routingNow
          ? 'border-cyan-500/40 bg-cyan-500/[0.06] shadow-[0_0_35px_-12px_rgba(6,182,212,0.5)] dark:border-cyan-400/40 dark:bg-cyan-500/[0.06] dark:shadow-[0_0_35px_-12px_rgba(34,211,238,0.6)]'
          : 'border-emerald-500/30 bg-emerald-500/[0.05] dark:border-emerald-400/30'
      }`}
    >
      <span
        className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
          routingNow ? 'bg-cyan-500 animate-pulse dark:bg-cyan-400' : 'bg-emerald-500 dark:bg-emerald-400'
        }`}
      />
      <span className="text-sm font-medium">
        <span className="text-slate-500 dark:text-slate-400">Autonomous Router: </span>
        <span className="text-slate-900 dark:text-white">
          Detected <span className="text-cyan-600 dark:text-cyan-300">{result.label}</span>
        </span>
        <span className="mx-2 text-slate-400 dark:text-slate-600">→</span>
        <span className={result.modelColor}>{result.model}</span>
      </span>
      <span
        className={`ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
          routingNow
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-200'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {routingNow ? 'Delegating live' : `Done in ${result.latencyMs} ms · ${result.confidence}% confidence`}
      </span>
    </div>
  );
}

function BroadcastBadge({ phase, doneCount }: { phase: Phase; doneCount: number }) {
  if (phase.state !== 'broadcasting' && phase.state !== 'broadcastDone') return null;
  const total = phase.agents.length;
  const running = phase.state === 'broadcasting';
  const allDone = total > 0 && doneCount === total;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.06] px-5 py-4 backdrop-blur-xl transition-all duration-700 dark:border-emerald-400/40 ${
        running ? 'shadow-[0_0_35px_-12px_rgba(16,185,129,0.5)] dark:shadow-[0_0_35px_-12px_rgba(52,211,153,0.5)]' : ''
      }`}
    >
      <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      <span className="text-sm font-medium">
        <span className="text-slate-500 dark:text-slate-400">Multi-Agent Broadcast: </span>
        <span className="text-slate-900 dark:text-white">
          {running ? `Broadcasting to ${total} agents` : `All ${total} agents responded`}
        </span>
        <span className="mx-2 hidden text-slate-400 dark:text-slate-600 sm:inline">·</span>
        <span className="hidden text-slate-500 sm:inline dark:text-slate-400">{DOMAIN_LABEL[phase.domain]}</span>
      </span>
      <span className="ml-auto flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200">
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {running ? `${doneCount}/${total} responded` : 'Complete'}
      </span>
      {allDone ? null : null}
    </div>
  );
}

/* ---------------- Shared card shell ---------------- */

function OutputCard({
  title,
  subtitle,
  copyKey,
  copied,
  text,
  onCopy,
  children,
}: {
  title: string;
  subtitle: string;
  copyKey: string;
  copied: boolean;
  text: string;
  onCopy: (key: string, text: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700/50">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80 dark:bg-rose-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 dark:bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 dark:bg-emerald-400/70" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{title}</p>
            <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => onCopy(copyKey, text)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

/* ---------------- Broadcast results ---------------- */

function BroadcastResults({
  phase,
  view,
  onViewChange,
  activeTab,
  onTabChange,
  copiedKey,
  onCopy,
  onCopyAll,
}: {
  phase: Extract<Phase, { state: 'broadcasting' | 'broadcastDone' }>;
  view: 'grid' | 'tabs';
  onViewChange: (v: 'grid' | 'tabs') => void;
  activeTab: AgentId;
  onTabChange: (id: AgentId) => void;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  onCopyAll: () => void;
}) {
  const allDone = phase.state === 'broadcastDone';

  return (
    <section>
      {/* toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {phase.agents.length} agent perspectives
          {allDone && <span className="text-slate-400 dark:text-slate-500"> · compare and combine</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyAll}
            disabled={!allDone}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiedKey === 'all' ? 'Copied all' : 'Copy All Outputs'}
          </button>
          <div className="flex rounded-lg border border-slate-200 bg-white/70 p-0.5 dark:border-slate-700/70 dark:bg-slate-900/60">
            {(
              [
                { id: 'grid', icon: LayoutGrid, label: 'Grid' },
                { id: 'tabs', icon: Columns3, label: 'Tabs' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                title={`${v.label} view`}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  view === v.id
                    ? 'bg-slate-200 text-slate-900 dark:bg-slate-700/70 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <v.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* tabs bar */}
      {view === 'tabs' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {phase.agents.map((id) => {
            const agent = getAgent(id);
            const st = phase.statuses[id];
            const accent = AGENT_ACCENTS[agent.accent];
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  active
                    ? `${accent.border} bg-white text-slate-900 dark:bg-slate-900/80 dark:text-white`
                    : 'border-slate-200 bg-white/50 text-slate-500 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    st.state === 'running'
                      ? 'bg-cyan-500 animate-pulse dark:bg-cyan-400'
                      : st.state === 'error'
                        ? 'bg-rose-500'
                        : accent.dot
                  }`}
                />
                {agent.name}
              </button>
            );
          })}
        </div>
      )}

      {/* cards */}
      {view === 'grid' ? (
        <div
          className={`grid gap-4 ${
            phase.agents.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {phase.agents.map((id) => (
            <AgentCard
              key={id}
              agentId={id}
              status={phase.statuses[id]}
              copyKey={`agent-${id}`}
              copied={copiedKey === `agent-${id}`}
              onCopy={onCopy}
            />
          ))}
        </div>
      ) : (
        <AgentCard
          agentId={activeTab}
          status={phase.statuses[activeTab]}
          copyKey={`agent-${activeTab}`}
          copied={copiedKey === `agent-${activeTab}`}
          onCopy={onCopy}
        />
      )}
    </section>
  );
}

function AgentCard({
  agentId,
  status,
  copyKey,
  copied,
  onCopy,
}: {
  agentId: AgentId;
  status: BroadcastStatus;
  copyKey: string;
  copied: boolean;
  onCopy: (key: string, text: string) => void;
}) {
  const agent = getAgent(agentId);
  const accent = AGENT_ACCENTS[agent.accent];
  const running = status.state === 'running';
  const Icon = AGENT_ICONS[agentId];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white/80 backdrop-blur-xl transition-all duration-500 dark:bg-slate-900/60 ${
        running ? `${accent.border} ${accent.glow}` : 'border-slate-200 dark:border-slate-700/50'
      }`}
    >
      {/* card header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700/50">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${accent.border} bg-slate-100 dark:bg-slate-800/60`}
          >
            <Icon className={`h-4 w-4 ${accent.text}`} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {agent.name}
              <span className={`ml-2 text-[11px] font-normal ${accent.text}`}>{agent.role}</span>
            </p>
            <p className="truncate text-[11px] text-slate-500">{agent.specialty}</p>
          </div>
        </div>
        <button
          onClick={() =>
            status.state === 'done' && status.result.blocks && onCopy(copyKey, blocksToText(status.result.blocks))
          }
          disabled={status.state !== 'done'}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 dark:border-slate-700/70 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white"
        >
          <Copy className="h-3 w-3" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* status strip */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-[11px] dark:border-slate-800/60">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            running
              ? 'bg-cyan-500 animate-pulse dark:bg-cyan-400'
              : status.state === 'error'
                ? 'bg-rose-500'
                : 'bg-emerald-500 dark:bg-emerald-400'
          }`}
        />
        <span className={running ? 'text-cyan-600 dark:text-cyan-300' : status.state === 'error' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}>
          {running ? 'Working in parallel…' : status.state === 'error' ? 'Failed' : 'Completed'}
        </span>
        {status.state === 'done' && <span className="ml-auto text-slate-500">{status.result.latencyMs} ms</span>}
      </div>

      {/* body */}
      <div className="flex-1 space-y-4 p-4">
        {running && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100/60 px-4 py-6 dark:border-slate-700/50 dark:bg-slate-800/30">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">{agent.model} is composing a response…</span>
          </div>
        )}
        {status.state === 'error' && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.07] px-4 py-3.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-500 dark:text-rose-300">Agent error</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{status.message}</p>
          </div>
        )}
        {status.state === 'done' && status.result.blocks && (
          <div className="space-y-4">
            {status.result.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
