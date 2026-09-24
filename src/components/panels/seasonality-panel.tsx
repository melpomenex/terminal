'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function SeasonalityPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ setLoading(true); fetch(`/api/yfin/seasonality/${symbol}`).then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false)); },[symbol]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>COMPUTING SEASONALITY {symbol} (10Y)…</div>;
  if (!data?.monthly) return <div style={{padding:8,color:'var(--negative)'}}>NO DATA</div>;
  const monthly=data.monthly as any[];
  const maxAvg = Math.max(...monthly.map(m=>Math.abs(m.avgReturn)),1);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'auto',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>SEASONALITY · <span style={{color:'var(--accent)'}}>{symbol}</span> · 10Y</span>
        <span style={{fontSize:8,color:'var(--text-dim)'}}>BEST {data.bestMonth?.monthName} {data.bestMonth?.avgReturn>0?'+':''}{data.bestMonth?.avgReturn}% · WORST {data.worstMonth?.monthName} {data.worstMonth?.avgReturn}%</span>
      </div>
      <div style={{padding:'6px 8px'}}>
        <div style={{fontSize:9,color:'var(--text-dim)',fontWeight:700,marginBottom:4}}>MONTHLY AVG RETURN (10Y)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)',gap:4}}>
          {monthly.map(m=>{
            const up=m.avgReturn>=0;
            const h=Math.abs(m.avgReturn)/maxAvg*36;
            return (
              <div key={m.month} style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',borderRadius:3,padding:'4px 4px',textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--text-dim)'}}>{m.monthName}</div>
                <div style={{height:40,display:'flex',alignItems:'flex-end',justifyContent:'center',gap:2,margin:'4px 0'}}>
                  <div style={{width:18,height:Math.max(2,h),background: up?'var(--positive)':'var(--negative)',borderRadius:1}} />
                </div>
                <div style={{fontSize:10,fontWeight:700,color:up?'var(--positive)':'var(--negative)'}}>{m.avgReturn>0?'+':''}{m.avgReturn.toFixed(2)}%</div>
                <div style={{fontSize:8,color:'var(--text-faint)'}}>{m.winRate}% WR</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{padding:'6px 8px'}}>
        <div style={{fontSize:9,color:'var(--text-dim)',fontWeight:700,marginBottom:4}}>DAY OF WEEK EDGE (5Y)</div>
        <div style={{display:'flex',gap:4}}>
          {(data.dow??[]).map((d:any)=>{
            const up=d.avgReturn>=0;
            return (
              <div key={d.day} style={{flex:1,background:'var(--surface-sunken)',border:'1px solid var(--border-soft)',borderRadius:3,padding:'6px 4px',textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--text-dim)'}}>{d.dayName}</div>
                <div style={{fontSize:11,fontWeight:700,color:up?'var(--positive)':'var(--negative)'}}>{d.avgReturn>0?'+':''}{d.avgReturn.toFixed(3)}%</div>
                <div style={{fontSize:8,color:'var(--text-faint)'}}>{d.winRate}%</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{padding:'4px 8px'}}>
        <div style={{fontSize:9,color:'var(--text-dim)',fontWeight:700,marginBottom:4}}>DETAILED STATS</div>
        <div style={{display:'grid',gridTemplateColumns:'52px 54px 54px 48px 1fr',padding:'2px 4px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}>
          <span>MONTH</span><span style={{textAlign:'right'}}>AVG</span><span style={{textAlign:'right'}}>MED</span><span style={{textAlign:'right'}}>WR</span><span style={{textAlign:'right'}}>N</span>
        </div>
        {monthly.map(m=>(
          <div key={m.month} style={{display:'grid',gridTemplateColumns:'52px 54px 54px 48px 1fr',padding:'3px 4px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',background: m.month===new Date().getMonth()?'var(--accent-soft)':undefined}}>
            <span style={{fontWeight:700}}>{m.monthName}</span>
            <span style={{textAlign:'right',color:m.avgReturn>=0?'var(--positive)':'var(--negative)',fontWeight:700}}>{m.avgReturn>0?'+':''}{m.avgReturn.toFixed(2)}%</span>
            <span style={{textAlign:'right',color:'var(--text-mute)'}}>{m.medianReturn>0?'+':''}{m.medianReturn.toFixed(2)}%</span>
            <span style={{textAlign:'right',color:m.winRate>=55?'var(--positive)':m.winRate<=45?'var(--negative)':'var(--text-mute)'}}>{m.winRate}%</span>
            <span style={{textAlign:'right',color:'var(--text-faint)'}}>{m.samples}</span>
          </div>
        ))}
      </div>
      <div style={{padding:'2px 8px',fontSize:8,color:'var(--text-faint)',borderTop:'1px solid var(--border)'}}>HISTORICAL AVERAGES ≠ FUTURE · SAMPLE: 10Y MONTHLY, 5Y DAILY</div>
    </div>
  );
}
