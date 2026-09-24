'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function MarketBreadthPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const fetchBreadth = async ()=>{
    try { const r=await fetch('/api/yfin/market-breadth'); const j=await r.json(); setData(j); } catch {} finally { setLoading(false); }
  };
  useEffect(()=>{ fetchBreadth(); const id=setInterval(fetchBreadth, 60000); return ()=>clearInterval(id); },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING BREADTH…</div>;
  if (!data) return <div style={{padding:8,color:'var(--negative)'}}>NO DATA</div>;
  const adv = data.advances||0, dec=data.declines||0, total=adv+dec+ (data.unchanged||0);
  const advPct = total? Math.round(adv/total*100):0;
  const decPct = total? Math.round(dec/total*100):0;
  const breadth = data.breadth??[];
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--text-bright)'}}>MARKET INTERNALS</span>
        <span style={{fontSize:9,color:'var(--text-dim)'}}>S&P 100 SAMPLE</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,padding:'6px 8px',flexShrink:0}}>
        {[
          {label:'ADVANCES', value: adv, col:'var(--positive)', sub: `${advPct}%`},
          {label:'DECLINES', value: dec, col:'var(--negative)', sub: `${decPct}%`},
          {label:'A/D RATIO', value: data.adRatio, col: data.adRatio>1?'var(--positive)':'var(--negative)'},
        ].map(c=>(
          <div key={c.label} style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',borderRadius:3,padding:'6px 8px',textAlign:'center'}}>
            <div style={{fontSize:8,color:'var(--text-dim)',letterSpacing:0.5}}>{c.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:c.col,lineHeight:1.2}}>{c.value}</div>
            {c.sub && <div style={{fontSize:9,color:'var(--text-mute)'}}>{c.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:4,padding:'0 8px 6px',flexShrink:0}}>
        {[
          {l:'NEW HIGHS',v:data.newHighs,col:'var(--positive)'},
          {l:'NEW LOWS',v:data.newLows,col:'var(--negative)'},
          {l:'AVG CHG',v:`${data.avgChange>0?'+':''}${data.avgChange}%`,col:data.avgChange>=0?'var(--positive)':'var(--negative)'},
          {l:'TRIN PROXY',v:data.trinProxy,col:data.trinProxy>1?'var(--negative)':'var(--positive)'},
        ].map(c=>(
          <div key={c.l} style={{background:'var(--surface-sunken)',padding:'4px 6px',borderRadius:2,textAlign:'center',border:`1px solid ${c.col}22`}}>
            <div style={{fontSize:7,color:'var(--text-faint)'}}>{c.l}</div>
            <div style={{fontSize:11,fontWeight:700,color:c.col}}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'0 8px 4px',flexShrink:0}}>
        <div style={{display:'flex',height:8,background:'var(--surface-sunken)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border-soft)'}}>
          <div style={{width:`${advPct}%`,background:'var(--positive)',transition:'width 0.5s'}} />
          <div style={{width:`${decPct}%`,background:'var(--negative)',marginLeft:'auto'}} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'var(--text-faint)',marginTop:2}}>
          <span>▲ {adv} ADV</span><span>▼ {dec} DEC</span>
        </div>
      </div>
      <div style={{flex:1,minHeight:0,overflow:'auto',marginTop:4}}>
        <div style={{display:'grid',gridTemplateColumns:'32px 1fr 60px 60px',padding:'2px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--panel-bg)',zIndex:1}}>
          <span>#</span><span>SYMBOL</span><span style={{textAlign:'right'}}>PRICE</span><span style={{textAlign:'right'}}>% CHG</span>
        </div>
        {breadth.slice(0,60).map((b:any,i:number)=>{
          const up=b.chgPct>=0;
          return (
            <div key={b.symbol} onClick={()=>setSymbol(b.symbol)} style={{display:'grid',gridTemplateColumns:'32px 1fr 60px 60px',padding:'3px 8px',fontSize:11,cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.03)',background:i%2===0?'transparent':'var(--row-stripe)'}} className="row-hover">
              <span style={{color:'var(--text-faint)'}}>{i+1}</span>
              <span style={{fontWeight:700,color:up?'var(--text-bright)':'var(--text-bright)'}}>{b.symbol}</span>
              <span style={{textAlign:'right',color:'var(--text-bright)',fontVariantNumeric:'tabular-nums'}}>{b.price?.toFixed(2)}</span>
              <span style={{textAlign:'right',fontWeight:700,color:up?'var(--positive)':'var(--negative)',fontVariantNumeric:'tabular-nums'}}>{`${up?'+':''}${b.chgPct.toFixed(2)}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
