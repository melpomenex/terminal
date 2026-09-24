'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function UnusualOptionsPanel({ panelId }: { panelId?: string }) {
  const { symbol, setSymbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [sideFilter,setSideFilter]=useState<'ALL'|'CALL'|'PUT'>('ALL');
  const fetchData=async (sym:string)=>{ setLoading(true); try{ const r=await fetch(`/api/yfin/unusual-options/${sym}`); const j=await r.json(); setData(j);}catch{} finally{ setLoading(false);} };
  useEffect(()=>{ fetchData(symbol); },[symbol]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>SCANNING FLOW {symbol}…</div>;
  const items = (data?.items??[]).filter((i:any)=> sideFilter==='ALL' || i.side===sideFilter);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>FLOW · <span style={{color:'var(--accent)'}}>{symbol}</span> · <span style={{color:'var(--text-dim)',fontSize:9}}>{data?.stats?.totalPremium? `$${(data.stats.totalPremium/1e6).toFixed(1)}M PREM`: ''} · P/C {data?.stats?.putCallVolRatio}</span></span>
        <div style={{display:'flex',gap:2}}>
          {(['ALL','CALL','PUT'] as const).map(s=><button key={s} onClick={()=>setSideFilter(s)} style={{fontSize:9,padding:'1px 6px',border:`1px solid ${sideFilter===s?'var(--accent)':'var(--border-soft)'}`,background:sideFilter===s?'var(--accent-soft)':'transparent',color:sideFilter===s?'var(--accent)':'var(--text-dim)'}}>{s}</button>)}
          <button onClick={()=>fetchData(symbol)} style={{fontSize:9,padding:'1px 6px',border:'1px solid var(--border-soft)',marginLeft:4}}>↻</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'48px 52px 46px 46px 46px 48px 56px 1fr',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span>TYPE</span><span>STRIKE</span><span>EXP</span><span>VOL</span><span>OI</span><span>V/OI</span><span>PREM</span><span>IV</span>
      </div>
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {items.slice(0,80).map((o:any,i:number)=>{
          const unusual = o.volOiRatio>=2 || o.volume>=2000;
          return (
            <div key={i} style={{display:'grid',gridTemplateColumns:'48px 52px 46px 46px 46px 48px 56px 1fr',padding:'3px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',background: unusual ? (o.side==='CALL'?'rgba(0,176,80,0.06)':'rgba(239,68,68,0.06)') : i%2===0? 'transparent':'var(--row-stripe)'}}>
              <span style={{color:o.side==='CALL'?'var(--positive)':'var(--negative)',fontWeight:700}}>{o.side[0]} {o.inTheMoney?'●':''}</span>
              <span style={{fontWeight:700,color:'var(--text-bright)'}}>{o.strike}</span>
              <span style={{color:'var(--text-mute)',fontSize:10}}>{o.expiry?.slice(5)} <span style={{color:'var(--text-faint)'}}>{o.dte}d</span></span>
              <span style={{textAlign:'right',fontWeight:700,color: o.volume>1000?'var(--accent)':'var(--text-bright)'}}>{o.volume>=1000?`${(o.volume/1000).toFixed(1)}k`:o.volume}</span>
              <span style={{textAlign:'right',color:'var(--text-mute)'}}>{o.openInterest>=1000?`${(o.openInterest/1000).toFixed(1)}k`:o.openInterest}</span>
              <span style={{textAlign:'right',fontWeight:700,color:o.volOiRatio>=3?'var(--accent)':o.volOiRatio>=1.5?'var(--amber-bright)':'var(--text-dim)'}}>{o.volOiRatio.toFixed(1)}x</span>
              <span style={{textAlign:'right',color:'var(--text-bright)'}}>${(o.premium/1000)>=1000?`${(o.premium/1e6).toFixed(2)}M`:`${(o.premium/1000).toFixed(0)}k`}</span>
              <span style={{color:'var(--text-dim)',fontSize:10}}>{o.iv}% {o.unusualScore>10?'🔥':''}</span>
            </div>
          );
        })}
        {items.length===0 && <div style={{padding:12,color:'var(--text-dim)',fontSize:11}}>NO UNUSUAL FLOW DETECTED — VOL/OI & SWEEP FILTER</div>}
      </div>
      <div style={{padding:'2px 8px',fontSize:8,color:'var(--text-faint)',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
        <span>UNUSUAL = VOL &gt; OI ×1.5 OR VOL &gt; 500 · 🔥 HIGH SCORE</span>
        <span>{items.length} RESULTS</span>
      </div>
    </div>
  );
}
