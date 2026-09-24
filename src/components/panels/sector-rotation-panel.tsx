'use client';
import { useEffect, useState } from 'react';

export default function SectorRotationPanel({ panelId }: { panelId?: string }) {
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [sortBy,setSortBy]=useState<'1D'|'5D'|'1M'|'3M'|'YTD'|'1Y'>('1D');
  useEffect(()=>{
    fetch('/api/yfin/sector-rotation').then(r=>r.json()).then(d=>{setData(d); setLoading(false);}).catch(()=>setLoading(false));
    const id=setInterval(()=>fetch('/api/yfin/sector-rotation').then(r=>r.json()).then(setData), 60000);
    return ()=>clearInterval(id);
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING SECTOR ROTATION…</div>;
  const sectors = [...(data?.sectors??[])].sort((a,b)=>{
    const key = `change${sortBy}` as any;
    return (b[key]??0) - (a[key]??0);
  });
  const maxAbs = Math.max(...sectors.map(s=>Math.abs(s[`change${sortBy}`]??0)),1);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>SECTOR ROTATION</span>
        <div style={{display:'flex',gap:2,marginLeft:8}}>
          {(['1D','5D','1M','3M','YTD','1Y'] as const).map(k=>(
            <button key={k} onClick={()=>setSortBy(k)} style={{fontSize:9,padding:'1px 6px',border:`1px solid ${sortBy===k?'var(--accent)':'var(--border-soft)'}`,background:sortBy===k?'var(--accent-soft)':'transparent',color:sortBy===k?'var(--accent)':'var(--text-dim)'}}>{k}</button>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'80px 1fr 54px 54px 54px 54px 54px',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span>SECTOR</span><span>RELATIVE STRENGTH ({sortBy})</span><span style={{textAlign:'right'}}>1D</span><span style={{textAlign:'right'}}>1W</span><span style={{textAlign:'right'}}>1M</span><span style={{textAlign:'right'}}>YTD</span><span style={{textAlign:'right'}}>1Y</span>
      </div>
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {sectors.map((s:any)=>{
          const val = s[`change${sortBy}`]??0;
          const up = val>=0;
          return (
            <div key={s.symbol} style={{display:'grid',gridTemplateColumns:'80px 1fr 54px 54px 54px 54px 54px',padding:'5px 8px',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.03)',background: Math.abs(val)>1.5? (up?'rgba(0,176,80,0.06)':'rgba(239,68,68,0.06)') : undefined}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,background:s.color,display:'inline-block',borderRadius:1}} /><span style={{fontWeight:700,color:'var(--text-bright)',fontSize:11}}>{s.name}</span></span>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{flex:1,height:6,background:'var(--surface-sunken)',borderRadius:2,overflow:'hidden',position:'relative'}}>
                  <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'var(--border)'}} />
                  <div style={{position:'absolute',top:0,bottom:0,left: val>=0?'50%':`${50 - Math.abs(val)/maxAbs*50}%`,width:`${Math.abs(val)/maxAbs*50}%`,background: up?'var(--positive)':'var(--negative)',borderRadius:1}} />
                </div>
                <span style={{fontSize:10,fontWeight:700,color: up?'var(--positive)':'var(--negative)',minWidth:42,textAlign:'right'}}>{val>0?'+':''}{val.toFixed(2)}%</span>
              </div>
              {(['1D','5D','1M','YTD','1Y'] as const).map(k=>{
                const v=s[`change${k}`]??0;
                return <span key={k} style={{textAlign:'right',fontSize:10,color:v>=0?'var(--positive)':'var(--negative)'}}>{v>0?'+':''}{v.toFixed(1)}%</span>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
