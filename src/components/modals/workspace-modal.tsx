'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { workspaceService, type SavedWorkspace } from '@/lib/workspaces/workspace-service';
import { downloadBackup, storageManager } from '@/lib/persistence/storage-manager';

interface WorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  onLoad: (ws: SavedWorkspace) => void;
  /** Current live layout, used for SAVE and thumbnails comparison. */
  currentLayout: SavedWorkspace['layout'];
  currentPresetId: string | null;
}

/**
 * Workspace manager modal: saved-layout list with ASCII tree previews,
 * load / duplicate / rename / delete / set-default, plus JSON backup
 * export/import through the persistence manager.
 */
export default function WorkspaceModal({ open, onClose, onLoad, currentLayout, currentPresetId }: WorkspaceModalProps) {
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const list = await workspaceService.list(true);
    setWorkspaces(list);
    setSelected((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (open) { void refresh(); setMessage(null); }
  }, [open, refresh]);

  const selectedWs = useMemo(() => workspaces.find((w) => w.id === selected) ?? null, [workspaces, selected]);

  const flash = (text: string, error = false) => { setMessage({ text, error }); setTimeout(() => setMessage(null), 2600); };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setBusy(true);
    try {
      await workspaceService.save(saveName, currentLayout, currentPresetId);
      setSaveName('');
      await refresh();
      flash(`Saved "${saveName.trim().toLowerCase()}"`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'save failed', true);
    } finally { setBusy(false); }
  };

  const handleExport = async () => {
    const bundle = await storageManager.exportBackup();
    downloadBackup(bundle);
    flash('Backup downloaded');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const bundle = JSON.parse(String(reader.result));
        const result = await storageManager.importBackup(bundle);
        await refresh();
        flash(`Imported ${result.imported.length} collections${result.migrated ? ' (migrated)' : ''}`);
      } catch {
        flash('Import failed — not a valid backup', true);
      }
    };
    reader.readAsText(file);
  };

  if (!open) return null;

  return (
    <div
      className="fade-enter"
      role="dialog"
      aria-label="Workspace manager"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
    >
      <div className="overlay-enter" style={{ width: 'min(760px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, fontSize: 12 }}>WORKSPACES</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{workspaces.length} saved</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={handleExport} style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>EXPORT BACKUP</button>
            <label style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>
              IMPORT
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
            </label>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        </div>

        {/* Save row */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border-soft)' }}>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
            placeholder="save current layout as…"
            style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 11, padding: '4px 8px', fontFamily: 'var(--font)', outline: 'none' }}
          />
          <button onClick={handleSave} disabled={busy || !saveName.trim()} style={{ fontSize: 10, padding: '4px 12px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font)', opacity: busy || !saveName.trim() ? 0.5 : 1 }}>SAVE</button>
        </div>

        {message && (
          <div style={{ padding: '4px 14px', fontSize: 10, color: message.error ? 'var(--negative)' : 'var(--positive)' }}>{message.text}</div>
        )}

        {/* Body: list + preview */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 250, borderRight: '1px solid var(--border-soft)', overflowY: 'auto' }}>
            {workspaces.length === 0 && <div style={{ padding: 14, color: 'var(--text-mute)', fontSize: 10 }}>No saved workspaces yet — save one above or run WORKSPACE SAVE &lt;name&gt;.</div>}
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => setSelected(ws.id)}
                className="row-hover"
                style={{ padding: '6px 10px', cursor: 'pointer', background: selected === ws.id ? 'var(--accent-soft)' : 'transparent', borderBottom: '1px solid var(--row-divider)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: selected === ws.id ? 'var(--accent)' : 'var(--text-bright)', fontSize: 11 }}>{ws.name}</span>
                  {ws.isDefault && <span style={{ fontSize: 7, color: 'var(--positive)', border: '1px solid var(--positive)', borderRadius: 2, padding: '0 3px' }}>DEFAULT</span>}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 1 }}>
                  {ws.panelSummary.length} panels · updated {new Date(ws.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selectedWs ? (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                  <button onClick={() => { onLoad(selectedWs); onClose(); }} style={{ fontSize: 9, padding: '2px 10px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>LOAD</button>
                  <button onClick={async () => { try { await workspaceService.duplicate(selectedWs.name); await refresh(); flash('Duplicated'); } catch (e) { flash(e instanceof Error ? e.message : 'failed', true); } }} style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>DUPLICATE</button>
                  <button onClick={() => { setRenaming(selectedWs.name); setRenameValue(selectedWs.name); }} style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>RENAME</button>
                  <button onClick={async () => { try { await workspaceService.setDefault(selectedWs.name); await refresh(); flash('Default set'); } catch (e) { flash(e instanceof Error ? e.message : 'failed', true); } }} style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-dim)', borderRadius: 2, cursor: 'pointer' }}>SET DEFAULT</button>
                  <button onClick={async () => { try { await workspaceService.delete(selectedWs.name); await refresh(); setSelected(null); flash('Deleted'); } catch (e) { flash(e instanceof Error ? e.message : 'failed', true); } }} style={{ fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--negative)', color: 'var(--negative)', borderRadius: 2, cursor: 'pointer' }}>DELETE</button>
                </div>

                {renaming === selectedWs.name && (
                  <div style={{ padding: '6px 12px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border-soft)' }}>
                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 2, color: 'var(--text-bright)', fontSize: 10, padding: '2px 6px', fontFamily: 'var(--font)', outline: 'none' }} />
                    <button onClick={async () => { try { await workspaceService.rename(selectedWs.name, renameValue); setRenaming(null); await refresh(); } catch (e) { flash(e instanceof Error ? e.message : 'failed', true); } }} style={{ fontSize: 9, padding: '2px 8px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 2, cursor: 'pointer' }}>OK</button>
                  </div>
                )}

                {/* Layout preview thumbnail */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>LAYOUT PREVIEW</div>
                  <pre style={{ fontFamily: 'var(--font)', fontSize: 10, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre' }}>{workspaceService.previewAscii(selectedWs)}</pre>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-mute)', fontSize: 10 }}>Select a workspace to preview</div>
            )}
          </div>
        </div>

        <div style={{ padding: '5px 14px', fontSize: 8, color: 'var(--text-faint)', borderTop: '1px solid var(--border-soft)' }}>
          WORKSPACE SAVE/LOAD/DELETE/LIST · WORKSPACE &lt;name&gt; in command bar · backups are schema-versioned JSON
        </div>
      </div>
    </div>
  );
}
