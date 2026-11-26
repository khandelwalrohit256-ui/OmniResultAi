import { ChevronRight } from 'lucide-react';
import type { OutputBlock } from '@/lib/routerEngine';

export function BlockView({ block }: { block: OutputBlock }) {
  switch (block.kind) {
    case 'prose':
      return <p className="text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">{block.text}</p>;
    case 'callout':
      return (
        <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/[0.06] px-4 py-3.5 dark:border-cyan-400/25 dark:bg-cyan-500/[0.06]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">{block.title}</p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{block.text}</p>
        </div>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed dark:border-slate-700/60 dark:bg-[#0a0f1a]">
          <code className="font-mono text-emerald-700 dark:text-emerald-200/90">{block.code}</code>
        </pre>
      );
    case 'list':
      return (
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{block.title}</p>
          <ul className="space-y-2.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{item.title}</span> — {item.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'table':
      return (
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{block.title}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/40">
                  {block.head.map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'stats':
      return (
        <div className={`grid gap-3 ${block.items.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {block.items.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <p className="text-lg font-semibold text-cyan-600 dark:text-cyan-300">{s.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      );
  }
}

export function blocksToText(blocks: OutputBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'prose':
          return b.text;
        case 'callout':
          return `${b.title}: ${b.text}`;
        case 'code':
          return b.code;
        case 'list':
          return [b.title, ...b.items.map((i) => `${i.title} — ${i.detail}`)].join('\n');
        case 'table':
          return [b.title, b.head.join('\t'), ...b.rows.map((r) => r.join('\t'))].join('\n');
        case 'stats':
          return b.items.map((s) => `${s.label}: ${s.value}`).join('\n');
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text),
    );
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
