import { describe, it, expect } from 'vitest';
import {
  patchPanelsWhere, getAllLeaves, validateLayout, findLeaf,
} from '@/lib/tiling-utils';
import { createDefaultLayout } from '@/lib/tiling-types';
import type { TilingNode, PanelConfig, LinkGroupColor } from '@/lib/tiling-types';
import { makeEquityRef } from '@/lib/types/instrument';

function leaf(id: string, type: PanelConfig['type'], link: LinkGroupColor = 'UNLINKED'): PanelConfig {
  return { id, type, label: id.toUpperCase(), linkGroup: link };
}

function treeOf(...panels: PanelConfig[]): TilingNode {
  if (panels.length === 1) return { type: 'leaf', id: `l-${panels[0].id}`, panel: panels[0] };
  const [first, ...rest] = panels;
  return {
    type: 'split', id: 'root', direction: 'vertical', ratio: 0.5,
    first: { type: 'leaf', id: `l-${first.id}`, panel: first },
    second: treeOf(...rest),
  };
}

describe('color-link reducer (patchPanelsWhere)', () => {
  it('broadcasts an instrument to every panel in the same link group', () => {
    const tree = treeOf(
      leaf('a', 'chart', 'GREEN'),
      leaf('b', 'news', 'GREEN'),
      leaf('c', 'options-chain', 'BLUE'),
      leaf('d', 'help', 'UNLINKED'),
    );
    const ref = makeEquityRef('NVDA');
    const next = patchPanelsWhere(tree, (p) => p.linkGroup === 'GREEN', (p) => ({ ...p, instrument: ref }));

    const panels = getAllLeaves(next).map((l) => l.panel);
    expect(panels.find((p) => p.id === 'a')?.instrument?.symbol).toBe('NVDA');
    expect(panels.find((p) => p.id === 'b')?.instrument?.symbol).toBe('NVDA');
    expect(panels.find((p) => p.id === 'c')?.instrument).toBeUndefined();
    expect(panels.find((p) => p.id === 'd')?.instrument).toBeUndefined();
  });

  it('does not mutate the input tree (pure reducer)', () => {
    const tree = treeOf(leaf('a', 'chart', 'RED'), leaf('b', 'news', 'RED'));
    const before = JSON.stringify(tree);
    patchPanelsWhere(tree, (p) => p.linkGroup === 'RED', (p) => ({ ...p, instrument: makeEquityRef('TSLA') }));
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('isolates groups: RED broadcast never touches CYAN', () => {
    const tree = treeOf(leaf('r1', 'chart', 'RED'), leaf('c1', 'news', 'CYAN'));
    const next = patchPanelsWhere(tree, (p) => p.linkGroup === 'RED', (p) => ({ ...p, instrument: makeEquityRef('A') }));
    expect(findLeaf(next, 'c1')?.panel.instrument).toBeUndefined();
  });

  it('updates exactly one panel when the predicate is an id (unlinked panel)', () => {
    const tree = treeOf(leaf('a', 'chart', 'UNLINKED'), leaf('b', 'news', 'UNLINKED'));
    const next = patchPanelsWhere(tree, (p) => p.id === 'b', (p) => ({ ...p, instrument: makeEquityRef('MSFT') }));
    expect(findLeaf(next, 'a')?.panel.instrument).toBeUndefined();
    expect(findLeaf(next, 'b')?.panel.instrument?.symbol).toBe('MSFT');
  });

  it('joining a group adopts the group instrument (link semantics)', () => {
    const tree = treeOf(leaf('a', 'chart', 'GREEN'), leaf('b', 'news', 'UNLINKED'));
    // Simulate setPanelLinkGroup adopt: first panel in group carries NVDA
    const withInstrument = patchPanelsWhere(tree, (p) => p.id === 'a', (p) => ({ ...p, instrument: makeEquityRef('NVDA') }));
    const joined = patchPanelsWhere(withInstrument, (p) => p.id === 'b', (p) => ({ ...p, linkGroup: 'GREEN', instrument: findLeaf(withInstrument, 'a')?.panel.instrument }));
    expect(findLeaf(joined, 'b')?.panel.linkGroup).toBe('GREEN');
    expect(findLeaf(joined, 'b')?.panel.instrument?.symbol).toBe('NVDA');
  });
});

describe('layout validation (used before workspace save/restore)', () => {
  it('accepts the default layout', () => {
    expect(validateLayout(createDefaultLayout())).toBe(true);
  });

  it('rejects malformed nodes', () => {
    expect(validateLayout(null)).toBe(false);
    expect(validateLayout({})).toBe(false);
    expect(validateLayout({ type: 'leaf' })).toBe(false);
    expect(validateLayout({ type: 'split', id: 'x', direction: 'diagonal', ratio: 0.5, first: {}, second: {} })).toBe(false);
  });
});
