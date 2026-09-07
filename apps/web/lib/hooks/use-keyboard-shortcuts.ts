'use client';

import * as React from 'react';

export interface Shortcut {
  /** Key sequence, e.g. "g e" or "?" or "mod+k". */
  keys: string;
  description: string;
  handler: () => void;
  group?: string;
}

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Registers global keyboard shortcuts. Supports single keys, chords with a
 * modifier ("mod+k") and two-key sequences ("g e") with a 1s timeout.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const pending = React.useRef<{ key: string; at: number } | null>(null);
  const ref = React.useRef(shortcuts);
  ref.current = shortcuts;

  React.useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Modifier chords work everywhere (e.g. Ctrl+K inside an input).
      for (const s of ref.current) {
        if (!s.keys.startsWith('mod+')) continue;
        const k = s.keys.slice(4).toLowerCase();
        if (mod && key === k) {
          e.preventDefault();
          s.handler();
          return;
        }
      }

      if (mod || e.altKey || isEditable(e.target)) return;

      const now = Date.now();
      const prev = pending.current && now - pending.current.at < 1000 ? pending.current.key : null;
      pending.current = null;

      if (prev) {
        const seq = `${prev} ${key}`;
        const match = ref.current.find((s) => s.keys === seq);
        if (match) {
          e.preventDefault();
          match.handler();
          return;
        }
      }

      const single = ref.current.find((s) => s.keys === key || s.keys === e.key);
      const startsSequence = ref.current.some((s) => s.keys.includes(' ') && s.keys.split(' ')[0] === key);
      if (single && !startsSequence) {
        e.preventDefault();
        single.handler();
        return;
      }
      if (startsSequence) pending.current = { key, at: now };
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
