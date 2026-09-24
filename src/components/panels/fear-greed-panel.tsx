'use client';
import { useEffect, useState } from 'react';

function meterColor(score:number){
  if (score<25) return '#ef4444';
  if (score<45) return '#f97316';
  if (score<55) return '#eab308';
  if (score<75) return '#22c55e';
  return '#10b981';
}
function ratingColor(rating:string){
  const lo = rating.toLowerCase();
  if (lo.includes('extreme fear')) return '#ef4444';
  if (lo.includes('fear')) return '#f97316';
  if (lo.includes('greed') && lo.includes('extreme')) return '#10b981';
  if (lo.includes('greed')) return '#22c55e';
  return '#eab308';
}

export default function FearGreedPanel({ panelId }: { panelId?: string }) {
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/yfin/fear-greed').then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
    const id=setInterval(()=>fetch('/api/yfin/fear-greed').then(r=>r.json()).then(setData), 120000);
    return ()=>clearInterval(id);
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING FEAR & GREED…</div>;
  if (!data) return <div style={{padding:8,color:'var(--negative)'}}>NO DATA</div>;
  const score = data.score ?? 50;
  const col = meterColor(score);
  const hist = (data.history??[]).slice(-90);
  const min = Math.min(...hist.map((h:any)=>h.y),0);
  const max = Math.max(...hist.map((h:any)=>h.y),100);
  const W=340,H=100, padL=24, padR=8, padT=8, padB=18;
  const xScale=(i:number)=>padL + (i/Math.max(1,hist.length-1))*(W-padL-padR);
  const yScale=(v:number)=>padT + (1-(v-min)/(max-min||1))*(H-padT-padB);
  const gaugeAngle = -90 + (score/100)*180;
  const rad = (deg:number)=>deg*Math.PI/180;
  const R=58, cx=70, cy=74;
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'auto',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--text-bright)'}}>FEAR & GREED</span>
        <span style={{fontSize:9,color:'var(--text-dim)'}}>{data.timestamp?new Date(data.timestamp).toLocaleDateString():''}</span>
      </div>
      <div style={{display:'flex',gap:12,padding:'10px 12px',flexWrap:'wrap'}}>
        <svg width={140} height={90} viewBox="0 0 140 90" style={{flexShrink:0}}>
          <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke="var(--border)" strokeWidth={8} />
          <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(score/100)*Math.PI*R} ${Math.PI*R}`} />
          {[0,25,50,75,100].map(v=>{
            const ang=rad(-90 + (v/100)*180);
            const x1=cx + (R-6)*Math.cos(ang);
            const y1=cy + (R-6)*Math.sin(ang);
            const x2=cx + (R+2)*Math.cos(ang);
            const y2=cy + (R+2)*Math.sin(ang);
            return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-faint)" strokeWidth={0.8} />;
          })}
          {(()=>{ const ang=rad(gaugeAngle); const nx=cx+(R-12)*Math.cos(ang); const ny=cy+(R-12)*Math.sin(ang); return <><line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth={2} /><circle cx={cx} cy={cy} r={4} fill={col} /></>; })()}
          <text x={cx} y={cy-2} textAnchor="middle" fill={col} fontSize={22} fontWeight={700} fontFamily="var(--font)">{score}</text>
          <text x={cx} y={cy+12} textAnchor="middle" fill="var(--text-dim)" fontSize={8} fontWeight={700}>{data.label}</text>
        </svg>
        <div style={{display:'flex',flexDirection:'column',gap:6,minWidth:120}}>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <div style={{fontSize:9,color:'var(--text-dim)'}}>PREV CLOSE <span style={{color:col,fontWeight:700,marginLeft:6}}>{data.previousClose}</span></div>
            <div style={{fontSize:9,color:'var(--text-dim)'}}>1 WEEK AGO <span style={{color:'var(--text-bright)',fontWeight:700,marginLeft:6}}>{data.previousWeek}</span></div>
            <div style={{fontSize:9,color:'var(--text-dim)'}}>1 MONTH AGO <span style={{color:'var(--text-bright)',marginLeft:6}}>{data.previousMonth}</span></div>
            <div style={{fontSize:9,color:'var(--text-dim)'}}>1 YEAR AGO <span style={{color:'var(--text-bright)',marginLeft:6}}>{data.previousYear}</span></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'12px 1fr auto',gap:2,marginTop:4}}>
            {[
              {l:'0 EXTREME FEAR',c:'#ef4444'},
              {l:'25 FEAR',c:'#f97316'},
              {l:'50 NEUTRAL',c:'#eab308'},
              {l:'75 GREED',c:'#22c55e'},
              {l:'100 EXT GREED',c:'#10b981'},
            ].map(r=><div key={r.l} style={{display:'contents'}}><span style={{width:10,height:6,background:r.c,display:'inline-block',borderRadius:2,marginTop:2}} /><span style={{fontSize:8,color:'var(--text-mute)'}}>{r.l}</span><span /></div>)}
          </div>
        </div>
      </div>
      <div style={{padding:'0 8px'}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--text-dim)',letterSpacing:0.5,marginBottom:4}}>HISTORY (90D)</div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',background:'rgba(0,0,0,0.2)',borderRadius:3}}>
          <line x1={padL} y1={padT} x2={padL} y2={H-padB} stroke="var(--border-soft)" strokeWidth={0.5} />
          <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="var(--border-soft)" strokeWidth={0.5} />
          {hist.length>1 && <polyline points={hist.map((h:any,i:number)=>`${xScale(i)},${yScale(h.y)}`).join(' ')} fill="none" stroke={col} strokeWidth={1.2} />}
          {hist.length>1 && <polygon points={`${xScale(0)},${H-padB} ${hist.map((h:any,i:number)=>`${xScale(i)},${yScale(h.y)}`).join(' ')} ${xScale(hist.length-1)},${H-padB}`} fill={col} opacity={0.08} />}
          <text x={padL} y={padT+8} fill="var(--text-faint)" fontSize={7}>100</text>
          <text x={padL} y={H-padB-2} fill="var(--text-faint)" fontSize={7}>0</text>
          {[0,30,60].filter(i=>hist[i]).map((_, idx)=>{
            const i = [0, Math.floor(hist.length/2), hist.length-1][idx];
            const h = hist[i];
            if (!h) return null;
            return <text key={idx} x={xScale(i)} y={H-2} fill="var(--text-faint)" fontSize={6} textAnchor="middle">{h.x.slice(5)}</text>;
          })}
        </svg>
      </div>
      <div style={{padding:'6px 8px',display:'flex',flexDirection:'column',gap:3,marginTop:6}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--text-dim)',letterSpacing:0.5}}>7 INDICATORS</div>
        {(data.indicators??[]).map((ind:any)=>(
          <div key={ind.name} style={{display:'flex',alignItems:'center',gap:6,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
            <span style={{fontSize:10,color:'var(--text-bright)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ind.name.toUpperCase()}</span>
            <div style={{width:70,height:4,background:'var(--surface-sunken)',borderRadius:2,overflow:'hidden'}}>
              <div style={{width:`${Math.max(2,ind.score)}%`,height:'100%',background: meterColor(ind.score)}} />
            </div>
            <span style={{fontSize:10,fontWeight:700,color: ratingColor(ind.rating),minWidth:28,textAlign:'right'}}>{ind.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
