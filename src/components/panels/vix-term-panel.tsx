'use client';
import { useEffect, useState } from 'react';

export default function VixTermPanel({ panelId }: { panelId?: string }) {
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/yfin/vix-term-structure').then(r=>r.json()).then(d=>{setData(d); setLoading(false);}).catch(()=>setLoading(false));
    const id=setInterval(()=>fetch('/api/yfin/vix-term-structure').then(r=>r.json()).then(setData), 60000);
    return ()=>clearInterval(id);
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING VIX TERM…</div>;
  const term = data?.termStructure??[];
  const max = Math.max(...term.map((t:any)=>t.price),1);
  const min = Math.min(...term.map((t:any)=>t.price),0);
  const range = max-min||1;
  const W=340,H=120,padL=32,padR=12,padT=10,padB=22;
  const xScale=(dte:number)=>padL + (dte/180)*(W-padL-padR);
  const yScale=(p:number)=>padT + (1-(p-min)/range)*(H-padT-padB);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'auto',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>VIX TERM STRUCTURE · SPOT {data?.spot?.toFixed(2)} · {data?.regime}</span>
        <span style={{fontSize:9,color: data?.contango>=0?'var(--positive)':'var(--negative)'}}>CONTANGO {data?.contango>0?'+':''}{data?.contango}%</span>
      </div>
      <div style={{padding:'6px 8px'}}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',background:'rgba(0,0,0,0.2)',borderRadius:3}}>
          {term.map((t:any,i:number)=> i>0 ? <line key={i} x1={xScale(term[i-1].dte)} y1={yScale(term[i-1].price)} x2={xScale(t.dte)} y2={yScale(t.price)} stroke={t.price>term[i-1].price?'var(--positive)':'var(--negative)'} strokeWidth={2} /> : null)}
          {term.map((t:any)=> <circle key={t.symbol} cx={xScale(t.dte)} cy={yScale(t.price)} r={4} fill="var(--amber)" stroke="var(--amber-bright)" strokeWidth={1}><title>{`${t.label}: ${t.price.toFixed(2)}`}</title></circle>)}
          <text x={padL} y={padT+8} fontSize={7} fill="var(--text-faint)">{max.toFixed(1)}</text>
          <text x={padL} y={H-padB} fontSize={7} fill="var(--text-faint)">{min.toFixed(1)}</text>
        </svg>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
          {term.map((t:any)=><span key={t.symbol} style={{fontSize:10,background:'var(--surface-raised)',border:'1px solid var(--border-soft)',padding:'2px 6px',borderRadius:2}}><b style={{color:'var(--text-dim)'}}>{t.label}</b> <span style={{color:'var(--text-bright)',fontWeight:700}}>{t.price?.toFixed(2)}</span></span>)}
        </div>
      </div>
      <div style={{padding:'0 8px'}}>
        {(data?.all??[]).map((r:any)=>(
          <div key={r.symbol} style={{display:'grid',gridTemplateColumns:'88px 56px 56px 1fr',padding:'3px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
            <span style={{fontWeight:700}}>{r.label}</span>
            <span style={{textAlign:'right'}}>{r.price?.toFixed(2)??'---'}</span>
            <span style={{textAlign:'right',color:(r.changePercent??0)>=0?'var(--positive)':'var(--negative)'}}>{r.changePercent!=null?`${r.changePercent>=0?'+':''}${r.changePercent.toFixed(2)}%`:'---'}</span>
            <span style={{color:'var(--text-mute)',fontSize:10}}>{r.symbol} · {r.dte}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}
