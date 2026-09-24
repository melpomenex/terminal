import type { TilingNode, LeafNode, PanelConfig, SplitDirection, SplitNode } from './tiling-types';

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MIN_RATIO = 0.10;

export function findLeaf(node: TilingNode, panelId: string): LeafNode | null {
  if (node.type === 'leaf') return node.panel.id === panelId ? node : null;
  return findLeaf(node.first, panelId) ?? findLeaf(node.second, panelId);
}

export function getAllLeaves(node: TilingNode): LeafNode[] {
  if (node.type === 'leaf') return [node];
  return [...getAllLeaves(node.first), ...getAllLeaves(node.second)];
}

export function findParentOfLeaf(root: TilingNode, leafId: string): { parent: SplitNode; side: 'first' | 'second' } | null {
  if (root.type === 'leaf') return null;
  if ((root.first.type === 'leaf' && root.first.panel.id === leafId) || root.first.id === leafId)
    return { parent: root, side: 'first' };
  if ((root.second.type === 'leaf' && root.second.panel.id === leafId) || root.second.id === leafId)
    return { parent: root, side: 'second' };
  return findParentOfLeaf(root.first, leafId) ?? findParentOfLeaf(root.second, leafId);
}

export function removeLeaf(root: TilingNode, leafPanelId: string): TilingNode {
  const leaves = getAllLeaves(root);
  if (leaves.length <= 1) return root;

  const info = findParentOfLeaf(root, leafPanelId);
  if (!info) return root;

  const sibling = info.side === 'first' ? info.parent.second : info.parent.first;

  if (root.id === info.parent.id) return sibling;
  return replaceInTree(root, info.parent.id, sibling);
}

function replaceInTree(node: TilingNode, targetId: string, replacement: TilingNode): TilingNode {
  if (node.type === 'leaf') return node;
  if (node.id === targetId) return replacement;
  return {
    ...node,
    first: replaceInTree(node.first, targetId, replacement),
    second: replaceInTree(node.second, targetId, replacement),
  };
}

export function addSplit(
  root: TilingNode,
  targetPanelId: string,
  newPanel: PanelConfig,
  direction: SplitDirection,
  ratio: number = 0.5
): TilingNode {
  const newLeaf: LeafNode = { type: 'leaf', id: uid(), panel: newPanel };

  function transform(node: TilingNode): TilingNode {
    if (node.type !== 'leaf') {
      return { ...node, first: transform(node.first), second: transform(node.second) };
    }
    if (node.panel.id !== targetPanelId) return node;
    return {
      type: 'split',
      id: uid(),
      direction,
      ratio,
      first: direction === 'vertical' ? node : newLeaf,
      second: direction === 'vertical' ? newLeaf : node,
    };
  }
  return transform(root);
}

export function setSplitRatio(root: TilingNode, splitId: string, newRatio: number): TilingNode {
  const clamped = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, newRatio));
  if (root.type === 'leaf') return root;
  if (root.id === splitId) return { ...root, ratio: clamped };
  return {
    ...root,
    first: setSplitRatio(root.first, splitId, clamped),
    second: setSplitRatio(root.second, splitId, clamped),
  };
}

export function swapPanelConfigs(root: TilingNode, panelAId: string, panelBId: string): TilingNode {
  if (panelAId === panelBId) return root;
  const leafA = findLeaf(root, panelAId);
  const leafB = findLeaf(root, panelBId);
  if (!leafA || !leafB) return root;
  const configA = leafA.panel;
  const configB = leafB.panel;
  // Single pass: after the first leaf receives configB it carries panelBId,
  // so a second id-based pass would re-swap it (and, when both targets
  // matched, duplicate one config and destroy the other). Visit each leaf
  // exactly once.
  const swapOnce = (node: TilingNode): TilingNode => {
    if (node.type === 'split') {
      return { ...node, first: swapOnce(node.first), second: swapOnce(node.second) };
    }
    if (node.panel.id === panelAId) return { ...node, panel: configB };
    if (node.panel.id === panelBId) return { ...node, panel: configA };
    return node;
  };
  return swapOnce(root);
}

function updatePanelConfig(root: TilingNode, panelId: string, config: PanelConfig): TilingNode {
  if (root.type === 'leaf')
    return root.panel.id === panelId ? { ...root, panel: config } : root;
  return {
    ...root,
    first: updatePanelConfig(root.first, panelId, config),
    second: updatePanelConfig(root.second, panelId, config),
  };
}

/**
 * Immutably patch every leaf panel matching `predicate` with `patch`.
 * Used by the color-link event bus to fan instrument changes across a group
 * in a single pure reducer pass.
 */
export function patchPanelsWhere(
  root: TilingNode,
  predicate: (panel: PanelConfig) => boolean,
  patch: (panel: PanelConfig) => PanelConfig,
): TilingNode {
  if (root.type === 'leaf') {
    return predicate(root.panel) ? { ...root, panel: patch(root.panel) } : root;
  }
  return {
    ...root,
    first: patchPanelsWhere(root.first, predicate, patch),
    second: patchPanelsWhere(root.second, predicate, patch),
  };
}

export function updatePanelSettings(root: TilingNode, panelId: string, settings: Record<string, unknown>): TilingNode {
  return updatePanelConfig(root, panelId, {
    ...((findLeaf(root, panelId)?.panel ?? { id: panelId }) as PanelConfig),
    panelSettings: settings,
  } as PanelConfig);
}

export type NavDirection = 'left' | 'right' | 'up' | 'down';

export function findNeighborByDirection(activePanelId: string, direction: NavDirection): string | null {
  const panels = document.querySelectorAll<HTMLElement>('[data-panel]');
  if (panels.length <= 1) return null;

  let activeRect: DOMRect | undefined;
  const panelRects: { el: HTMLElement; id: string; cx: number; cy: number }[] = [];

  panels.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const id = el.dataset.panel ?? '';
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    panelRects.push({ el, id, cx, cy });
    if (id === activePanelId) { activeRect = rect; }
  });

  if (!activeRect) return null;
  const ax = activeRect.left + activeRect.width / 2;
  const ay = activeRect.top + activeRect.height / 2;

  let best: { id: string; dist: number } | null = null;
  for (const p of panelRects) {
    if (p.id === activePanelId) continue;
    const dx = p.cx - ax;
    const dy = p.cy - ay;
    const inDir = direction === 'left' ? dx < 0
      : direction === 'right' ? dx > 0
      : direction === 'up' ? dy < 0
      : dy > 0;
    if (!inDir) continue;
    const primaryDist = Math.abs(direction === 'left' || direction === 'right' ? dx : dy);
    const perpDist = Math.abs(direction === 'left' || direction === 'right' ? dy : dx);
    const score = primaryDist + perpDist * 2;
    if (!best || score < best.dist) best = { id: p.id, dist: score };
  }
  return best?.id ?? null;
}

export function findParentSplit(root: TilingNode, panelId: string): { splitId: string; side: 'first' | 'second' } | null {
  const result = findParentOfLeaf(root, panelId);
  if (!result) return null;
  return { splitId: result.parent.id, side: result.side };
}

export function validateLayout(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n.type === 'leaf') {
    return typeof n.id === 'string' && !!n.panel && typeof (n.panel as Record<string, unknown>).type === 'string';
  }
  if (n.type === 'split') {
    return typeof n.id === 'string'
      && (n.direction === 'horizontal' || n.direction === 'vertical')
      && typeof n.ratio === 'number'
      && !!validateLayout(n.first)
      && !!validateLayout(n.second);
  }
  return false;
}
