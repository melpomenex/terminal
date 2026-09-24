'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function EtfFlowsPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/yfin/etf-flows').then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
    const id=setInterval(()=>fetch('/api/yfin/etf-flows').then(r=>r.json()).then(setData), 60000);
    return ()=>clearInterval(id);
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING ETF FLOWS…</div>;
  const inflows=data?.inflows??[]; const outflows=data?.outflows??[];
  const render=(items:any[], label:string)=>(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'3px 8px',fontSize:9,fontWeight:700,color: label==='INFLOW'?'var(--positive)':'var(--negative)',background: label==='INFLOW'?'var(--positive-soft)':'var(--negative-soft)',borderBottom:'1px solid var(--border)'}}>{label} · EST FLOW (VOL PROXY)</div>
      <div style={{display:'grid',gridTemplateColumns:'56px 54px 54px 1fr',padding:'2px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}><span>ETF</span><span style={{textAlign:'right'}}>FLOW</span><span style={{textAlign:'right'}}>CHG</span><span style={{textAlign:'right'}}>VOL/AVG</span></div>
      <div style={{flex:1,overflow:'auto'}}>
        {items.map((it:any)=><div key={it.symbol} onClick={()=>setSymbol(it.symbol)} style={{display:'grid',gridTemplateColumns:'56px 54px 54px 1fr',padding:'3px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer'}} className="row-hover">
          <span style={{fontWeight:700,color:'var(--accent)'}}>{it.symbol}</span>
          <span style={{textAlign:'right',fontWeight:700,color: it.flowDirection==='INFLOW'?'var(--positive)':'var(--negative)'}}>{(Math.abs(it.estFlow)/1e6)>=1?`$${(it.estFlow/1e6).toFixed(1)}M`:`$${(it.estFlow/1000).toFixed(0)}K`}</span>
          <span style={{textAlign:'right',color:it.changePercent>=0?'var(--positive)':'var(--negative)'}}>{it.changePercent>0?'+':''}{it.changePercent.toFixed(2)}%</span>
          <span style={{textAlign:'right',color:'var(--text-mute)'}}>{it.volRatio.toFixed(2)}x{it.volRatio>1.5?' 🔥':''}</span>
        </div>)}
      </div>
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}><span style={{fontSize:11,fontWeight:700}}>ETF FLOWS</span><span style={{fontSize:8,color:'var(--text-dim)'}}>VOL × PRICE PROXY · NOT OFFICIAL</span></div>
      <div style={{display:'flex',flex:1,minHeight:0,gap:1,background:'var(--border-soft)'}}>
        {render(inflows,'INFLOW')}{render(outflows,'OUTFLOW')}
      </div>
    </div>
  );
}
