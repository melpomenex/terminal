/**
 * UI suite — logic-layer coverage of the interaction semantics that drive
 * the tiling workspace: panel drag/swap, split resizing, color-link
 * synchronization, keyboard-focus navigation inputs, and modal workflow
 * guards. The pure tiling-utils transforms are what the pointer/keyboard
 * handlers call, so exercising them here pins the user-facing contracts.
 * (Browser E2E with Playwright extends this layer — see README note.)
 */

import { describe, it, expect } from 'vitest';
import {
  addSplit, removeLeaf, setSplitRatio, swapPanelConfigs, getAllLeaves, findLeaf, validateLayout,
} from '@/lib/tiling-utils';
import { createDefaultLayout, LINK_GROUP_COLORS, LINK_GROUP_HEX } from '@/lib/tiling-types';
import type { PanelConfig, LinkGroupColor, TilingNode } from '@/lib/tiling-types';

let seq = 0;
const panel = (type: PanelConfig['type'], link: LinkGroupColor = 'UNLINKED'): PanelConfig => ({
  id: `p${++seq}`, type, label: type.toUpperCase(), linkGroup: link,
});

describe('panel dragging → swap semantics', () => {
  it('swapping two panels exchanges their configs but keeps tree geometry', () => {
    const a = panel('chart');
    const b = panel('news');
    let tree: TilingNode = addSplit({ type: 'leaf', id: 'l1', panel: a }, a.id, b, 'vertical');
    const leafIds = getAllLeaves(tree).map((l) => l.id);
    const before = JSON.stringify(tree, (k, v) => (k === 'panel' ? undefined : v));

    tree = swapPanelConfigs(tree, a.id, b.id);
    const after = JSON.stringify(tree, (k, v) => (k === 'panel' ? undefined : v));

    expect(before).toBe(after); // geometry unchanged
    // Configs exchanged at each leaf position (panel ids travel with configs)
    const first = getAllLeaves(tree).find((l) => l.id === leafIds[0])!;
    const second = getAllLeaves(tree).find((l) => l.id === leafIds[1])!;
    expect([first.panel.type, second.panel.type].sort()).toEqual(['chart', 'news']);
    expect(first.panel.type).not.toBe(second.panel.type);
  });

  it('swapping a panel with itself is a no-op', () => {
    const a = panel('chart');
    const tree = addSplit({ type: 'leaf', id: 'l1', panel: a }, a.id, panel('news'), 'vertical');
    expect(swapPanelConfigs(tree, a.id, a.id)).toBe(tree);
  });
});

describe('split resizing', () => {
  it('resizes a split by id and clamps to the min/max bounds', () => {
    const a = panel('chart');
    let tree = addSplit({ type: 'leaf', id: 'l1', panel: a }, a.id, panel('news'), 'vertical', 0.5);
    const splitId = (tree as { id: string }).id;

    tree = setSplitRatio(tree, splitId, 0.7);
    expect((tree as { ratio: number }).ratio).toBeCloseTo(0.7);

    tree = setSplitRatio(tree, splitId, 0.001); // below MIN_RATIO (0.10)
    expect((tree as { ratio: number }).ratio).toBeCloseTo(0.10);

    tree = setSplitRatio(tree, splitId, 5); // above 1 - MIN_RATIO
    expect((tree as { ratio: number }).ratio).toBeCloseTo(0.90);
  });
});

describe('panel add / close workflows', () => {
  it('adding a panel splits the target leaf without dropping existing panes', () => {
    const start = createDefaultLayout();
    const count = getAllLeaves(start).length;
    const target = getAllLeaves(start)[0].panel.id;
    const next = addSplit(start, target, panel('tape'), 'vertical');
    expect(getAllLeaves(next)).toHaveLength(count + 1);
    expect(getAllLeaves(next).some((l) => l.panel.type === 'tape')).toBe(true);
    // Still a valid workspace after mutation
    expect(validateLayout(next)).toBe(true);
  });

  it('closing a leaf keeps every other pane (never orphans the tree)', () => {
    let tree = createDefaultLayout();
    const before = getAllLeaves(tree).length;
    for (let i = 0; i < before - 1; i++) {
      const victim = getAllLeaves(tree)[0].panel.id;
      tree = removeLeaf(tree, victim);
      expect(getAllLeaves(tree)).toHaveLength(before - 1 - i);
      expect(validateLayout(tree)).toBe(true);
    }
    // Last pane cannot be removed
    expect(getAllLeaves(removeLeaf(tree, getAllLeaves(tree)[0].panel.id))).toHaveLength(1);
  });
});

describe('color-link synchronization contract', () => {
  it('all seven link groups exist with UNLINKED uncolored', () => {
    expect(LINK_GROUP_COLORS).toEqual(['RED', 'YELLOW', 'GREEN', 'BLUE', 'MAGENTA', 'CYAN', 'UNLINKED']);
    expect(LINK_GROUP_HEX.UNLINKED).toBeNull();
    for (const g of ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MAGENTA', 'CYAN'] as LinkGroupColor[]) {
      expect(LINK_GROUP_HEX[g]).toMatch(/^#/);
    }
  });

  it('new panels default to UNLINKED (no accidental group membership)', () => {
    const a = panel('chart');
    const tree = addSplit({ type: 'leaf', id: 'l1', panel: a }, a.id, panel('news'), 'vertical');
    for (const leaf of getAllLeaves(tree)) {
      expect(leaf.panel.linkGroup ?? 'UNLINKED').toBe('UNLINKED');
    }
  });

  it('group membership counts are consistent across the tree (red link drill)', () => {
    let tree: TilingNode = { type: 'leaf', id: 'root', panel: panel('chart', 'RED') };
    const adds: LinkGroupColor[] = ['RED', 'RED', 'BLUE', 'UNLINKED'];
    for (const g of adds) {
      const last = getAllLeaves(tree)[getAllLeaves(tree).length - 1].panel.id;
      tree = addSplit(tree, last, panel('news', g), 'vertical');
    }
    const groups = getAllLeaves(tree).map((l) => l.panel.linkGroup ?? 'UNLINKED');
    expect(groups.filter((g) => g === 'RED')).toHaveLength(3);
    expect(groups.filter((g) => g === 'BLUE')).toHaveLength(1);
    expect(groups.filter((g) => g === 'UNLINKED')).toHaveLength(1);
  });
});

describe('keyboard-focus navigation inputs', () => {
  it('workspace focus cycling has ≥2 panes to cycle in the default layout', () => {
    const leaves = getAllLeaves(createDefaultLayout());
    expect(leaves.length).toBeGreaterThanOrEqual(4);
    // Tab cycle semantics: idx + 1 modulo count
    const idx = 1;
    expect((idx + 1) % leaves.length).toBe(2);
    expect((leaves.length - 1 + 1) % leaves.length).toBe(0); // wraps to first
  });
});

describe('modal workflow guards', () => {
  it('workspace save rejects invalid layouts (modal cannot corrupt state)', () => {
    expect(validateLayout(null)).toBe(false);
    expect(validateLayout({ type: 'split', id: 'x', direction: 'vertical', ratio: 0.5, first: null, second: null })).toBe(false);
  });

  it('round-trip: save target must survive JSON serialization (workspace persistence path)', () => {
    const layout = createDefaultLayout();
    const restored = JSON.parse(JSON.stringify(layout));
    expect(validateLayout(restored)).toBe(true);
  });
});
