'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function GammaExposurePanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true);
    fetch(`/api/yfin/gamma/${symbol}`).then(r=>r.json()).then(d=>{setData(d); setLoading(false);}).catch(()=>setLoading(false));
  },[symbol]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>CALCULATING GEX {symbol}…</div>;
  if (!data || !data.profile?.length) return <div style={{padding:8,color:'var(--text-dim)'}}>NO GEX DATA FOR {symbol}</div>;
  const profile = data.profile as any[];
  const maxAbs = Math.max(...profile.map(p=>Math.abs(p.netGex)),1);
  const W=360,H=180, padL=44, padR=8, padT=12, padB=24;
  const barW = (W-padL-padR)/profile.length*0.8;
  const zeroX = W/2;
  const xScale = (i:number)=> padL + (i/profile.length)*(W-padL-padR);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>GEX · {symbol} @ {data.spot?.toFixed(2)} · NET {data.netGex>0?'+':''}{data.netGex}B</span>
        <span style={{fontSize:8,color:'var(--text-dim)'}}>{data.flipStrike?`FLIP ${data.flipStrike}`:''}</span>
      </div>
      <div style={{display:'flex',padding:'6px 8px',gap:8,flexShrink:0}}>
        <div style={{background:'var(--positive-soft)',border:'1px solid var(--positive)',borderRadius:3,padding:'4px 8px',flex:1,textAlign:'center'}}>
          <div style={{fontSize:8,color:'var(--text-dim)'}}>CALL GEX</div>
          <div style={{fontSize:13,fontWeight:700,color:'var(--positive)'}}>+{data.totalCallGex}B</div>
        </div>
        <div style={{background:'var(--negative-soft)',border:'1px solid var(--negative)',borderRadius:3,padding:'4px 8px',flex:1,textAlign:'center'}}>
          <div style={{fontSize:8,color:'var(--text-dim)'}}>PUT GEX</div>
          <div style={{fontSize:13,fontWeight:700,color:'var(--negative)'}}>{data.totalPutGex}B</div>
        </div>
        <div style={{background:data.netGex>=0?'var(--positive-soft)':'var(--negative-soft)',border:`1px solid ${data.netGex>=0?'var(--positive)':'var(--negative)'}`,borderRadius:3,padding:'4px 8px',flex:1,textAlign:'center'}}>
          <div style={{fontSize:8,color:'var(--text-dim)'}}>NET GEX REGIME</div>
          <div style={{fontSize:11,fontWeight:700,color:data.netGex>=0?'var(--positive)':'var(--negative)'}}>{data.netGex>=0?'LONG GAMMA (PIN)':'SHORT GAMMA (VOL EXPAND)'}</div>
        </div>
      </div>
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'0 4px'}}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
          <line x1={padL} y1={padT} x2={padL} y2={H-padB} stroke="var(--border-soft)" strokeWidth={0.5} />
          <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="var(--border-soft)" strokeWidth={0.5} />
          {profile.map((p,i)=>{
            const h = Math.abs(p.netGex)/maxAbs * (H-padT-padB-10);
            const isPos = p.netGex>=0;
            const x = xScale(i);
            const y = isPos ? (H-padB-h) : (H-padB);
            return <g key={i}><rect x={x} y={isPos?y:H-padB} width={barW} height={isPos?h:Math.min(h,20)} fill={isPos?'var(--positive)':'var(--negative)'} opacity={0.85} rx={1} /><title>{`${p.strike}: ${p.netGex}B`}</title></g>;
          })}
          {profile.map((p,i)=> i%Math.ceil(profile.length/12)===0 ? <text key={i} x={xScale(i)+barW/2} y={H-2} fontSize={6} fill="var(--text-faint)" textAnchor="middle">{p.strike}</text> : null)}
          <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="var(--text-faint)" strokeWidth={0.8} strokeDasharray="2 2" />
          <text x={W-padR-2} y={padT+8} fontSize={7} fill="var(--text-faint)" textAnchor="end">GEX B</text>
        </svg>
        <div style={{display:'grid',gridTemplateColumns:'56px 66px 66px 56px 1fr',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--panel-bg)'}}>
          <span>STRIKE</span><span style={{textAlign:'right'}}>CALL GEX</span><span style={{textAlign:'right'}}>PUT GEX</span><span style={{textAlign:'right'}}>NET</span><span style={{textAlign:'right'}}>OI</span>
        </div>
        {profile.slice().sort((a,b)=>Math.abs(b.netGex)-Math.abs(a.netGex)).slice(0,30).map(p=>(
          <div key={p.strike} style={{display:'grid',gridTemplateColumns:'56px 66px 66px 56px 1fr',padding:'2px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',background: Math.abs(p.strike - data.spot)<data.spot*0.02?'var(--accent-soft)':undefined}}>
            <span style={{fontWeight:700,color: Math.abs(p.strike-data.spot)<2?'var(--accent)':'var(--text-bright)'}}>{p.strike}</span>
            <span style={{textAlign:'right',color:'var(--positive)'}}>{p.callGex>0?`+${p.callGex}`:p.callGex}</span>
            <span style={{textAlign:'right',color:'var(--negative)'}}>{p.putGex}</span>
            <span style={{textAlign:'right',fontWeight:700,color:p.netGex>=0?'var(--positive)':'var(--negative)'}}>{p.netGex}</span>
            <span style={{textAlign:'right',color:'var(--text-mute)'}}>{p.totalOi.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div style={{padding:'2px 8px',fontSize:8,color:'var(--text-faint)',borderTop:'1px solid var(--border)'}}>GEX = γ × OI × 100 × S² / 1B · LONG GAMMA PINS PRICE · SHORT GAMMA AMPLIFIES</div>
    </div>
  );
}
