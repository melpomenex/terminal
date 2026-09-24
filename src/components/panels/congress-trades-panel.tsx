'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function CongressTradesPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [trades,setTrades]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState<'ALL'|'Purchase'|'Sale'>('ALL');
  const [search,setSearch]=useState('');
  useEffect(()=>{
    fetch('/api/congress/trades?limit=150').then(r=>r.json()).then(j=>{ setTrades(j.trades??[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING CONGRESS TRADES…</div>;
  const filtered = trades.filter(t=>{
    if (filter!=='ALL' && !t.type?.toLowerCase().includes(filter.toLowerCase())) return false;
    if (search && !`${t.representative} ${t.ticker} ${t.asset}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>CONGRESS TRADES</span>
        <span style={{fontSize:9,background:'var(--accent-soft)',color:'var(--accent)',padding:'1px 5px',borderRadius:2}}>{filtered.length}</span>
        <input placeholder="FILTER REP/TICKER" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',width:120,background:'var(--surface-sunken)',border:'1px solid var(--border-soft)',borderRadius:2,padding:'2px 6px',fontSize:10,color:'var(--text-bright)'}} />
        {(['ALL','Purchase','Sale'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{fontSize:9,padding:'1px 6px',border:`1px solid ${filter===f?'var(--accent)':'var(--border-soft)'}`,background:filter===f?'var(--accent-soft)':'transparent',color:filter===f?'var(--accent)':'var(--text-dim)'}}>{f.toUpperCase()}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'126px 56px 72px 84px 1fr',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span>REPRESENTATIVE</span><span>TICKER</span><span>DATE</span><span>TYPE / AMT</span><span>DISCLOSED</span>
      </div>
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {filtered.map((t:any,i:number)=>{
          const isBuy = t.type?.toLowerCase().includes('purchase');
          return (
            <div key={i} onClick={()=>t.ticker && setSymbol(t.ticker)} style={{display:'grid',gridTemplateColumns:'126px 56px 72px 84px 1fr',padding:'4px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:t.ticker?'pointer':'default',background:i%2===0?'transparent':'var(--row-stripe)'}} className="row-hover">
              <span style={{color:'var(--text-bright)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={t.representative}><span style={{color: t.party==='R'?'#ef4444':t.party==='D'?'#3b82f6':'var(--text-dim)',fontWeight:700,marginRight:4}}>{t.party||'•'}</span>{t.representative}</span>
              <span style={{fontWeight:700,color:'var(--accent)'}}>{t.ticker||'---'}</span>
              <span style={{color:'var(--text-mute)',fontSize:10}}>{t.transaction_date}</span>
              <span><span style={{color:isBuy?'var(--positive)':'var(--negative)',fontWeight:700,fontSize:10}}>{isBuy?'BUY':'SELL'}</span><span style={{color:'var(--text-faint)',fontSize:9,marginLeft:4}}>{t.amount?.split(' - ')[0]??''}</span></span>
              <span style={{color:'var(--text-faint)',fontSize:10,display:'flex',gap:6}}>{t.disclosure_date}<span style={{color:'var(--text-mute)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.asset?.slice(0,40)}</span></span>
            </div>
          );
        })}
        {filtered.length===0 && <div style={{padding:12,color:'var(--text-dim)'}}>NO MATCHING TRADES</div>}
      </div>
      <div style={{padding:'2px 8px',fontSize:8,color:'var(--text-faint)',borderTop:'1px solid var(--border)'}}>SOURCE: HOUSE STOCK WATCHER · DELAY ∼30-45 DAYS · NOT FINANCIAL ADVICE</div>
    </div>
  );
}
