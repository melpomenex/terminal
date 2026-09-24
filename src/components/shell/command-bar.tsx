'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { SearchQuote } from '@/lib/types';
import { useTerminalContext } from '@/context/terminal-context';
import { commandRegistry, type CommandDefinition } from '@/lib/commands/command-registry';
import { formatTzTime, getUsSessionPhase, sessionLabel, type SessionPhase } from '@/lib/market-hours';
import Tooltip from './tooltip';

interface CmdItem { id:string; label:string; desc:string; action:string; group:string; hotkey?:string; keywords?:string; }

const PRESET_COMMANDS: CmdItem[] = [
  { id:'godel', label:'VIEW GODEL', desc:'Default 3-col layout', action:'preset:godel', group:'VIEWS' },
  { id:'flowv', label:'VIEW FLOW', desc:'Options flow workspace', action:'preset:flow', group:'VIEWS' },
  { id:'whalev', label:'VIEW WHALE', desc:'Whale & congress tracker', action:'preset:whale', group:'VIEWS' },
  { id:'fearv', label:'VIEW FEAR', desc:'Fear & VIX dashboard', action:'preset:fear', group:'VIEWS' },
  { id:'squeeze', label:'VIEW SQUEEZE', desc:'Squeeze detector', action:'preset:squeeze', group:'VIEWS' },
  { id:'tapev', label:'VIEW TAPE', desc:'Tape reading setup', action:'preset:tape', group:'VIEWS' },
  { id:'earnv', label:'VIEW EARN', desc:'Earnings + seasonality', action:'preset:earnings', group:'VIEWS' },
  { id:'journalv', label:'VIEW JOURNAL', desc:'Trading journal & lab', action:'preset:notes', group:'VIEWS' },
  { id:'degenv', label:'VIEW DEGEN', desc:'WSB + movers + heatmap', action:'preset:degen', group:'VIEWS' },
  { id:'traderv', label:'VIEW TRADER', desc:'Classic trader', action:'preset:trader', group:'VIEWS' },
  { id:'marketsv', label:'VIEW MARKETS', desc:'Global macro', action:'preset:markets', group:'VIEWS' },
];

const ACTION_COMMANDS: CmdItem[] = [];

function fuzzyMatch(q:string, target:string): number {
  q=q.toLowerCase(); target=target.toLowerCase();
  if (target.includes(q)) return 100 - (target.indexOf(q));
  let ti=0, score=0;
  for (let qi=0; qi<q.length; qi++) {
    const c=q[qi];
    const idx=target.indexOf(c, ti);
    if (idx===-1) return -1;
    score+= (idx-ti===0?2:1);
    ti=idx+1;
  }
  return score;
}

/** Registry-driven command palette rows (auto-generated, never stale). */
function registryToCmdItems(): CmdItem[] {
  return commandRegistry.all().map((def: CommandDefinition) => ({
    id: def.mnemonic.toLowerCase(),
    label: def.takesInstrument ? `${def.mnemonic} [TICKER]` : def.mnemonic,
    desc: def.description,
    action: def.targetPanelType ? `open:${def.targetPanelType}` : `exec:${def.mnemonic}`,
    group: def.category,
    keywords: `${def.mnemonic} ${def.aliases.join(' ')} ${def.name} ${def.description}`.toUpperCase(),
  }));
}

