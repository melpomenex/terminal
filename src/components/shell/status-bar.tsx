'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { useTilingContext } from '@/context/tiling-context';
import { getUsSessionPhase, sessionLabel } from '@/lib/market-hours';
import type { TilingNode } from '@/lib/tiling-types';

interface Workspace {
  id: string;
  name: string;
  layout: TilingNode;
}

const WS_KEY = 'blm_workspaces_v1';
const ACTIVE_WS_KEY = 'blm_active_workspace';

function loadWorkspaces(): Workspace[] {
  if (typeof window === 'undefined') return [{ id: 'main', name: 'Main', layout: {} as TilingNode }];
  try {
    const raw = JSON.parse(localStorage.getItem(WS_KEY) || '[]') as Workspace[];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((w) => w && w.id && w.name);
    }
  } catch {}
  return [{ id: 'main', name: 'Main', layout: {} as TilingNode }];
}

export default function StatusBar() {
  const { time, news, setSelectedArticle } = useTerminalContext();
  const { layout, setLayout } = useTilingContext();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspaces());
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'main';
    return localStorage.getItem(ACTIVE_WS_KEY) || 'main';
  });
  const [phase, setPhase] = useState(getUsSessionPhase());

  useEffect(() => {
    const id = setInterval(() => setPhase(getUsSessionPhase()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Persist active workspace layout when tiling changes
  useEffect(() => {
    if (!layout || !(layout as TilingNode).type) return;
    setWorkspaces((prev) => {
      const next = prev.map((w) => (w.id === activeId ? { ...w, layout } : w));
      try { localStorage.setItem(WS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [layout, activeId]);

  const switchWorkspace = useCallback((id: string) => {
    if (id === activeId) return;
    setWorkspaces((prev) => {
      const snapshotted = prev.map((w) => (w.id === activeId ? { ...w, layout } : w));
      const target = snapshotted.find((w) => w.id === id);
      if (target?.layout && (target.layout as TilingNode).type) {
        setLayout(target.layout);
      }
      try {
        localStorage.setItem(WS_KEY, JSON.stringify(snapshotted));
        localStorage.setItem(ACTIVE_WS_KEY, id);
      } catch {}
      return snapshotted;
    });
    setActiveId(id);
  }, [activeId, layout, setLayout]);

  const addWorkspace = useCallback(() => {
    const n = workspaces.length + 1;
    const id = `ws-${Date.now()}`;
    const name = `Screen ${n}`;
    // Snapshot current before creating new
    setWorkspaces((prev) => {
      const snapshotted = prev.map((w) => (w.id === activeId ? { ...w, layout } : w));
      const next = [...snapshotted, { id, name, layout }];
      try {
        localStorage.setItem(WS_KEY, JSON.stringify(next));
        localStorage.setItem(ACTIVE_WS_KEY, id);
      } catch {}
      return next;
    });
    setActiveId(id);
  }, [workspaces.length, activeId, layout]);

  const renameWorkspace = useCallback((id: string) => {
    const current = workspaces.find((w) => w.id === id);
    if (!current) return;
    const name = window.prompt('Rename workspace', current.name);
    if (!name?.trim()) return;
    setWorkspaces((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, name: name.trim().slice(0, 16) } : w));
      try { localStorage.setItem(WS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [workspaces]);

  const removeWorkspace = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return;
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id);
      const fallback = next[0];
      if (id === activeId && fallback) {
        if (fallback.layout) setLayout(fallback.layout);
        setActiveId(fallback.id);
        try { localStorage.setItem(ACTIVE_WS_KEY, fallback.id); } catch {}
      }
      try { localStorage.setItem(WS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [workspaces.length, activeId, setLayout]);

  const [alertCount,setAlertCount]=useState(0);
  const [fngMini,setFngMini]=useState<number|null>(null);
  const [breadthMini,setBreadthMini]=useState<string>('');
  const [vixMini,setVixMini]=useState<number|null>(null);
  useEffect(()=>{
    const load=async()=>{
      try { const r=await fetch('/api/yfin/fear-greed'); const j=await r.json(); setFngMini(j.score??null); } catch {}
      try { const r=await fetch('/api/yfin/market-breadth'); const j=await r.json(); setBreadthMini(`${j.advances||0}/${j.declines||0}`); } catch {}
      try { const r=await fetch('/api/yfin/watchlist?symbols=%5EVIX'); const j=await r.json(); setVixMini(j.items?.[0]?.price??null); } catch {}
      try { const raw = localStorage.getItem('blm_alerts'); if(raw){ const alerts=JSON.parse(raw); setAlertCount(alerts.filter((a:any)=>!a.triggered).length); } } catch {}
    };
    load();
    const id=setInterval(load,60000);
    return ()=>clearInterval(id);
  },[]);

  const headlines = news.length > 0
    ? news.slice(0, 12).map((n) => {
        const src = n.source ? `[${n.source}] ` : '';
        return `${src}${n.title}`;
      })
    : ['QUBE TERMINAL v2.0 — FEAR & GREED · FLOW · TAPE · WHALES · CONGRESS · WSB · GEX · SECTOR ROTATION · BACKTEST LAB · JOURNAL · ^VIX · A/D BREADTH · CUSTOM LAYOUTS — TYPE TICKER OR COMMAND (⌘K)'];

  const marqueeText = headlines.map((t) => `★  ${t}  `).join('  ·  ');

  const phaseColor =
    phase === 'open' ? 'var(--positive)' :
    phase === 'pre' || phase === 'after' ? 'var(--amber-bright)' :
    'var(--text-mute)';

  return (
    <div style={{
      height: 24,
      background: 'var(--surface-raised)',
      borderTop: '1px solid var(--border-soft)',
      display: 'flex',
      alignItems: 'center',
      fontSize: 'var(--font-size-xs)',
      userSelect: 'none',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    }}>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Workspace tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        background: 'var(--surface-sunken)',
        borderRight: '1px solid var(--border-soft)',
        flexShrink: 0,
        maxWidth: 320,
        overflowX: 'auto',
      }}>
        {workspaces.map((w) => {
          const isActive = w.id === activeId;
          return (
            <button
              key={w.id}
              onClick={() => switchWorkspace(w.id)}
              onDoubleClick={() => renameWorkspace(w.id)}
              title="Double-click to rename · Middle-click to close"
              onMouseDown={(e) => {
                if (e.button === 1) removeWorkspace(w.id, e);
              }}
              className="row-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: '100%',
                padding: '0 10px',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderRight: '1px solid var(--border-soft)',
                color: isActive ? 'var(--accent)' : 'var(--text-mute)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                letterSpacing: 0.3,
                flexShrink: 0,
              }}
            >
              <span className={isActive ? 'glow' : undefined}>{w.name}</span>
              {workspaces.length > 1 && (
                <span
                  onClick={(e) => removeWorkspace(w.id, e)}
                  style={{
                    color: 'var(--text-faint)',
                    fontSize: 9,
                    marginLeft: 2,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                  title="Close workspace"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={addWorkspace}
          className="row-hover"
          title="New workspace (screen)"
          style={{
            color: 'var(--text-mute)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold',
            padding: '0 8px',
            height: '100%',
            fontFamily: 'var(--font)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-bright)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-mute)'; }}
        >
          +
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRight: '1px solid var(--border-soft)', flexShrink: 0, height: '100%', background:'var(--surface-sunken)' }}>
        <span style={{ color: phaseColor, fontWeight: 700, fontSize: 9 }}>{sessionLabel(phase)}</span>
        <span style={{ color: 'var(--text-bright)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize:11 }}>{time}</span>
        <span style={{ display:'flex', gap:4, alignItems:'center', marginLeft:6 }}>
          {vixMini!=null && <span style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',padding:'0 4px',borderRadius:2,fontSize:9}}><span style={{color:'var(--text-dim)'}}>VIX</span> <span style={{color: (vixMini>25?'var(--negative)':vixMini>18?'var(--amber-bright)':'var(--positive)'),fontWeight:700}}>{vixMini.toFixed(2)}</span></span>}
          {fngMini!=null && <span style={{background:'var(--surface-raised)',border:`1px solid ${fngMini<25?'#ef4444':fngMini<45?'#f97316':fngMini<55?'#eab308':fngMini<75?'#22c55e':'#10b981'}`,padding:'0 4px',borderRadius:2,fontSize:9}}><span style={{color:'var(--text-dim)'}}>F&G</span> <span style={{color: fngMini<25?'#ef4444':fngMini<45?'#f97316':fngMini<55?'#eab308':fngMini<75?'#22c55e':'#10b981',fontWeight:700}}>{fngMini}</span></span>}
          {breadthMini && <span style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',padding:'0 4px',borderRadius:2,fontSize:9}}><span style={{color:'var(--text-dim)'}}>A/D</span> <span style={{color:'var(--text-bright)',fontWeight:700}}>{breadthMini}</span></span>}
          {alertCount>0 && <span style={{background:'var(--negative-soft)',border:'1px solid var(--negative)',padding:'0 4px',borderRadius:2,fontSize:9,color:'var(--negative)',fontWeight:700}}>{alertCount} ALERTS</span>}
        </span>
        <span style={{ background: 'var(--surface-sunken)', color: 'var(--text-dim)', border: '1px solid var(--border-soft)', fontSize: 8, padding: '1px 4px', borderRadius: 2, fontWeight: 700 }}>v2.0</span>
      </div>

      {/* Live news marquee */}
      <div
        style={{
          height: '100%',
          background: news.length > 0 ? 'var(--negative)' : 'var(--surface-sunken)',
          color: 'var(--text-bright)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          flex: 1,
          minWidth: 0,
          fontWeight: 700,
          fontFamily: 'var(--font)',
          cursor: news[0]?.link ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (news[0]?.link) setSelectedArticle(news[0].link);
        }}
        title={news[0] ? `Click to open: ${news[0].title}` : undefined}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          willChange: 'transform',
          animation: 'marquee 45s linear infinite',
          paddingLeft: '100%',
        }}>
          <span style={{ paddingRight: 80 }}>
            {time} · {marqueeText}
          </span>
          <span>
            {time} · {marqueeText}
          </span>
        </div>
      </div>
    </div>
  );
}
