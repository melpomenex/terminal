'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from '@/context/preferences-context';

/** Motion duration tokens (mirrors CSS vars for use in inline styles). */
export const durations = {
  instant: '0ms',
  fast: '120ms',
  base: '180ms',
  slow: '280ms',
} as const;

/** Easing tokens. */
export const easings = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/**
 * Build a CSS transition string from one or more properties.
 * e.g. `transition(['background', 'color'])` -> "background 180ms cubic-bezier(...), color 180ms ..."
 */
export function transition(
  props: string | string[],
  duration: keyof typeof durations | string = 'base',
  easing: keyof typeof easings | string = 'out',
): string {
  const list = Array.isArray(props) ? props : [props];
  const d = durations[duration as keyof typeof durations] ?? duration;
  const e = easings[easing as keyof typeof easings] ?? easing;
  return list.map((p) => `${p} ${d} ${e}`).join(', ');
}

/** Detect the OS reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** True when animations should run (user enabled them AND no reduced-motion). */
export function useAnimationsEnabled(): boolean {
  const { preferences } = usePreferences();
  const reduced = usePrefersReducedMotion();
  return preferences.effects.animations && !reduced;
}
