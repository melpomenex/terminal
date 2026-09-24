'use client';
import { useEffect, useRef, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { PULSE_INDICES, TERMINAL_CLOCKS, formatTzTime, getUsSessionPhase, sessionLabel, type SessionPhase } from '@/lib/market-hours';

interface PulseQuote { symbol: string; label: string; price: number | null; changePercent: number | null; }
function formatPulsePrice(price: number | null): string {
  if (price == null) return '---';
  if (Math.abs(price) >= 100_000) return `${(price / 1000).toFixed(0)}K`;
  if (Math.abs(price) >= 10_000) return `${(price / 1000).toFixed(1)}K`;
  if (Math.abs(price) >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return price.toFixed(price < 10 ? 2 : 1);
}

export default function MarketPulse() {
  const { setSymbol, marketOpen, setLastAction } = useTerminalContext();
  const [quotes, setQuotes] = useState<PulseQuote[]>([]);
  const [phase, setPhase] = useState<SessionPhase>('closed');
  const [clocks, setClocks] = useState<Record<string, string>>({});
  const [flashes, setFlashes] = useState<Record<string, 'pos' | 'neg'>>({});
  const [fng,setFng]=useState<any>(null);
  const [breadth,setBreadth]=useState<any>(null);
  const [vix,setVix]=useState<any>(null);
  const [tape,setTape]=useState<any[]>([]);
  const prevPrices = useRef<Record<string, number | null>>({});

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setPhase(getUsSessionPhase(now));
      const next: Record<string, string> = {};
      for (const c of TERMINAL_CLOCKS) next[c.id] = formatTzTime(now, c.tz);
      setClocks(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const symbols = [...PULSE_INDICES.map((p) => p.symbol), '^VIX'].join(',');
        const res = await fetch(`/api/yfin/watchlist?symbols=${encodeURIComponent(symbols)}`);
        const data = await res.json();
        if (cancelled) return;
        const items = (data.items ?? []) as Array<Record<string, unknown>>;
        const bySym = new Map(items.map((i) => [String(i.symbol), i]));
        const next: PulseQuote[] = PULSE_INDICES.map((p) => {
          const item = bySym.get(p.symbol);
          return { symbol: p.symbol, label: p.label, price: item?.price != null ? Number(item.price) : null, changePercent: item?.changePercent != null ? Number(item.changePercent) : null };
        });
        const vixItem = bySym.get('^VIX');
        if (vixItem) setVix(vixItem);
        const flashNext: Record<string, 'pos' | 'neg'> = {};
        for (const q of next) {
          const prev = prevPrices.current[q.symbol];
          if (prev != null && q.price != null && prev !== q.price) flashNext[q.symbol] = q.price > prev ? 'pos' : 'neg';
          prevPrices.current[q.symbol] = q.price;
        }
        if (Object.keys(flashNext).length > 0) {
          setFlashes((cur) => ({ ...cur, ...flashNext }));
          setTimeout(() => { setFlashes((cur) => { const copy = { ...cur }; for (const k of Object.keys(flashNext)) delete copy[k]; return copy; }); }, 600);
        }
        setQuotes(next);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(()=>{
    fetch('/api/yfin/fear-greed').then(r=>r.json()).then(setFng).catch(()=>{});
    fetch('/api/yfin/market-breadth').then(r=>r.json()).then(setBreadth).catch(()=>{});
    const id = setInterval(()=>{ fetch('/api/yfin/fear-greed').then(r=>r.json()).then(setFng).catch(()=>{}); fetch('/api/yfin/market-breadth').then(r=>r.json()).then(setBreadth).catch(()=>{}); }, 120000);
    return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const loadMovers = async ()=>{
      try { const r=await fetch('/api/yfin/market-movers?type=gainers'); const j=await r.json(); setTape(j.items?.slice(0,6)??[]); } catch {}
    };
    loadMovers();
    const id=setInterval(loadMovers, 60000);
    return ()=>clearInterval(id);
  },[]);

  const phaseColor = phase === 'open' ? 'var(--positive)' : phase === 'pre' || phase === 'after' ? 'var(--amber-bright)' : 'var(--text-mute)';
  const phaseBg = phase === 'open' ? 'var(--positive-soft)' : phase === 'pre' || phase === 'after' ? 'var(--accent-soft)' : 'transparent';

  const fngColor = fng?.score!=null ? (fng.score<25?'#ef4444':fng.score<45?'#f97316':fng.score<55?'#eab308':fng.score<75?'#22c55e':'#10b981') : 'var(--text-dim)';

  return (
    <div data-tour="market-pulse" style={{ display: 'flex', alignItems: 'center', height: 30, background: 'var(--panel-bg)', borderBottom: '1px solid var(--border)', padding: '0 8px', gap: 0, flexShrink: 0, fontFamily: 'var(--font)', fontSize: 11, userSelect: 'none', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10, marginRight: 8, borderRight: '1px solid var(--border-soft)', flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: phaseColor, boxShadow: phase === 'open' ? `0 0 6px ${phaseColor}` : 'none', display: 'inline-block', animation: phase === 'open' ? 'quote-pulse 1.5s infinite ease-in-out' : undefined }} />
        <span style={{ color: phaseColor, background: phaseBg, fontWeight: 700, letterSpacing: 0.6, padding: '1px 5px', borderRadius: 2, border: `1px solid ${phaseColor}`, fontSize: 9 }}>US {sessionLabel(phase)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {quotes.length === 0 && <span style={{ color: 'var(--text-faint)', padding: '0 4px' }}>LOADING PULSE…</span>}
        {quotes.slice(0,5).map((q, i) => {
          const up = q.changePercent != null && q.changePercent >= 0;
          const chgColor = q.changePercent == null ? 'var(--text-mute)' : up ? 'var(--positive)' : 'var(--negative)';
          const flash = flashes[q.symbol];
          return (
            <button key={q.symbol} onClick={() => setSymbol(q.symbol)} className={`row-hover ${flash === 'pos' ? 'flash-positive' : flash === 'neg' ? 'flash-negative' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px', height: 22, background: 'transparent', cursor: 'pointer', flex: '0 0 auto', minWidth: 0, border: 'none', borderRight: '1px solid var(--row-divider)', fontFamily: 'var(--font)', overflow: 'hidden' }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 700, fontSize:10 }}>{q.label}</span>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPulsePrice(q.price)}</span>
              <span style={{ color: chgColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>{q.changePercent == null ? '---' : `${up ? '+' : ''}${q.changePercent.toFixed(2)}%`}</span>
            </button>
          );
        })}

        {vix && (
          <button onClick={()=>setLastAction('open:vix-term')} style={{display:'flex',alignItems:'center',gap:4,padding:'0 6px',height:22,background:'var(--surface-raised)',border:'1px solid var(--border-soft)',borderRadius:2,margin:'0 4px',cursor:'pointer'}}>
            <span style={{color:'var(--text-dim)',fontWeight:700,fontSize:10}}>VIX</span>
            <span style={{color:'var(--text-bright)',fontWeight:700}}>{Number(vix.price??0).toFixed(2)}</span>
            <span style={{color:(Number(vix.changePercent??0)>=0)?'var(--negative)':'var(--positive)',fontSize:10}}>{(Number(vix.changePercent??0)>=0?'+':'')}{Number(vix.changePercent??0).toFixed(2)}%</span>
          </button>
        )}

        {fng && (
          <button onClick={()=>setLastAction('open:fear-greed')} style={{display:'flex',alignItems:'center',gap:5,padding:'0 6px',height:22,background:'var(--surface-raised)',border:`1px solid ${fngColor}44`,borderRadius:2,marginRight:4,cursor:'pointer'}}>
            <span style={{fontSize:9,color:'var(--text-dim)',fontWeight:700}}>F&G</span>
            <span style={{width:36,height:6,background:'var(--surface-sunken)',borderRadius:3,overflow:'hidden',display:'inline-block'}}>
              <span style={{display:'block',width:`${fng.score}%`,height:'100%',background:fngColor}} />
            </span>
            <span style={{color:fngColor,fontWeight:700,fontSize:11}}>{fng.score}</span>
          </button>
        )}

        {breadth && (
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'0 6px',height:22,background:'var(--surface-sunken)',border:'1px solid var(--border-soft)',borderRadius:2,marginRight:6}}>
            <span style={{fontSize:9,color:'var(--text-dim)',fontWeight:700}}>A/D</span>
            <span style={{color:'var(--positive)',fontWeight:700}}>{breadth.advances}</span>
            <span style={{color:'var(--text-faint)'}}>/</span>
            <span style={{color:'var(--negative)',fontWeight:700}}>{breadth.declines}</span>
            <span style={{width:40,height:4,background:'var(--negative)',borderRadius:2,overflow:'hidden',display:'inline-block',marginLeft:4}}>
              <span style={{display:'block',width:`${(breadth.advances/(breadth.advances+breadth.declines)*100)||50}%`,height:'100%',background:'var(--positive)'}} />
            </span>
          </div>
        )}

        <div style={{display:'flex',gap:2,overflow:'hidden',alignItems:'center'}}>
          {tape.slice(0,4).map((t:any)=>(
            <button key={t.symbol} onClick={()=>setSymbol(t.symbol)} style={{display:'flex',alignItems:'center',gap:3,padding:'0 5px',height:18,background:'var(--positive-soft)',border:'1px solid var(--positive)',borderRadius:2,cursor:'pointer',fontSize:10}}>
              <span style={{fontWeight:700,color:'var(--positive)'}}>{t.symbol}</span>
              <span style={{color:'var(--positive)'}}>+{t.changePercent?.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 10, marginLeft: 4, borderLeft: '1px solid var(--border-soft)', flexShrink: 0 }}>
        {TERMINAL_CLOCKS.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={c.tz}>
            <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 9 }}>{c.label}</span>
            <span style={{ color: 'var(--text-bright)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3 }}>{(clocks[c.id] ?? '--:--').slice(0, 5)}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes quote-pulse { 0% { transform: scale(0.85); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.85); opacity: 0.5; } }`}</style>
    </div>
  );
}
