import type { TilingNode, PanelType, SplitDirection, LeafNode, SplitNode } from './tiling-types';
import { createDefaultLayout } from './tiling-types';

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function leaf(type: PanelType, label: string): LeafNode {
  return { type: 'leaf', id: uid(), panel: { id: uid(), type, label } };
}
function split(direction: SplitDirection, ratio: number, first: TilingNode, second: TilingNode): SplitNode {
  return { type: 'split', id: uid(), direction, ratio, first, second };
}

export interface LayoutPreset { id: string; name: string; description: string; fn: () => TilingNode; }

function godelLayout(): TilingNode { return createDefaultLayout(); }

function denseLayout(): TilingNode {
  return split('horizontal', 0.35,
    split('vertical', 0.4, leaf('quote-monitor','MONITOR'), leaf('security-description','DESCRIPTION')),
    split('vertical', 0.50,
      split('horizontal', 0.55, leaf('chart','GP'), leaf('news','NEWS')),
      split('horizontal', 0.34,
        split('vertical', 0.50, leaf('fundamentals','FUND'), leaf('economic-calendar','ECO')),
        split('vertical', 0.50, leaf('earnings','EARN'), leaf('analyst-ratings','ANALYST')),
      ),
    ),
  );
}
function traderLayout(): TilingNode {
  return split('horizontal', 0.30, leaf('quote-monitor','MONITOR'),
    split('vertical', 0.60, leaf('chart','GP'), split('horizontal', 0.50, leaf('news','NEWS'), leaf('fundamentals','FUND'))));
}
function newsLayout(): TilingNode {
  return split('horizontal', 0.65, leaf('news','NEWS'),
    split('vertical', 0.33, leaf('market-heatmap','HEATMAP'),
      split('vertical', 0.50, leaf('world-markets','WORLD'), leaf('economic-calendar','ECO'))));
}
function analysisLayout(): TilingNode {
  return split('horizontal', 0.45,
    split('vertical', 0.55, leaf('chart','GP'), leaf('fundamentals','FUND')),
    split('vertical', 0.33, leaf('insider-activity','INSIDER'),
      split('vertical', 0.50, leaf('institutional-holdings','INST'), leaf('sec-filings','SEC'))));
}
function marketsLayout(): TilingNode {
  return split('horizontal', 0.50,
    split('vertical', 0.33, leaf('world-markets','WORLD'), leaf('fx-rates','FX')),
    split('vertical', 0.33, leaf('market-heatmap','HEATMAP'),
      split('vertical', 0.50, leaf('bond-yields','BONDS'), leaf('commodity','COMMOD'))));
}
function screeningLayout(): TilingNode {
  return split('horizontal', 0.50, leaf('stock-screener','SCREEN'),
    split('vertical', 0.33, leaf('market-heatmap','HEATMAP'),
      split('vertical', 0.50, leaf('correlation-risk','CORR'), leaf('social-sentiment','SENT'))));
}
function aiLayout(): TilingNode {
  return split('horizontal', 0.35,
    split('vertical', 0.65, leaf('brain-chat','BRAIN'), leaf('news','NEWS')),
    split('vertical', 0.55, leaf('chart','GP'), leaf('fundamentals','FUND')));
}

// NEW CREATIVE PRESETS FOR STOCK ENTHUSIASTS

function whaleLayout(): TilingNode {
  return split('horizontal', 0.28,
    split('vertical', 0.5, leaf('superinvestor','WHALES'), leaf('congress-trades','CONGRESS')),
    split('vertical', 0.55,
      split('horizontal', 0.6, leaf('chart','GP'), leaf('tape','TAPE')),
      split('horizontal', 0.4, leaf('institutional-holdings','13F'), leaf('insider-activity','INSIDER'))));
}

function flowLayout(): TilingNode {
  return split('horizontal', 0.32,
    leaf('unusual-options','FLOW'),
    split('vertical', 0.5,
      split('horizontal', 0.6, leaf('chart','GP'), leaf('gamma-exposure','GEX')),
      split('horizontal', 0.5, leaf('depth','L2'), leaf('tape','TAPE'))));
}

function fearLayout(): TilingNode {
  return split('horizontal', 0.33,
    split('vertical', 0.5, leaf('fear-greed','FEAR'), leaf('vix-term','VIX TERM')),
    split('vertical', 0.4,
      split('horizontal', 0.5, leaf('market-breadth','BREADTH'), leaf('sector-rotation','SECTORS')),
      split('horizontal', 0.5, leaf('market-heatmap','HEATMAP'), leaf('wsb-trending','WSB'))));
}

