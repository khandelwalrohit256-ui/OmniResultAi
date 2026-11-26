# Project memory

## Product intent & audience

- **OmniRouter AI**: a futuristic dark-mode web app showcasing a simulated "Smart Router" that detects user intent from a single universal input box and delegates to a named LLM.
- Audience: live-presentation viewers; the app is a self-contained demo with simulated (canned) routing and responses, not real model calls.
- Core UX: one prominent input ("What do you want to achieve today?"), live glowing router badge, animated router trace log, and professionally formatted output per intent.
- Quick-test chips allow one-click triggering of the full routing animation during demos.

## Brand personality & voice

- Futuristic, intelligent, autonomous, polished.
- Confident "agent" framing: router "detects", "delegates", reports confidence and latency.
- Presentation-grade: animations and formatting must feel production-worthy, not toy-like.

## Visual design & UX direction

- Dark-mode aesthetic: deep navy background with ambient cyan/blue glow orbs and a subtle grid.
- Glassmorphism for panels; glowing animated borders on the input while routing.
- Smooth transitions and entrance/scanning-line animations throughout.
- Lucide React icons used for logos and UI affordances.
- Typography and layout tuned for a high-end, futuristic feel.
- Per-intent output styles: syntax-highlighted code for coding, tables for data/diet, before/after for prompt enhancement, structured notes for study.
- Every result includes a Copy button.
- Live badge: pulsing cyan during routing → green with latency/confidence stats on completion.
- Router trace log animates step-by-step: parse → embed/intent scan → detect → delegate.

## Decisions, constraints & rationale

- Vite + React + Tailwind starter; JSX + Tailwind classes + React hooks + Lucide React only — no extra UI/icon packages.
- Path alias `@/` → `src/` for imports.
- Intent detection via keyword matching (in-memory); intents include coding, data/search, meal planning, prompt enhancement, study notes, research.
- Models referenced in demo: Claude 3.5 Sonnet, Gemini Pro, GPT-4o.
- Routing/results are simulated with canned content for reliable live demos.
- Detected intent is stored once and reused consistently across badge, trace, and output.
- Build verified clean before delivery.

## Open questions & assumptions

- Real model/API integration is a possible future enhancement but not implemented yet.
- Intent set and quick-test chips are scoped to the current demo; expansion not yet requested.
- No persistence or backend assumed; all state is in-memory.