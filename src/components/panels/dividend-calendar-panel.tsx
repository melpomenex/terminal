'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function DividendCalendarPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [data,setData]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/yfin/dividend-calendar').then(r=>r.json()).then(d=>{ setData(d.dividends??[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING DIVIDENDS…</div>;
  const upcoming = data.filter((d:any)=> new Date(d.date).getTime() > Date.now() - 864e5).sort((a:any,b:any)=> new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = data.filter((d:any)=> new Date(d.date).getTime() <= Date.now()).sort((a:any,b:any)=> new Date(b.date).getTime() - new Date(a.date).getTime());
  const renderRow=(d:any,i:number)=>(
    <div key={`${d.symbol}-${d.date}-${i}`} onClick={()=>setSymbol(d.symbol)} style={{display:'grid',gridTemplateColumns:'56px 72px 56px 56px 1fr',padding:'3px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer',background:i%2===0?'transparent':'var(--row-stripe)'}} className="row-hover">
      <span style={{fontWeight:700,color:'var(--accent)'}}>{d.symbol}</span>
      <span style={{color:'var(--text-mute)'}}>{d.date}</span>
      <span style={{textAlign:'right',color:'var(--text-bright)'}}>${d.amount?.toFixed(3)}</span>
      <span style={{textAlign:'right',color:'var(--positive)',fontWeight:700}}>{d.estYieldPct?`${d.estYieldPct.toFixed(2)}%`:''}</span>
      <span style={{color:'var(--text-faint)',fontSize:10}}>@ ${d.price?.toFixed(2)}</span>
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{padding:'4px 8px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:11,fontWeight:700}}>DIVIDEND CALENDAR</span>
        <span style={{fontSize:9,color:'var(--text-dim)'}}>{data.length} EVENTS · DIV YIELD EST</span>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden'}}>
        <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column',borderBottom:'1px solid var(--border)'}}>
          <div style={{padding:'2px 8px',fontSize:9,fontWeight:700,color:'var(--positive)',background:'var(--positive-soft)'}}>UPCOMING / RECENT</div>
          <div style={{display:'grid',gridTemplateColumns:'56px 72px 56px 56px 1fr',padding:'2px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}><span>TKR</span><span>EX-DATE</span><span style={{textAlign:'right'}}>AMT</span><span style={{textAlign:'right'}}>YLD</span><span>PRICE</span></div>
          <div style={{flex:1,overflow:'auto'}}>{upcoming.slice(0,40).map(renderRow)}{upcoming.length===0 && <div style={{padding:8,color:'var(--text-dim)'}}>NO UPCOMING</div>}</div>
        </div>
        <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'2px 8px',fontSize:9,fontWeight:700,color:'var(--text-dim)',background:'var(--surface-raised)'}}>PAST (1Y)</div>
          <div style={{flex:1,overflow:'auto'}}>{past.slice(0,60).map(renderRow)}</div>
        </div>
      </div>
    </div>
  );
}
