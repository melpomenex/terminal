'use client';
import { useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { useTilingContext } from '@/context/tiling-context';
import { LAYOUT_PRESETS } from '@/lib/preset-layouts';
import Tooltip from './tooltip';

interface FKey { label: string; bg: string; title: string; shortcut?: string; action?: () => void; }

export default function FunctionKeys() {
  const { watchlistKey, setWatchlistKey, setLastAction, customWatchlists, addCustomWatchlist } = useTerminalContext();
  const { activePresetId, loadPreset } = useTilingContext();
  const [showPresets, setShowPresets] = useState(false);
  const active = 'var(--accent-dim)';
  const toggled = 'var(--accent-dim)';

  const row1: FKey[] = [
    { label: 'CANCEL', bg: 'var(--fn-cancel)', title: 'Cancel' },
    { label: 'GO', bg: 'var(--fn-go)', title: 'Execute (Enter)', shortcut: 'Enter' },
    { label: 'HELP', bg: 'var(--fn-go)', title: 'Help & shortcuts', shortcut: '?', action: () => setLastAction('open:shortcuts') },
    { label: 'VIEWS ▾', bg: showPresets ? toggled : 'var(--fn-purple)', title: 'Layout presets', action: () => setShowPresets((v) => !v) },
    { label: 'DEFAULT', bg: watchlistKey === 'DEFAULT' ? active : 'var(--fn-yellow)', title: 'Default watchlist', action: () => setWatchlistKey('DEFAULT') },
    { label: 'SECTORS', bg: watchlistKey === 'SECTORS' ? active : 'var(--fn-yellow)', title: 'Sector ETFs', action: () => setWatchlistKey('SECTORS') },
    { label: 'INDEXES', bg: watchlistKey === 'INDEXES' ? active : 'var(--fn-yellow)', title: 'Index ETFs', action: () => setWatchlistKey('INDEXES') },
    { label: 'GOVT', bg: 'var(--fn-yellow)', title: 'Bonds', action: () => setLastAction('open:bond-yields') },
    { label: 'CMDTY', bg: 'var(--fn-yellow)', title: 'Commodities', action: () => setLastAction('open:commodity') },
    { label: 'MAP', bg: 'var(--fn-yellow)', title: 'Heatmap', action: () => setLastAction('open:market-heatmap') },
    { label: 'MOVERS', bg: 'var(--fn-yellow)', title: 'Gainers/losers', action: () => setLastAction('open:movers') },
  ];

  const row2: FKey[] = [
    { label: 'FLOW', bg: 'var(--fn-yellow)', title: 'Unusual Options Flow', action: () => setLastAction('open:unusual-options') },
    { label: 'GEX', bg: 'var(--fn-yellow)', title: 'Gamma Exposure', action: () => setLastAction('open:gamma-exposure') },
    { label: 'TAPE', bg: 'var(--fn-yellow)', title: 'Time & Sales', action: () => setLastAction('open:tape') },
    { label: 'L2', bg: 'var(--fn-yellow)', title: 'Level 2 Depth', action: () => setLastAction('open:depth') },
    { label: 'FEAR', bg: 'var(--fn-yellow)', title: 'Fear & Greed', action: () => setLastAction('open:fear-greed') },
    { label: 'BREADTH', bg: 'var(--fn-yellow)', title: 'Market Breadth', action: () => setLastAction('open:market-breadth') },
    { label: 'SECTORS', bg: 'var(--fn-yellow)', title: 'Sector Rotation', action: () => setLastAction('open:sector-rotation') },
    { label: 'VIX', bg: 'var(--fn-yellow)', title: 'VIX Term Structure', action: () => setLastAction('open:vix-term') },
    { label: 'CONGRESS', bg: 'var(--fn-yellow)', title: 'Congress Trades', action: () => setLastAction('open:congress-trades') },
    { label: 'WHALE', bg: 'var(--fn-yellow)', title: 'Superinvestors', action: () => setLastAction('open:superinvestor') },
    { label: 'WSB', bg: 'var(--fn-yellow)', title: 'WSB Trending', action: () => setLastAction('open:wsb-trending') },
    { label: 'NOTES', bg: 'var(--fn-yellow)', title: 'Journal', action: () => setLastAction('open:notes') },
    { label: 'LAB', bg: 'var(--fn-yellow)', title: 'Backtest Lab', action: () => setLastAction('open:backtest') },
  ];

  const customKeys: FKey[] = customWatchlists.map((wl) => ({
    label: wl.name,
    bg: watchlistKey === wl.name ? active : 'var(--fn-yellow)',
    title: `Watchlist: ${wl.name}`,
    action: () => setWatchlistKey(wl.name),
  }));

  const addKey: FKey = {
    label: '+', bg: 'var(--fn-yellow)', title: 'New watchlist',
    action: () => { const n = customWatchlists.length + 1; addCustomWatchlist(`CUSTOM ${n}`); },
  };

  const allKeysRow1 = [...row1, ...customKeys, addKey];
  const allKeysRow2 = row2;

  const renderRow = (keys:FKey[], rowId:string) => (
    <div key={rowId} style={{ display: 'flex', height: 20, gap: 1, padding: '0 4px', alignItems: 'center', flexWrap: 'nowrap', overflowX:'auto', scrollbarWidth:'none' }}>
      {keys.map((k) => (
        <Tooltip key={`${rowId}-${k.label}`} label={k.title} shortcut={k.shortcut} side="bottom">
          <button onClick={() => k.action?.()} className="row-hover" style={{ background: k.bg, color: 'var(--text-bright)', fontSize: 10, fontWeight: 700, padding: '0 6px', height: 16, letterSpacing: 0.5, flexShrink: 0, borderRadius:1 }}>
            {k.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );

  return (
    <div data-tour="function-keys" style={{ display: 'flex', flexDirection:'column', borderBottom: '1px solid var(--border)', gap:0, position:'relative', background:'var(--panel-bg)' }}>
      {renderRow(allKeysRow1, 'r1')}
      {renderRow(allKeysRow2, 'r2')}
      {showPresets && (
        <div className="overlay-enter" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 'var(--z-dropdown)', background: 'var(--panel-bg)', border: '1px solid var(--border)', display: 'flex', flexWrap:'wrap', gap: 2, padding: '6px', maxWidth: 600 }}>
          {LAYOUT_PRESETS.map((preset) => (
            <button key={preset.id} onClick={() => { loadPreset(preset.id); setShowPresets(false); }} title={preset.description} className="row-hover" style={{ background: activePresetId === preset.id ? active : 'var(--fn-yellow)', color: 'var(--text-bright)', fontSize: 10, fontWeight: 700, padding: '2px 10px', height: 22, letterSpacing: 0.5, flexShrink: 0, borderRadius:2 }}>
              {preset.name} <span style={{fontSize:8,color:'var(--text-dim)',fontWeight:400,marginLeft:4}}>{preset.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
