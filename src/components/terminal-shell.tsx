'use client';

import { useEffect, useRef, useState } from 'react';
import { TerminalProvider, useTerminalContext, WATCHLIST_KEYS } from '@/context/terminal-context';
import { TilingProvider, useTilingContext } from '@/context/tiling-context';
import { usePreferences } from '@/context/preferences-context';
import type { PanelType, TilingNode } from '@/lib/tiling-types';
import { findNeighborByDirection, findParentSplit } from '@/lib/tiling-utils';
import CommandBar from '@/components/shell/command-bar';
import FunctionKeys from '@/components/shell/function-keys';
import MarketPulse from '@/components/shell/market-pulse';
import StatusBar from '@/components/shell/status-bar';
import SettingsPanel from '@/components/shell/settings-panel';
import ShortcutOverlay from '@/components/shell/shortcut-overlay';
import WelcomeModal from '@/components/shell/welcome-modal';
import GuidedTour from '@/components/shell/guided-tour';
import TilingManager from '@/components/tiling/tiling-manager';
import ContextMenu from '@/components/tiling/context-menu';
import DragOverlay from '@/components/tiling/drag-overlay';
import AlertToast from '@/components/tiling/alert-toast';
import SecurityFinderModal from '@/components/modals/security-finder-modal';
import WorkspaceModal from '@/components/modals/workspace-modal';
import BreakingNewsBanner from '@/components/shell/breaking-news-banner';
import NotificationCenter from '@/components/shell/notification-center';
import { workspaceService } from '@/lib/workspaces/workspace-service';
import { exportData, watchlistExportColumns } from '@/lib/export/export-service';
import { getPreset } from '@/lib/preset-layouts';

function getLeaves(node: TilingNode): any[] {
  if (node.type === 'leaf') return [node];
  return [...getLeaves(node.first), ...getLeaves(node.second)];
}

// Map lastAction prefixes to tiling panel types
const ACTION_PANEL_MAP: Record<string, PanelType> = {
  'open:quote-monitor': 'quote-monitor',
  'open:news': 'news',
  'open:chart': 'chart',
  'open:fundamentals': 'fundamentals',
  'open:portfolio': 'portfolio',
  'open:fx-rates': 'fx-rates',
  'open:options-chain': 'options-chain',
  'open:economic-calendar': 'economic-calendar',
  'open:commodity': 'commodity',
  'open:alerts': 'news',
  'open:bond-yields': 'bond-yields',
  'open:market-heatmap': 'market-heatmap',
  'open:stock-screener': 'stock-screener',
  'open:insider-activity': 'insider-activity',
  'open:institutional-holdings': 'institutional-holdings',
  'open:sec-filings': 'sec-filings',
  'open:world-markets': 'world-markets',
  'open:correlation-risk': 'correlation-risk',
  'open:social-sentiment': 'social-sentiment',
  'open:help': 'help',
  'open:brain-chat': 'brain-chat',
  'open:brain-settings': 'brain-settings',
  'open:finance-research': 'finance-research',
  'open:ticker-cards': 'ticker-cards',
  'open:fear-greed': 'fear-greed',
  'open:market-breadth': 'market-breadth',
  'open:tape': 'tape',
  'open:depth': 'depth',
  'open:unusual-options': 'unusual-options',
  'open:gamma-exposure': 'gamma-exposure',
  'open:congress-trades': 'congress-trades',
  'open:seasonality': 'seasonality',
  'open:sector-rotation': 'sector-rotation',
  'open:movers': 'movers',
  'open:wsb-trending': 'wsb-trending',
  'open:vix-term': 'vix-term',
  'open:dividend-calendar': 'dividend-calendar',
  'open:backtest': 'backtest',
  'open:notes': 'notes',
  'open:superinvestor': 'superinvestor',
  'open:etf-flows': 'etf-flows',
  'open:allq': 'allq',
  'open:financial-analysis': 'financial-analysis',
  'open:ratio-analysis': 'ratio-analysis',
  'open:earnings-matrix': 'earnings-matrix',
  'open:transcripts': 'transcripts',
  'open:market-halts': 'market-halts',
  'open:ipo-monitor': 'ipo-monitor',
  'open:dividend-analytics': 'dividend-analytics',
  'open:research-notes': 'research-notes',
  'open:options-valuation': 'options-valuation',
  'open:aum': 'aum',
  'open:financial-calculator': 'financial-calculator',
  'open:historical-data': 'historical-data',
  'open:workspace-manager': 'workspace-manager',
};

