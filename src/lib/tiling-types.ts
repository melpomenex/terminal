import type { InstrumentRef } from '@/lib/types/instrument';

export type PanelType = 'quote-monitor' | 'security-description' | 'chart' | 'news' | 'fundamentals' | 'portfolio' | 'fx-rates' | 'commodity' | 'options-chain' | 'economic-calendar' | 'earnings' | 'analyst-ratings' | 'bond-yields' | 'market-heatmap' | 'stock-screener' | 'insider-activity' | 'institutional-holdings' | 'sec-filings' | 'world-markets' | 'correlation-risk' | 'social-sentiment' | 'help' | 'brain-chat' | 'brain-settings' | 'finance-research' | 'ticker-cards'
  | 'fear-greed' | 'market-breadth' | 'tape' | 'depth' | 'unusual-options' | 'gamma-exposure' | 'congress-trades' | 'seasonality' | 'sector-rotation' | 'movers' | 'wsb-trending' | 'vix-term' | 'dividend-calendar' | 'backtest' | 'notes' | 'superinvestor' | 'etf-flows'
  | 'allq' | 'financial-analysis' | 'ratio-analysis' | 'earnings-matrix' | 'transcripts' | 'market-halts' | 'ipo-monitor' | 'dividend-analytics' | 'research-notes' | 'options-valuation' | 'aum' | 'financial-calculator' | 'historical-data' | 'workspace-manager';

/**
 * Bloomberg-style color-link coordination groups. Panels sharing a color
 * broadcast instrument changes to each other; `UNLINKED` panels are
 * independent of every group.
 */
export type LinkGroupColor =
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'MAGENTA'
  | 'CYAN'
  | 'UNLINKED';

export const LINK_GROUP_COLORS: LinkGroupColor[] = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MAGENTA', 'CYAN', 'UNLINKED'];

export const LINK_GROUP_HEX: Record<LinkGroupColor, string | null> = {
  RED: '#ff4d4d',
  YELLOW: '#ffd24d',
  GREEN: '#3ddc84',
  BLUE: '#4d9fff',
  MAGENTA: '#ff4dd2',
  CYAN: '#4df3ff',
  UNLINKED: null,
};

export interface PanelConfig {
  id: string;
  type: PanelType;
  label: string;
  symbolOverride?: string | null;
  /** Per-panel active instrument; falls back to the terminal global when unset. */
  instrument?: InstrumentRef | null;
  /** Color-link coordination group; `UNLINKED` (default) ignores broadcasts. */
  linkGroup?: LinkGroupColor;
  /** Panel-specific local configuration (column sets, filters, sorts…). */
  panelSettings?: Record<string, unknown>;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  type: 'split';
  id: string;
  direction: SplitDirection;
  first: TilingNode;
  second: TilingNode;
  ratio: number;
}

export interface LeafNode {
  type: 'leaf';
  id: string;
  panel: PanelConfig;
}

export type TilingNode = SplitNode | LeafNode;

export function createDefaultLayout(): TilingNode {
  let seq = 0;
  const uid = () => `default-${++seq}`;
  const leaf = (type: PanelType, label: string): LeafNode => ({
    type: 'leaf', id: uid(), panel: { id: uid(), type, label },
  });
  return {
    type: 'split', id: uid(), direction: 'horizontal', ratio: 0.28,
    first: {
      type: 'split', id: uid(), direction: 'vertical', ratio: 0.58,
      first: leaf('quote-monitor', 'MONITOR'),
      second: leaf('security-description', 'DESCRIPTION'),
    },
    second: {
      type: 'split', id: uid(), direction: 'horizontal', ratio: 0.62,
      first: {
        type: 'split', id: uid(), direction: 'vertical', ratio: 0.58,
        first: leaf('chart', 'GP'),
        second: leaf('news', 'NEWS'),
      },
      second: {
        type: 'split', id: uid(), direction: 'vertical', ratio: 0.58,
        first: leaf('options-chain', 'OPTIONS'),
        second: leaf('ticker-cards', 'TICKERS'),
      },
    },
  };
}
