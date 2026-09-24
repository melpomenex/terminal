/** Canonical keyboard shortcut + command registry (also drives the overlay UI). */
export interface ShortcutEntry {
  keys: string;
  label: string;
  category: 'Navigation' | 'Panels' | 'Commands' | 'Data';
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: '⌘K', label: 'Focus command bar', category: 'Navigation' },
  { keys: '?', label: 'Open shortcut & command reference', category: 'Navigation' },
  { keys: 'Tab', label: 'Cycle pane focus', category: 'Navigation' },
  { keys: '⌘H J K L', label: 'Move focus (vim-style)', category: 'Navigation' },
  { keys: '⌘⇧H J K L', label: 'Swap active pane', category: 'Panels' },
  { keys: '⌘⇧← ↑ → ↓', label: 'Resize active split', category: 'Panels' },
  { keys: '⌘M', label: 'Maximize / restore pane', category: 'Panels' },
  { keys: '⌘W', label: 'Close active pane', category: 'Panels' },
  { keys: '⌘B', label: 'Open Brain chat', category: 'Panels' },
  { keys: '⌘E', label: 'Export watchlist CSV', category: 'Data' },
  { keys: '⌘⇧A', label: 'Create price alert', category: 'Data' },
  { keys: 'Esc', label: 'Restore / close overlay', category: 'Navigation' },
  { keys: '1–9', label: 'Select watchlist ticker', category: 'Data' },
  { keys: 'J / K', label: 'Scroll active pane', category: 'Navigation' },
];

/** Representative Bloomberg-style commands (subset of the parser). */
export const COMMANDS: ShortcutEntry[] = [
  { keys: 'DES', label: 'Fundamentals', category: 'Commands' },
  { keys: 'GP <SYM>', label: 'Load chart', category: 'Commands' },
  { keys: 'PRTU', label: 'Portfolio', category: 'Commands' },
  { keys: 'OVME', label: 'Options chain', category: 'Commands' },
  { keys: 'FX', label: 'FX rates', category: 'Commands' },
  { keys: 'CMDTY', label: 'Commodities', category: 'Commands' },
  { keys: 'YCRV', label: 'Yield curve', category: 'Commands' },
  { keys: 'MAP', label: 'Market heatmap', category: 'Commands' },
  { keys: 'WEER', label: 'World markets', category: 'Commands' },
  { keys: 'SCREEN', label: 'Stock screener', category: 'Commands' },
  { keys: 'INSI', label: 'Insider activity', category: 'Commands' },
  { keys: 'FLNG', label: 'SEC filings', category: 'Commands' },
  { keys: 'SENT', label: 'Social sentiment', category: 'Commands' },
  { keys: 'ALERT <SYM> ABOVE/BELOW <price>', label: 'Create alert', category: 'Commands' },
  { keys: 'ADD <qty> <sym> <cost>', label: 'Add position', category: 'Commands' },
  { keys: 'VIEW <name>', label: 'Load layout preset', category: 'Commands' },
  { keys: 'BRAIN', label: 'Brain chat', category: 'Commands' },
  { keys: 'XL', label: 'Export CSV', category: 'Commands' },
];