function TerminalInner() {
  const {
    inputRef, watchlist, symbol, setSymbol, alerts,
    selectedArticle, setSelectedArticle,
    lastAction, setLastAction, setCommand, setWatchlistKey,
  } = useTerminalContext();
  const { preferences } = usePreferences();
  const { layout, activePanelId, setActivePanelId, setContextMenu, dragState, removePanel, addPanel, swapPanels, resizeSplit, maximizedPanelId, maximizePanel, restoreLayout, activePresetId, loadPreset, setLayout } = useTilingContext();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [secfOpen, setSecfOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const didWelcomeCheck = useRef(false);

  // Persist layout
  useEffect(() => {
    try { localStorage.setItem('blm_tiling_layout', JSON.stringify(layout)); } catch {}
    try { localStorage.removeItem('blm_tiling_preset'); } catch {}  // clear preset when manually saved
  }, [layout]);

  // Publish active symbol for shell-level watchers (notification filings)
  useEffect(() => {
    (window as unknown as { __qubeActiveSymbol?: string }).__qubeActiveSymbol = symbol;
  }, [symbol]);

  // Context menu via custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setContextMenu({ x: detail.x, y: detail.y, targetPanelId: detail.panelId });
    };
    window.addEventListener('tiling-contextmenu', handler);
    return () => window.removeEventListener('tiling-contextmenu', handler);
  }, [setContextMenu]);

  // React to lastAction from handleCommand — open panels via tiling
  useEffect(() => {
    if (!lastAction) return;
    // Overlay-opening actions
    if (lastAction === 'open:settings') { setSettingsOpen(true); setLastAction(null); return; }
    if (lastAction === 'open:shortcuts') { setShortcutsOpen(true); setLastAction(null); return; }
    if (lastAction === 'open:secf') { setSecfOpen(true); setLastAction(null); return; }
    if (lastAction === 'open:workspace-modal') { setWorkspaceOpen(true); setLastAction(null); return; }
    if (lastAction === 'open:notifications') { setNotifOpen(true); setLastAction(null); return; }
    // Named workspace commands
    if (lastAction.startsWith('workspace:')) {
      const [, action, ...rest] = lastAction.split(':');
      const name = rest.join(':');
      void (async () => {
        try {
          if (action === 'save') {
            await workspaceService.save(name, layout, activePresetId);
            console.info(`[workspace] saved "${name}"`);
          } else if (action === 'load') {
            const ws = await workspaceService.load(name);
            setLayout(ws.layout);
            if (ws.activePresetId) loadPreset(ws.activePresetId);
            console.info(`[workspace] loaded "${name}"`);
          } else if (action === 'delete') {
            await workspaceService.delete(name);
            console.info(`[workspace] deleted "${name}"`);
          }
        } catch (e) {
          console.warn(`[workspace] ${action} failed: ${e instanceof Error ? e.message : e}`);
        }
      })();
      setLastAction(null);
      return;
    }
    if (lastAction.startsWith('instrument:')) { setLastAction(null); return; }
    if (lastAction.startsWith('notify:')) { console.info(`[notify] ${lastAction.slice(7)}`); setLastAction(null); return; }
    if (lastAction.startsWith('brain:compare:')) {
      const symbols = lastAction.replace('brain:compare:', '').split(',').filter(Boolean);
      window.dispatchEvent(new CustomEvent('qube-brain-compare', { detail: { symbols } }));
      setLastAction('open:brain-chat');
      return;
    }
    // Unknown command feedback
    if (lastAction.startsWith('unknown:')) {
      const [, attempted, suggestion] = lastAction.split(':');
      console.warn(`Unknown command "${attempted}"${suggestion ? ` — did you mean "${suggestion}"?` : ''}`);
      setLastAction(null);
      return;
    }
    // Panel-opening actions
    if (lastAction.startsWith('open:')) {
      const panelType = ACTION_PANEL_MAP[lastAction];
      if (panelType && activePanelId) {
        addPanel(activePanelId, panelType);
      }
      setLastAction(null);
      return;
    }
    // Preset layout actions
    if (lastAction.startsWith('preset:')) {
      const presetName = lastAction.replace('preset:', '');
      const preset = getPreset(presetName);
      if (preset) loadPreset(preset.id);
      setLastAction(null);
      return;
    }
    // Export action via the centralized export engine (csv/json/xlsx)
    if (lastAction.startsWith('export:')) {
      const [, formatRaw, scope] = lastAction.split(':');
      const format = (['csv', 'json', 'xlsx'].includes(formatRaw) ? formatRaw : 'csv') as 'csv' | 'json' | 'xlsx';
      exportData({ scope: scope || 'watchlist', columns: watchlistExportColumns(), rows: watchlist as unknown as Array<Record<string, unknown>>, format });
      setLastAction(null);
      return;
    }
    setLastAction(null);
  }, [lastAction, activePanelId, addPanel, setLastAction, watchlist, loadPreset]);

  // First-run welcome (never nags after completion)
  useEffect(() => {
    if (didWelcomeCheck.current) return;
    didWelcomeCheck.current = true;
    if (!preferences.onboardingCompleted) setWelcomeOpen(true);
  }, [preferences.onboardingCompleted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inText = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const ctrl = e.ctrlKey || e.metaKey;

      // "?": open shortcut overlay (suppressed in text inputs)
      if (e.key === '?' && !inText && !ctrl) { e.preventDefault(); setShortcutsOpen(true); return; }

      if (inText) return;

      // Ctrl+K: focus command bar
      if (ctrl && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); return; }

      // Ctrl+B: open brain chat
      if (ctrl && e.key === 'b') { e.preventDefault(); setLastAction('open:brain-chat'); return; }

      // Escape: restore from maximize, close context menu, close article
      if (e.key === 'Escape') {
        if (maximizedPanelId) { restoreLayout(); return; }
        inputRef.current?.blur(); setContextMenu(null); if (selectedArticle) setSelectedArticle(null); return;
      }

      // Ctrl+Shift+A: alert prompt
      if (ctrl && e.shiftKey && e.key === 'A') {
        e.preventDefault(); setCommand('ALERT '); inputRef.current?.focus(); return;
      }

      // Ctrl+E: export CSV
      if (ctrl && e.key === 'e') { e.preventDefault(); setLastAction('export:csv'); return; }

      // Ctrl+M: toggle maximize/restore
      if (ctrl && e.key === 'm') {
        e.preventDefault();
        if (maximizedPanelId) restoreLayout();
        else if (activePanelId) maximizePanel(activePanelId);
        return;
      }

      // Ctrl+H/J/K/L: focus navigation (vim-style)
      if (ctrl && !e.shiftKey && /^[hjkl]$/.test(e.key)) {
        e.preventDefault();
        const dir = e.key === 'h' ? 'left' : e.key === 'l' ? 'right' : e.key === 'k' ? 'up' : 'down';
        if (activePanelId) {
          const neighbor = findNeighborByDirection(activePanelId, dir);
          if (neighbor) setActivePanelId(neighbor);
        }
        return;
      }

      // Ctrl+Shift+H/J/K/L: move (swap) active pane
      if (ctrl && e.shiftKey && /^[HJKLhjkl]$/.test(e.key)) {
        e.preventDefault();
        const dir = /^[Hh]$/.test(e.key) ? 'left' : /^[Ll]$/.test(e.key) ? 'right' : /^[Kk]$/.test(e.key) ? 'up' : 'down';
        if (activePanelId) {
          const neighbor = findNeighborByDirection(activePanelId, dir);
          if (neighbor) swapPanels(activePanelId, neighbor);
        }
        return;
      }

      // Ctrl+Shift+Arrows: resize active split
      if (ctrl && e.shiftKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        e.preventDefault();
        if (!activePanelId) return;
        const info = findParentSplit(layout, activePanelId);
        if (!info) return;
        const isHorizontal = info.side === 'first';
        let delta = 0;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') delta = -0.05;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') delta = 0.05;
        // Flip delta if active pane is on the 'second' side
        if (info.side === 'second') delta = -delta;
        resizeSplit(info.splitId, delta);
        return;
      }

      // Tab: cycle focus forward
      if (e.key === 'Tab') {
        e.preventDefault();
        const leaves = getLeaves(layout);
        if (leaves.length === 0) return;
        const idx = leaves.findIndex((l) => l.panel.id === activePanelId);
        setActivePanelId(leaves[(idx + 1) % leaves.length].panel.id);
        return;
      }

      // Ctrl+W: close pane
      if (ctrl && e.key === 'w') {
        e.preventDefault();
        if (activePanelId) {
          const leaves = getLeaves(layout);
          if (leaves.length > 1) removePanel(activePanelId);
        }
        return;
      }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9 && watchlist[num - 1]) { setSymbol(watchlist[num - 1].symbol); return; }
      if (e.key === 'j' || e.key === 'k') {
        if (activePanelId) {
          const el = document.querySelector(`[data-panel-scroll="${activePanelId}"]`) as HTMLElement | null;
          if (el) { el.scrollTop += e.key === 'j' ? 40 : -40; }
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [watchlist, layout, activePanelId, inputRef, setSymbol, setActivePanelId, removePanel, setContextMenu, selectedArticle, setSelectedArticle, setCommand, setLastAction]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-panel]')) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, targetPanelId: null });
      }}
    >
      <CommandBar />
      <BreakingNewsBanner onOpenArticle={(url) => setSelectedArticle(url)} />
      <MarketPulse />
      <FunctionKeys />
      <div data-tiling-root style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <TilingManager />
      </div>
      <StatusBar />
      <ContextMenu />
      {dragState && <DragOverlay />}
      <AlertToast />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} onRestartTour={() => { setSettingsOpen(false); setTourOpen(true); }} />}
      {shortcutsOpen && <ShortcutOverlay onClose={() => setShortcutsOpen(false)} />}
      {welcomeOpen && !preferences.onboardingCompleted && (
        <WelcomeModal
          onTour={() => { setWelcomeOpen(false); setTourOpen(true); }}
          onPalette={() => { setWelcomeOpen(false); setShortcutsOpen(true); }}
          onClose={() => setWelcomeOpen(false)}
        />
      )}
      {tourOpen && <GuidedTour onClose={() => setTourOpen(false)} />}
      <SecurityFinderModal
        open={secfOpen}
        onClose={() => setSecfOpen(false)}
        onSelect={(ref) => setSymbol(ref.symbol)}
      />
      <WorkspaceModal
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        currentLayout={layout}
        currentPresetId={activePresetId}
        onLoad={(ws) => { setLayout(ws.layout); if (ws.activePresetId) loadPreset(ws.activePresetId); }}
      />
      <NotificationCenter
        open={notifOpen}
        onOpen={() => setNotifOpen(true)}
        onClose={() => setNotifOpen(false)}
        alerts={alerts}
        onNotificationClick={(n) => { if (n.url) window.open(n.url, '_blank', 'noopener'); }}
      />
    </div>
  );
}

export default function TerminalShell() {
  return (
    <TerminalProvider>
      <TilingProvider>
        <TerminalInner />
      </TilingProvider>
    </TerminalProvider>
  );
}