export default function CommandBar() {
  const { command, setCommand, handleCommand, inputRef, searchResults, showSearch, setShowSearch, onSearchChange, onSelectSearch, setLastAction, symbol, chart, marketOpen, watchlist } = useTerminalContext();
  const [cursorVisible, setCursorVisible] = useState(true);
  const [nyTime, setNyTime] = useState('');
  const [phase, setPhase] = useState<SessionPhase>('closed');
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [trending, setTrending] = useState<any[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ const tick=()=>{ const now=new Date(); setNyTime(formatTzTime(now, 'America/New_York')); setPhase(getUsSessionPhase(now)); }; tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setInterval(()=>setCursorVisible(v=>!v),530); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ const id=setTimeout(()=>onSearchChange(command),180); return ()=>clearTimeout(id); },[command, onSearchChange]);

  useEffect(()=>{ fetch('/api/wsb/trending').then(r=>r.json()).then(d=>setTrending(d.trending??[])).catch(()=>{}); },[]);

  const allCmds = useMemo(()=> [...registryToCmdItems(), ...PRESET_COMMANDS],[]);
  const filteredCmds = useMemo(()=>{
    const q=command.trim().toUpperCase();
    if (!q) return allCmds.slice(0,10);
    if (/^[A-Z]{1,5}$/.test(q) && q.length<=5) return [];
    const scored = allCmds.map(c=>{
      const s = fuzzyMatch(q.toLowerCase(), `${c.label} ${c.desc} ${c.group}`.toLowerCase());
      return { c, s };
    }).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s).map(x=>x.c);
    return scored.slice(0,12);
  },[command, allCmds]);

  const showCommandPalette = showSearch && (filteredCmds.length>0 || searchResults.length>0 || trending.length>0);

  const unifiedList = useMemo(()=>{
    const list:any[]=[];
    if (searchResults.length>0) { list.push({type:'header', label:'TICKERS'}); searchResults.slice(0,6).forEach((r:SearchQuote)=> list.push({type:'ticker', data:r})); }
    if (filteredCmds.length>0) {
      let lastGroup='';
      filteredCmds.forEach(c=>{
        if (c.group!==lastGroup){ list.push({type:'header', label: c.group}); lastGroup=c.group; }
        list.push({type:'cmd', data:c});
      });
    }
    if (command.trim()==='' && trending.length>0) {
      list.push({type:'header', label:'TRENDING WSB'});
      trending.slice(0,5).forEach((t:any)=> list.push({type:'trending', data:t}));
    }
    return list;
  },[searchResults, filteredCmds, trending, command]);

  const quoteFallback = watchlist.find((w) => w.symbol === symbol);
  const price = quoteFallback?.price ?? chart?.price ?? null;
  const prev = quoteFallback?.previousClose ?? chart?.previousClose ?? null;
  const chg = quoteFallback?.change ?? (price != null && prev != null ? price - prev : null);
  const chgPct = quoteFallback?.changePercent ?? (chg != null && prev != null && prev !== 0 ? (chg / prev) * 100 : null);
  const isUp = chg != null && chg >= 0;
  const chgColor = chg == null ? 'var(--text-mute)' : isUp ? 'var(--positive)' : 'var(--negative)';
  const phaseColor = phase === 'open' ? 'var(--positive)' : phase === 'pre' || phase === 'after' ? 'var(--amber-bright)' : 'var(--text-mute)';

  const badges = [
    { label: 'QM', action: 'open:quote-monitor', title: 'Quote Monitor' },
    { label: 'FLOW', action: 'open:unusual-options', title: 'Flow' },
    { label: 'TAPE', action: 'open:tape', title: 'Tape' },
    { label: 'GEX', action: 'open:gamma-exposure', title: 'Gamma' },
    { label: 'FEAR', action: 'open:fear-greed', title: 'Fear & Greed' },
    { label: 'MAP', action: 'open:market-heatmap', title: 'Heatmap' },
    { label: 'WHALE', action: 'open:superinvestor', title: 'Whales' },
  ];

  const handleKeyDown = (e:React.KeyboardEvent)=>{
    if (e.key==='ArrowDown'){ e.preventDefault(); setFocusedIdx(i=> Math.min(i+1, unifiedList.length-1)); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); setFocusedIdx(i=> Math.max(0, i-1)); }
    else if (e.key==='Enter'){
      const item=unifiedList[focusedIdx];
      if (item){
        if (item.type==='ticker'){ onSelectSearch(item.data.symbol); return; }
        if (item.type==='cmd'){
          const c=item.data as CmdItem;
          if (c.action.startsWith('exec:')){
            // Argument-taking commands fill the input so the user completes args.
            setCommand(`${c.action.slice(5)} `);
            setShowSearch(false);
            inputRef.current?.focus();
            return;
          }
          setLastAction(c.action); setCommand(''); setShowSearch(false); return;
        }
        if (item.type==='trending'){ onSelectSearch(item.data.symbol); return; }
      }
      handleCommand();
    }
    else if (e.key==='Escape'){ setCommand(''); (e.target as HTMLInputElement).blur(); setShowSearch(false); }
  };

  return (
    <div data-tour="command-bar" style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-soft)', padding: '0 10px', gap: 10, position: 'relative', userSelect: 'none', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, borderRight: '1px solid var(--border-soft)', flexShrink: 0 }}>
        <span className="glow" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13, letterSpacing: 1.2 }}>QUBE</span>
        <span style={{ color: phaseColor, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, border: `1px solid ${phaseColor}`, padding: '0 4px', borderRadius: 2, lineHeight: '14px' }}>{sessionLabel(phase)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 4, height: 26, padding: '0 10px', width: 320, position: 'relative', flexShrink: 0, boxShadow: showCommandPalette?'0 4px 12px rgba(0,0,0,0.4)':undefined }}>
        <span style={{ color: 'var(--text-mute)', fontSize: 12, marginRight: 6, fontWeight: 700 }}>{'>'}</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => { setCommand(e.target.value); setFocusedIdx(0); setShowSearch(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 220)}
          placeholder="AAPL  /  QM  FLOW  FEAR  WHALE  VIEW DEGEN… (⌘K)"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-bright)', fontFamily: 'var(--font)', fontSize: 11, caretColor: 'transparent', padding: 0, textTransform: 'uppercase' }}
          autoComplete="off" spellCheck={false}
        />
        {command && <span className="cursor-blink" style={{ position: 'absolute', top: 6, left: `${command.length * 7.2 + 24}px`, width: 8, height: 13, background: 'var(--accent)', opacity: cursorVisible ? 1 : 0, pointerEvents: 'none' }} />}

        {showCommandPalette && (
          <div ref={listRef} className="overlay-enter" style={{ position: 'absolute', top: 30, left: 0, right: 0, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 'var(--z-dropdown)', maxHeight: 420, overflow: 'auto', boxShadow: 'var(--shadow)' }}>
            {unifiedList.map((item, idx)=>{
              const focused = idx===focusedIdx;
              if (item.type==='header') return <div key={`${item.label}-${idx}`} style={{padding:'6px 10px 2px',fontSize:8,fontWeight:700,color:'var(--text-faint)',letterSpacing:0.6,background:'var(--surface-sunken)',borderTop: idx>0?'1px solid var(--border-soft)':'none'}}>{item.label}</div>;
              if (item.type==='ticker'){
                const r=item.data as SearchQuote;
                return (
                  <div key={`t-${r.symbol}`} onMouseDown={() => onSelectSearch(r.symbol)} onMouseEnter={()=>setFocusedIdx(idx)} style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: focused?'var(--accent-soft)':'transparent', borderBottom: '1px solid var(--border-soft)' }}>
                    <span style={{ fontWeight: 700, color: focused?'var(--accent)':'var(--accent)', fontSize: 11 }}>{r.symbol}</span>
                    <span style={{ color: 'var(--text-mute)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{r.name}</span>
                  </div>
                );
              }
              if (item.type==='cmd'){
                const c=item.data as CmdItem;
                return (
                  <div key={`c-${c.id}`} onMouseDown={()=>{ setLastAction(c.action); setCommand(''); setShowSearch(false); }} onMouseEnter={()=>setFocusedIdx(idx)} style={{padding:'6px 10px',cursor:'pointer',display:'flex',gap:8,background:focused?'var(--accent-soft)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <span style={{fontWeight:700,color: focused?'var(--accent)':'var(--text-bright)',fontSize:11,minWidth:84}}>{c.label.split(' - ')[0]}</span>
                    <span style={{color:'var(--text-mute)',fontSize:10,flex:1,overflow:'hidden',textOverflow:'ellipsis'}}>{c.desc}{c.hotkey?` · ${c.hotkey}`:''}</span>
                    <span style={{fontSize:8,color:'var(--text-faint)',border:'1px solid var(--border-soft)',padding:'0 3px',borderRadius:2,height:14,lineHeight:'12px'}}>{c.group}</span>
                  </div>
                );
              }
              if (item.type==='trending'){
                const t=item.data;
                return (
                  <div key={`tr-${t.symbol}-${idx}`} onMouseDown={()=>onSelectSearch(t.symbol)} onMouseEnter={()=>setFocusedIdx(idx)} style={{padding:'5px 10px',cursor:'pointer',display:'flex',gap:8,background:focused?'var(--accent-soft)':'transparent'}}>
                    <span style={{fontWeight:700,color:'var(--accent)',fontSize:11}}>{t.symbol}</span>
                    <span style={{fontSize:10,color:'var(--text-dim)'}}>{t.mentions} mentions · {t.sentiment}</span>
                    <span style={{marginLeft:'auto',fontSize:8,background:'var(--accent)',color:'#000',padding:'0 4px',borderRadius:2}}>WSB</span>
                  </div>
                );
              }
              return null;
            })}
            <div style={{padding:'4px 10px',fontSize:8,color:'var(--text-faint)',borderTop:'1px solid var(--border)'}}>↑↓ NAV · ENTER SELECT · ESC CLOSE · TYPE TICKER TO LOAD SYMBOL</div>
          </div>
        )}
      </div>

      <div data-tour="badges" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        {badges.map((b) => (
          <Tooltip key={b.label} label={b.title}>
            <button onClick={() => setLastAction(b.action)} className="row-hover" style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: 2, color: 'var(--accent)', fontSize: 9, fontWeight: 700, padding: '1px 6px', cursor: 'pointer', lineHeight: '12px', fontFamily: 'var(--font)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>{b.label}</button>
          </Tooltip>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4, padding: '0 10px', height: 26, background: 'var(--surface-sunken)', border: '1px solid var(--border-soft)', borderRadius: 4, flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: 0.5, fontSize: 11 }}>{symbol}</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>Equity</span>
        <span style={{ color: 'var(--text-bright)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{price != null ? price.toFixed(2) : '---'}</span>
        <span style={{ color: chgColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{chg == null ? '---' : `${isUp ? '+' : ''}${chg.toFixed(2)}`}</span>
        <span style={{ color: chgColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{chgPct == null ? '' : `(${isUp ? '+' : ''}${chgPct.toFixed(2)}%)`}</span>
        <span style={{marginLeft:8,display:'flex',gap:3}}>
          {(['1D','5D','1M','6M','1Y'] as const).map(r=><button key={r} onClick={()=>{ const ctx = (window as any)._terminalCtx; }} style={{fontSize:8,padding:'0 4px',border:'1px solid var(--border-soft)',background:'transparent',color:'var(--text-dim)',borderRadius:2}}>{r}</button>)}
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-mute)', flexShrink: 0 }}>
        <Tooltip label="Settings & Themes">
          <button data-tour="settings" onClick={() => setLastAction('open:settings')} style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 2, color: 'var(--text-dim)', fontSize: 11, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font)', lineHeight: '14px' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-light)'; }}>⚙</button>
        </Tooltip>
        <button onClick={() => setLastAction('open:shortcuts')} style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-bright)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-mute)'; }}>HELP</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="New York time">
          <span style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 9 }}>NY</span>
          <span style={{ fontFamily: 'var(--font)', fontSize: 11, color: 'var(--text-bright)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{nyTime}</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: marketOpen || phase === 'open' ? 'var(--positive)' : 'var(--text-faint)', boxShadow: (marketOpen || phase === 'open') ? '0 0 4px var(--positive)' : 'none', display: 'inline-block' }} />
        </div>
      </div>
    </div>
  );
}
