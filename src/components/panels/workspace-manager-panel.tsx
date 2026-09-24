'use client';

import { useCallback, useEffect, useState } from 'react';
import { workspaceService, type SavedWorkspace } from '@/lib/workspaces/workspace-service';
import { useTilingContext } from '@/context/tiling-context';

/**
 * WORKSPACES panel — in-pane host for the named-workspace service: list,
 * load, duplicate, rename, delete, set-default, with tree previews. The
 * command bar (WORKSPACE SAVE/LOAD/DELETE) and modal hit the same service.
 */
export default function WorkspaceManagerPanel({ panelId }: { panelId?: string }) {
  const { layout, setLayout, activePresetId, loadPreset } = useTilingContext();
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');

  const refresh = useCallback(async () => {
    setWorkspaces(await workspaceService.list(true));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const flash = (t: string) => { setMessage(t); setTimeout(() => setMessage(null), 2200); };

  const apply = useCallback((ws: SavedWorkspace) => {
    setLayout(ws.layout);
    if (ws.activePresetId) loadPreset(ws.activePresetId);
    flash(`Loaded "${ws.name}"`);
  }, [setLayout, loadPreset]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)', fontSize: 11 }} data-panel-id={panelId}>
      <div style={{ display: 'flex', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-raized)', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>WORKSPACES</span>
        <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="name…" style={{ width: 110, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 9, padding: '1px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
        <button
          onClick={async () => {
            if (!saveName.trim()) return;
            try { await workspaceService.save(saveName, layout, activePresetId); setSaveName(''); await refresh(); flash('Saved'); } catch (e) { flash(e instanceof Error ? e.message : 'failed'); }
          }}
          style={{ fontSize: 9, padding: '1px 10px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}
        >
          SAVE CURRENT
        </button>
        {message && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--positive)' }}>{message}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {workspaces.length === 0 && <div style={{ padding: 14, color: 'var(--text-mute)', fontSize: 10 }}>No saved workspaces. Save the current layout above or run WORKSPACE SAVE &lt;name&gt;.</div>}
        {workspaces.map((ws) => (
          <div key={ws.id} style={{ borderBottom: '1px solid var(--row-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
              <span onClick={() => apply(ws)} style={{ fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}>{ws.name}</span>
              {ws.isDefault && <span style={{ fontSize: 7, color: 'var(--positive)', border: '1px solid var(--positive)', borderRadius: 2, padding: '0 3px' }}>DEFAULT</span>}
              <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>{ws.panelSummary.length} panels · {new Date(ws.updatedAt).toLocaleDateString()}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button onClick={() => apply(ws)} style={{ fontSize: 8, padding: '0 6px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>LOAD</button>
                <button onClick={async () => { await workspaceService.duplicate(ws.name); await refresh(); }} style={{ fontSize: 8, padding: '0 6px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>DUPE</button>
                <button onClick={async () => { await workspaceService.delete(ws.name); await refresh(); }} style={{ fontSize: 8, padding: '0 6px', border: '1px solid var(--negative)', background: 'transparent', color: 'var(--negative)', cursor: 'pointer' }}>DEL</button>
              </span>
            </div>
            <pre style={{ margin: 0, padding: '0 8px 6px 16px', fontFamily: 'var(--font)', fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4, overflow: 'auto' }}>{workspaceService.previewAscii(ws)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
