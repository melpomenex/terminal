/**
 * Named Saved Workspaces service — WORKSPACE SAVE/LOAD/DELETE/LIST backed by
 * the schema-versioned storage manager. Layouts are tiling trees plus panel
 * link-group/instrument state, so a restored workspace reproduces the exact
 * research context (panes, tickers, link colors).
 */

import { storageManager } from '@/lib/persistence/storage-manager';
import type { TilingNode } from '@/lib/tiling-types';
import { validateLayout } from '@/lib/tiling-utils';

export interface SavedWorkspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  layout: TilingNode;
  activePresetId: string | null;
  globalSettings: Record<string, unknown>;
  /** Textual panel-type census for preview thumbnails. */
  panelSummary: string[];
}

export interface WorkspaceServiceEvents {
  onSaved?: (ws: SavedWorkspace) => void;
  onLoaded?: (ws: SavedWorkspace) => void;
  onDeleted?: (id: string) => void;
}

class WorkspaceService {
  private listeners = new Set<WorkspaceServiceEvents>();
  private cache: SavedWorkspace[] | null = null;

  subscribe(events: WorkspaceServiceEvents): () => void {
    this.listeners.add(events);
    return () => this.listeners.delete(events);
  }

  private emit<K extends keyof WorkspaceServiceEvents>(event: K, payload: Parameters<NonNullable<WorkspaceServiceEvents[K]>>[0]): void {
    for (const l of this.listeners) l[event]?.(payload as never);
  }

  async list(force = false): Promise<SavedWorkspace[]> {
    if (this.cache && !force) return this.cache;
    this.cache = await storageManager.load<SavedWorkspace[]>('workspaces', []);
    return this.cache;
  }

  async save(name: string, layout: TilingNode, activePresetId: string | null = null, globalSettings: Record<string, unknown> = {}): Promise<SavedWorkspace> {
    const clean = name.trim().toLowerCase();
    if (!clean) throw new Error('Workspace name required');
    if (!validateLayout(layout)) throw new Error('Invalid layout tree');

    const all = await this.list(true);
    const now = new Date().toISOString();
    const existing = all.find((w) => w.name === clean);
    const ws: SavedWorkspace = {
      id: existing?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ws-${Date.now()}`),
      name: clean,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      isDefault: existing?.isDefault ?? all.length === 0,
      layout,
      activePresetId,
      globalSettings,
      panelSummary: summarizePanels(layout),
    };

    const next = existing ? all.map((w) => (w.id === ws.id ? ws : w)) : [...all, ws];
    this.cache = next;
    await storageManager.save('workspaces', next);
    this.emit('onSaved', ws);
    return ws;
  }

  async load(name: string): Promise<SavedWorkspace> {
    const clean = name.trim().toLowerCase();
    const all = await this.list();
    const ws = all.find((w) => w.name === clean);
    if (!ws) throw new Error(`No saved workspace "${clean}"`);
    this.emit('onLoaded', ws);
    return ws;
  }

  async delete(name: string): Promise<void> {
    const clean = name.trim().toLowerCase();
    const all = await this.list(true);
    const target = all.find((w) => w.name === clean);
    if (!target) throw new Error(`No saved workspace "${clean}"`);
    const next = all.filter((w) => w.id !== target.id);
    // Keep exactly one default
    if (target.isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
    this.cache = next;
    await storageManager.save('workspaces', next);
    this.emit('onDeleted', target.id);
  }

  async duplicate(name: string): Promise<SavedWorkspace> {
    const source = await this.load(name);
    return this.save(`${source.name}-copy`, source.layout, source.activePresetId, source.globalSettings);
  }

  async rename(oldName: string, newName: string): Promise<void> {
    const all = await this.list(true);
    const target = all.find((w) => w.name === oldName.trim().toLowerCase());
    if (!target) throw new Error(`No saved workspace "${oldName}"`);
    if (all.some((w) => w.name === newName.trim().toLowerCase() && w.id !== target.id)) {
      throw new Error(`Workspace "${newName}" already exists`);
    }
    const next = all.map((w) => (w.id === target.id ? { ...w, name: newName.trim().toLowerCase(), updatedAt: new Date().toISOString() } : w));
    this.cache = next;
    await storageManager.save('workspaces', next);
  }

  async setDefault(name: string): Promise<void> {
    const all = await this.list(true);
    const next = all.map((w) => ({ ...w, isDefault: w.name === name.trim().toLowerCase() }));
    this.cache = next;
    await storageManager.save('workspaces', next);
  }

  /** Layout preview: a compact ASCII map of splits and panel labels. */
  previewAscii(ws: SavedWorkspace): string {
    const lines: string[] = [];
    (function walk(node: TilingNode, depth: number) {
      const pad = '  '.repeat(depth);
      if (node.type === 'leaf') {
        lines.push(`${pad}▪ ${node.panel.label}${node.panel.linkGroup && node.panel.linkGroup !== 'UNLINKED' ? ` [${node.panel.linkGroup}]` : ''}`);
      } else {
        lines.push(`${pad}┬ ${node.direction === 'vertical' ? '│' : '─'} ${(node.ratio * 100).toFixed(0)}%`);
        walk(node.first, depth + 1);
        walk(node.second, depth + 1);
      }
    })(ws.layout, 0);
    return lines.join('\n');
  }
}

function summarizePanels(layout: TilingNode): string[] {
  const out: string[] = [];
  (function walk(node: TilingNode) {
    if (node.type === 'leaf') out.push(node.panel.type);
    else { walk(node.first); walk(node.second); }
  })(layout);
  return out;
}

export const workspaceService = new WorkspaceService();
