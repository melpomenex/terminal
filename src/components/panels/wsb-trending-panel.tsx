'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function WsbTrendingPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/wsb/trending').then(r=>r.json()).then(d=>{setData(d); setLoading(false);}).catch(()=>setLoading(false));
    const id=setInterval(()=>fetch('/api/wsb/trending').then(r=>r.json()).then(setData), 120000);
    return ()=>clearInterval(id);
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>SCANNING WSB…</div>;
  const trending = data?.trending??[];
  const posts = data?.posts??[];
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>WSB · RETAIL FLOW</span>
        <span style={{fontSize:8,color:'var(--text-dim)'}}>r/wallstreetbets + r/stocks · {trending.length} TICKERS</span>
      </div>
      <div style={{display:'flex',flex:1,minHeight:0}}>
        <div style={{flex:'0 0 46%',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'56px 48px 1fr',padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}>
            <span>TICKER</span><span style={{textAlign:'right'}}>HITS</span><span>SENT</span>
          </div>
          <div style={{flex:1,overflow:'auto'}}>
            {trending.map((t:any,i:number)=>(
              <div key={t.symbol} onClick={()=>setSymbol(t.symbol)} style={{display:'grid',gridTemplateColumns:'56px 48px 1fr',padding:'4px 8px',fontSize:11,cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.03)',background:i<3?'var(--accent-soft)':undefined}} className="row-hover">
                <span style={{fontWeight:700,color:'var(--accent)'}}>{t.symbol}</span>
                <span style={{textAlign:'right',fontWeight:700,color:t.mentions>10?'var(--accent)':'var(--text-bright)'}}>{t.mentions}</span>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{color:t.sentiment==='bullish'?'var(--positive)':t.sentiment==='bearish'?'var(--negative)':'var(--text-dim)',fontWeight:700,fontSize:10}}>{t.sentiment==='bullish'?'▲ BULL':t.sentiment==='bearish'?'▼ BEAR':'NEUT'}</span>{i<3 && <span style={{fontSize:8,background:'var(--accent)',color:'#000',padding:'0 3px',borderRadius:2}}>HOT</span>}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'3px 8px',fontSize:8,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}>TOP POSTS</div>
          <div style={{flex:1,overflow:'auto'}}>
            {posts.slice(0,20).map((p:any,i:number)=>(
              <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{display:'block',padding:'4px 8px',borderBottom:'1px solid rgba(255,255,255,0.03)',textDecoration:'none'}} className="row-hover">
                <div style={{fontSize:11,color:'var(--text-bright)',lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.title}</div>
                <div style={{fontSize:8,color:'var(--text-faint)',marginTop:2}}>r/{p.sub} · {p.score}↑ {p.num_comments}💬 · {p.created_utc? new Date(p.created_utc*1000).toLocaleTimeString():''}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
