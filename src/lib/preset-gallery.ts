import { LAYOUT_PRESETS, type LayoutPreset } from './preset-layouts';
import type { PanelType } from './tiling-types';
import type { TilingNode } from './tiling-types';

export interface PresetGalleryItem extends LayoutPreset {
  category: 'Trading' | 'Research' | 'Markets' | 'Analysis' | 'AI';
  panelCount: number;
  preview: PanelType[];
}

function describe(node: TilingNode): { count: number; types: PanelType[] } {
  if (node.type === 'leaf') return { count: 1, types: [node.panel.type] };
  const a = describe(node.first);
  const b = describe(node.second);
  return { count: a.count + b.count, types: [...a.types, ...b.types] };
}

const CATEGORIES: Record<string, PresetGalleryItem['category']> = {
  godel: 'Trading',
  dense: 'Research',
  trader: 'Trading',
  news: 'Markets',
  analysis: 'Analysis',
  markets: 'Markets',
  screening: 'Analysis',
  ai: 'AI',
};

/** Curated, restorable layout presets with gallery metadata. */
export const PRESET_GALLERY: PresetGalleryItem[] = LAYOUT_PRESETS.map((p) => {
  const tree = p.fn();
  const { count, types } = describe(tree);
  return { ...p, category: CATEGORIES[p.id] ?? 'Trading', panelCount: count, preview: types };
});
