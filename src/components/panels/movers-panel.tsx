'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

type MoverType = 'gainers'|'losers'|'active'|'unusual';

export default function MoversPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [type,setType]=useState<MoverType>('gainers');
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const load=async (t:MoverType)=>{
    setLoading(true);
    try { const r=await fetch(`/api/yfin/market-movers?type=${t}`); const j=await r.json(); setItems(j.items??[]);} catch {} finally { setLoading(false); }
  };
  useEffect(()=>{ load(type); },[type]);
  useEffect(()=>{ const id=setInterval(()=>load(type), 45000); return ()=>clearInterval(id); },[type]);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>MOVERS</span>
        {(['gainers','losers','active','unusual'] as MoverType[]).map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{fontSize:9,padding:'1px 7px',border:`1px solid ${type===t?'var(--accent)':'var(--border-soft)'}`,background:type===t?'var(--accent-soft)':'transparent',color:type===t?'var(--accent)':'var(--text-dim)',textTransform:'uppercase'}}>{t}</button>
        ))}
        {loading && <span style={{marginLeft:'auto',fontSize:9,color:'var(--text-dim)'}}>LOADING…</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'56px 1fr 54px 54px 1fr',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span>SYMBOL</span><span>NAME</span><span style={{textAlign:'right'}}>PRICE</span><span style={{textAlign:'right'}}>{type==='active'?'VOL':type==='unusual'?'V/AVG':'CHG%'}</span><span style={{textAlign:'right'}}>VOL</span>
      </div>
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {items.map((it:any,i:number)=>{
          const up = it.changePercent>=0;
          return (
            <div key={it.symbol} onClick={()=>setSymbol(it.symbol)} style={{display:'grid',gridTemplateColumns:'56px 1fr 54px 54px 1fr',padding:'4px 8px',fontSize:11,borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer',background:i%2===0?'transparent':'var(--row-stripe)'}} className="row-hover">
              <span style={{fontWeight:700,color:'var(--accent)'}}>{it.symbol}</span>
              <span style={{color:'var(--text-mute)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:10}}>{it.name?.slice(0,28)}</span>
              <span style={{textAlign:'right',color:'var(--text-bright)',fontVariantNumeric:'tabular-nums'}}>{it.price?.toFixed(2)}</span>
              <span style={{textAlign:'right',fontWeight:700,color: type==='losers'?'var(--negative)':type==='active'?'var(--text-dim)': up?'var(--positive)':'var(--negative)'}}>
                {type==='active'? (it.volume>=1e6?`${(it.volume/1e6).toFixed(1)}M`:`${(it.volume/1e3).toFixed(0)}k`) : type==='unusual'? `${it.unusualRatio?.toFixed(1)}x` : `${up?'+':''}${it.changePercent?.toFixed(2)}%`}
              </span>
              <span style={{textAlign:'right',color:'var(--text-faint)',fontSize:10}}>{it.volume>=1e6?`${(it.volume/1e6).toFixed(2)}M`:`${(it.volume/1000).toFixed(0)}K`}{type==='unusual' && it.unusualRatio>2?' 🔥':''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
