'use client';

import { useCallback, useMemo } from 'react';
import { useTilingContext } from '@/context/tiling-context';
import { useTerminalContext } from '@/context/terminal-context';
import type { InstrumentRef } from '@/lib/types/instrument';
import { resolveToRef } from '@/lib/security-master/resolver';
import type { LinkGroupColor } from '@/lib/tiling-types';

export interface PanelInstrumentApi {
  /** Effective instrument: per-panel override, else global terminal symbol. */
  instrument: InstrumentRef;
  /** True when this panel owns an instrument independent of the global symbol. */
  isPanelLocal: boolean;
  linkGroup: LinkGroupColor;
  setInstrument: (ref: InstrumentRef) => void;
  setLinkGroup: (group: LinkGroupColor) => void;
}

/**
 * Backward-compatible per-panel instrument access. Panels read
 * `panel.instrument ?? global fallback` so un-instrumented panels keep the
 * legacy single-symbol behavior until they are explicitly assigned or linked.
 */
export function usePanelInstrument(panelId: string): PanelInstrumentApi {
  const { getPanelInstrument, getPanelLinkGroup, setPanelInstrument, setPanelLinkGroup } = useTilingContext();
  const { symbol } = useTerminalContext();

  const panelInstrument = getPanelInstrument(panelId);
  const linkGroup = getPanelLinkGroup(panelId);

  const instrument = useMemo(
    () => panelInstrument ?? resolveToRef(symbol),
    [panelInstrument, symbol],
  );

  const setInstrument = useCallback((ref: InstrumentRef) => setPanelInstrument(panelId, ref), [panelId, setPanelInstrument]);
  const setLinkGroup = useCallback((group: LinkGroupColor) => setPanelLinkGroup(panelId, group), [panelId, setPanelLinkGroup]);

  return { instrument, isPanelLocal: panelInstrument != null, linkGroup, setInstrument, setLinkGroup };
}
