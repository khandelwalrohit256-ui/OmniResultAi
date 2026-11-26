import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in TS DOM lib for all versions) */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type MicState = 'idle' | 'listening' | 'error' | 'unsupported';

interface UseSpeechResult {
  micState: MicState;
  micError: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  setTranscript: (t: string | ((prev: string) => string)) => void;
}

/**
 * Speech-to-text using the Web Speech API. Appends recognized speech to the
 * prompt (via setTranscript). Falls back gracefully on unsupported browsers
 * or denied mic permission.
 */
export function useSpeechRecognition(setTranscript: UseSpeechResult['setTranscript']): UseSpeechResult {
  const [micState, setMicState] = useState<MicState>(() => (getRecognitionCtor() ? 'idle' : 'unsupported'));
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const mountedRef = useRef(true);
  const setTranscriptRef = useRef(setTranscript);
  setTranscriptRef.current = setTranscript;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const rec = recRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setMicState('unsupported');
      setMicError('Voice input is not supported in this browser — try Chrome or Edge.');
      return;
    }
    if (recRef.current) return; // already listening

    setMicError(null);
    const rec = new Ctor();
    recRef.current = rec;
    finalRef.current = '';
    rec.lang = 'en-IN'; // English + Hinglish
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      const live = (finalRef.current + ' ' + interim).trim();
      setTranscriptRef.current(live);
    };

    rec.onerror = (e) => {
      if (!mountedRef.current) return;
      recRef.current = null;
      setMicState('error');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Microphone permission denied — allow mic access and try again.');
      } else if (e.error === 'no-speech') {
        setMicError('Heard nothing — check your mic and try again.');
      } else {
        setMicError('Voice input failed. You can keep typing instead.');
      }
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      recRef.current = null;
      setMicState((s) => (s === 'listening' ? 'idle' : s));
    };

    try {
      rec.start();
      setMicState('listening');
    } catch {
      recRef.current = null;
      setMicState('error');
      setMicError('Could not start the microphone. You can keep typing instead.');
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    setMicState((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  return { micState, micError, supported: micState !== 'unsupported', start, stop, setTranscript };
}