function squeezeLayout(): TilingNode {
  return split('horizontal', 0.30,
    split('vertical', 0.5, leaf('movers','MOVERS'), leaf('market-breadth','BREADTH')),
    split('vertical', 0.6,
      split('horizontal', 0.6, leaf('chart','GP'), leaf('depth','L2')),
      split('horizontal', 0.5, leaf('unusual-options','FLOW'), leaf('gamma-exposure','GEX'))));
}

function tapeLayout(): TilingNode {
  return split('horizontal', 0.28,
    leaf('quote-monitor','MONITOR'),
    split('vertical', 0.6,
      split('horizontal', 0.65, leaf('chart','GP'), leaf('tape','TAPE')),
      split('horizontal', 0.5, leaf('depth','L2'), leaf('etf-flows','ETF FLOW'))));
}

function earningsLayout(): TilingNode {
  return split('horizontal', 0.35,
    split('vertical', 0.5, leaf('earnings','EARNINGS'), leaf('seasonality','SEASON')),
    split('vertical', 0.55,
      split('horizontal', 0.6, leaf('chart','GP'), leaf('fundamentals','FUND')),
      split('horizontal', 0.5, leaf('analyst-ratings','ANALYST'), leaf('news','NEWS'))));
}

function fullTapeLayout(): TilingNode {
  return split('horizontal', 0.25,
    leaf('tape','TAPE'),
    split('horizontal', 0.6,
      leaf('chart','GP'),
      split('vertical', 0.5, leaf('depth','L2'), leaf('unusual-options','FLOW'))));
}

function notesLayout(): TilingNode {
  return split('horizontal', 0.32,
    split('vertical', 0.6, leaf('notes','JOURNAL'), leaf('backtest','LAB')),
    split('vertical', 0.6,
      leaf('chart','GP'),
      split('horizontal', 0.5, leaf('fundamentals','FUND'), leaf('seasonality','SEASON'))));
}

function degenLayout(): TilingNode {
  return split('horizontal', 0.5,
    split('vertical', 0.5, leaf('wsb-trending','WSB'), leaf('fear-greed','FEAR')),
    split('vertical', 0.33,
      leaf('movers','MOMO'),
      split('vertical', 0.5, leaf('market-heatmap','HEATMAP'), leaf('etf-flows','FLOW'))));
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'godel', name: 'GODEL', description: 'Sleek 3-column Godel Terminal', fn: godelLayout },
  { id: 'dense', name: 'DENSE', description: 'Maximum information density', fn: denseLayout },
  { id: 'trader', name: 'TRADER', description: 'Classic trader workspace', fn: traderLayout },
  { id: 'whale', name: 'WHALE', description: 'Superinvestors + congress + institutional', fn: whaleLayout },
  { id: 'flow', name: 'FLOW', description: 'Options flow + gamma + tape', fn: flowLayout },
  { id: 'fear', name: 'FEAR', description: 'Fear & Greed + VIX + breadth + WSB', fn: fearLayout },
  { id: 'squeeze', name: 'SQUEEZE', description: 'Squeeze detector: movers + depth + gex', fn: squeezeLayout },
  { id: 'tape', name: 'TAPE', description: 'Tape reading + Level2 + chart', fn: fullTapeLayout },
  { id: 'earnings', name: 'EARN', description: 'Earnings + seasonality + fundamentals', fn: earningsLayout },
  { id: 'notes', name: 'JOURNAL', description: 'Trading journal + backtest lab', fn: notesLayout },
  { id: 'degen', name: 'DEGEN', description: 'WSB + Fear + Movers + Heatmap', fn: degenLayout },
  { id: 'news', name: 'NEWS', description: 'News & macro focus', fn: newsLayout },
  { id: 'analysis', name: 'ANALYSIS', description: 'Deep fundamental analysis', fn: analysisLayout },
  { id: 'markets', name: 'MARKETS', description: 'Global markets overview', fn: marketsLayout },
  { id: 'screening', name: 'SCREEN', description: 'Stock screening workspace', fn: screeningLayout },
  { id: 'ai', name: 'AI', description: 'AI-powered analysis workspace', fn: aiLayout },
];

export const DEFAULT_PRESET_ID = 'godel';

export function getPreset(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id);
}
