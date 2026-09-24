'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { TilingNode, LeafNode, PanelType, PanelConfig, SplitDirection, LinkGroupColor } from '@/lib/tiling-types';
import { createDefaultLayout } from '@/lib/tiling-types';
import type { InstrumentRef } from '@/lib/types/instrument';
import { addSplit as utilAddSplit, removeLeaf as utilRemoveLeaf, setSplitRatio as utilSetRatio, swapPanelConfigs as utilSwap, patchPanelsWhere, findLeaf as utilFindLeaf } from '@/lib/tiling-utils';
import { LAYOUT_PRESETS, DEFAULT_PRESET_ID, getPreset } from '@/lib/preset-layouts';

const STORAGE_KEY_LAYOUT = 'blm_tiling_layout';
const STORAGE_KEY_PRESET = 'blm_tiling_preset';

export interface DragState {
  panelId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

/** Broadcast when a linked panel changes its instrument. */
export interface LinkGroupChangeEvent {
  linkGroup: LinkGroupColor;
  instrument: InstrumentRef;
  sourcePanelId: string;
  timestamp: number;
}

interface TilingContextType {
  layout: TilingNode;
  setLayout: React.Dispatch<React.SetStateAction<TilingNode>>;
  activePanelId: string | null;
  setActivePanelId: (id: string | null) => void;
  dragState: DragState | null;
  setDragState: (s: DragState | null) => void;
  dropTargetId: string | null;
  setDropTargetId: (id: string | null) => void;
  dropZone: 'center' | 'left' | 'right' | 'top' | 'bottom' | null;
  setDropZone: (z: 'center' | 'left' | 'right' | 'top' | 'bottom' | null) => void;
  contextMenu: { x: number; y: number; targetPanelId: string | null } | null;
  setContextMenu: (m: { x: number; y: number; targetPanelId: string | null } | null) => void;
  addPanel: (targetPanelId: string, type: PanelType, direction?: SplitDirection) => void;
  removePanel: (panelId: string) => void;
  maximizedPanelId: string | null;
  maximizePanel: (panelId: string) => void;
  restoreLayout: () => void;
  resizeSplit: (splitId: string, deltaRatio: number) => void;
  swapPanels: (panelA: string, panelB: string) => void;
  activePresetId: string | null;
  loadPreset: (presetId: string) => void;
  /** Per-panel instrument ownership + color-link broadcast group. */
  setPanelInstrument: (panelId: string, instrument: InstrumentRef) => void;
  setPanelLinkGroup: (panelId: string, group: LinkGroupColor) => void;
  getPanelInstrument: (panelId: string) => InstrumentRef | null;
  getPanelLinkGroup: (panelId: string) => LinkGroupColor;
  setPanelSettings: (panelId: string, settings: Record<string, unknown>) => void;
  /** Latest link-group broadcast, for panels that react via effects. */
  lastLinkEvent: LinkGroupChangeEvent | null;
}

export const TilingContext = createContext<TilingContextType | null>(null);

export function useTilingContext() {
  const ctx = useContext(TilingContext);
  if (!ctx) throw new Error('useTilingContext must be used within TilingProvider');
  return ctx;
}

export function TilingProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState<TilingNode>(() => createDefaultLayout());

  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<'center' | 'left' | 'right' | 'top' | 'bottom' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetPanelId: string | null } | null>(null);
  const [maximizedPanelId, setMaximizedPanelId] = useState<string | null>(null);
  const savedLayout = useRef<TilingNode | null>(null);

  const maximizePanel = useCallback((panelId: string) => {
    const leaf = findLeafInTree(layout, panelId);
    if (!leaf) return;
    savedLayout.current = layout;
    setLayout({ type: 'leaf', id: leaf.id, panel: { ...leaf.panel } });
    setMaximizedPanelId(panelId);
  }, [layout]);

  const restoreLayout = useCallback(() => {
    if (savedLayout.current) {
      setLayout(savedLayout.current);
      savedLayout.current = null;
    }
    setMaximizedPanelId(null);
  }, []);

  function findLeafInTree(node: TilingNode, panelId: string): LeafNode | null {
    if (node.type === 'leaf') return node.panel.id === panelId ? node : null;
    return findLeafInTree(node.first, panelId) ?? findLeafInTree(node.second, panelId);
  }

  // Persist layout
  // (done via useEffect in terminal-shell to avoid circular deps)

  const clearPreset = useCallback(() => setActivePresetId(null), []);

  const addPanel = useCallback((targetPanelId: string, type: PanelType, direction: SplitDirection = 'vertical') => {
    const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const labels: Record<PanelType, string> = {
      'quote-monitor': 'MONITOR',
      'security-description': 'DESCRIPTION',
      'chart': 'GP',
      'news': 'NEWS',
      'fundamentals': 'FUNDAMENTALS',
      'portfolio': 'PORTFOLIO',
      'fx-rates': 'FX RATES',
      'commodity': 'COMMODITY',
      'options-chain': 'OPTIONS',
      'economic-calendar': 'ECO CALENDAR',
      'earnings': 'EARNINGS',
      'analyst-ratings': 'ANALYST RATINGS',
      'bond-yields': 'BONDS',
      'market-heatmap': 'HEATMAP',
      'stock-screener': 'SCREENER',
      'insider-activity': 'INSIDER',
      'institutional-holdings': 'INST HOLD',
      'sec-filings': 'SEC FILINGS',
      'world-markets': 'WORLD MKT',
      'correlation-risk': 'CORRELATION',
      'social-sentiment': 'SENTIMENT',
      'help': 'HELP',
      'brain-chat': 'BRAIN',
      'brain-settings': 'BRAIN CFG',
      'finance-research': 'FIN RESEARCH',
      'ticker-cards': 'TICKERS',
      'fear-greed': 'FEAR & GREED',
      'market-breadth': 'BREADTH',
      'tape': 'TAPE',
      'depth': 'DEPTH',
      'unusual-options': 'FLOW',
      'gamma-exposure': 'GEX',
      'congress-trades': 'CONGRESS',
      'seasonality': 'SEASON',
      'sector-rotation': 'SECTORS',
      'movers': 'MOVERS',
      'wsb-trending': 'WSB',
      'vix-term': 'VIX TERM',
      'dividend-calendar': 'DIVIDENDS',
      'backtest': 'LAB',
      'notes': 'NOTES',
      'superinvestor': 'WHALES',
      'etf-flows': 'ETF FLOWS',
      'allq': 'ALLQ',
      'financial-analysis': 'FA',
      'ratio-analysis': 'RATIO',
      'earnings-matrix': 'EM',
      'transcripts': 'TRAN',
      'market-halts': 'HALT',
      'ipo-monitor': 'IPO',
      'dividend-analytics': 'DIV',
      'research-notes': 'NOTE',
      'options-valuation': 'OVME',
      'aum': 'AUM',
      'financial-calculator': 'CALC',
      'historical-data': 'HP',
      'workspace-manager': 'WORKSPACES',
    };
    const newPanel: PanelConfig = { id: uid(), type, label: labels[type], linkGroup: 'UNLINKED' };
    clearPreset();
    setLayout((prev) => utilAddSplit(prev, targetPanelId, newPanel, direction));
  }, [clearPreset]);

  const removePanel = useCallback((panelId: string) => {
    clearPreset();
    setLayout((prev) => utilRemoveLeaf(prev, panelId));
  }, [clearPreset]);

  const resizeSplit = useCallback((splitId: string, deltaRatio: number) => {
    clearPreset();
    setLayout((prev) => {
      const split = findSplit(prev, splitId);
      if (!split) return prev;
      return utilSetRatio(prev, splitId, split.ratio + deltaRatio);
    });
  }, []);

  const [activePresetId, setActivePresetId] = useState<string | null>(DEFAULT_PRESET_ID);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.type) {
          setLayout(parsed);
          setActivePresetId(null);
          return;
        }
      }

      const savedPreset = localStorage.getItem(STORAGE_KEY_PRESET);
      if (savedPreset && savedPreset !== DEFAULT_PRESET_ID) {
        const preset = getPreset(savedPreset);
        if (preset) {
          setLayout(preset.fn());
          setActivePresetId(savedPreset);
        }
      }
    } catch {}
  }, []);

  const swapPanels = useCallback((panelA: string, panelB: string) => {
    clearPreset();
    setLayout((prev) => utilSwap(prev, panelA, panelB));
  }, [clearPreset]);

  // -------------------------------------------------------------------------
  // Color-link event bus
  //
  // When a panel updates its instrument and belongs to a color group (not
  // UNLINKED), every other leaf in that group receives the same instrument in
  // one immutable pass. UNLINKED and differently-colored panels are untouched.
  // -------------------------------------------------------------------------
  const [lastLinkEvent, setLastLinkEvent] = useState<LinkGroupChangeEvent | null>(null);

  const setPanelInstrument = useCallback((panelId: string, instrument: InstrumentRef) => {
    setLayout((prev) => {
      const source = utilFindLeaf(prev, panelId);
      const group = source?.panel.linkGroup ?? 'UNLINKED';
      if (group !== 'UNLINKED') {
        setLastLinkEvent({ linkGroup: group, instrument, sourcePanelId: panelId, timestamp: Date.now() });
        return patchPanelsWhere(
          prev,
          (p) => p.linkGroup === group,
          (p) => ({ ...p, instrument }),
        );
      }
      return patchPanelsWhere(prev, (p) => p.id === panelId, (p) => ({ ...p, instrument }));
    });
  }, []);

  const setPanelLinkGroup = useCallback((panelId: string, group: LinkGroupColor) => {
    // Joining a group adopts the group's current instrument (from any member).
    setLayout((prev) => {
      let groupInstrument: InstrumentRef | null = null;
      if (group !== 'UNLINKED') {
        const adopt = utilFindLeaf(prev, panelId);
        const source = (function walk(node: TilingNode): PanelConfig | null {
          if (node.type === 'leaf') return node.panel.linkGroup === group ? node.panel : null;
          return walk(node.first) ?? walk(node.second);
        })(prev);
        if (source?.instrument) groupInstrument = source.instrument;
        else if (adopt?.panel.instrument) groupInstrument = adopt.panel.instrument;
      }
      return patchPanelsWhere(
        prev,
        (p) => p.id === panelId,
        (p) => ({ ...p, linkGroup: group, instrument: groupInstrument ?? p.instrument }),
      );
    });
  }, []);

  const getPanelInstrument = useCallback(
    (panelId: string): InstrumentRef | null => utilFindLeaf(layout, panelId)?.panel.instrument ?? null,
    [layout],
  );

  const getPanelLinkGroup = useCallback(
    (panelId: string): LinkGroupColor => utilFindLeaf(layout, panelId)?.panel.linkGroup ?? 'UNLINKED',
    [layout],
  );

  const setPanelSettings = useCallback((panelId: string, settings: Record<string, unknown>) => {
    setLayout((prev) => patchPanelsWhere(prev, (p) => p.id === panelId, (p) => ({ ...p, panelSettings: { ...p.panelSettings, ...settings } })));
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    setLayout(preset.fn());
    setActivePresetId(presetId);
    savedLayout.current = null;
    setMaximizedPanelId(null);
    try { localStorage.setItem(STORAGE_KEY_PRESET, presetId); } catch {}
  }, []);

  const value: TilingContextType = {
    layout, setLayout,
    activePanelId, setActivePanelId,
    dragState, setDragState,
    dropTargetId, setDropTargetId,
    dropZone, setDropZone,
    contextMenu, setContextMenu,
    addPanel, removePanel, resizeSplit, swapPanels,
    maximizedPanelId, maximizePanel, restoreLayout,
    activePresetId, loadPreset,
    setPanelInstrument, setPanelLinkGroup, getPanelInstrument, getPanelLinkGroup,
    setPanelSettings, lastLinkEvent,
  };

  return (
    <TilingContext.Provider value={value}>
      {children}
    </TilingContext.Provider>
  );
}

function findSplit(node: TilingNode, splitId: string): { ratio: number } | null {
  if (node.type === 'split') {
    if (node.id === splitId) return { ratio: node.ratio };
    return findSplit(node.first, splitId) ?? findSplit(node.second, splitId);
  }
  return null;
}
