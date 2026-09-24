'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

export default function SuperInvestorPanel({ panelId }: { panelId?: string }) {
  const { setSymbol } = useTerminalContext();
  const [investors,setInvestors]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/superinvestors/holdings').then(r=>r.json()).then(d=>{ setInvestors(d.investors??[]); setSelected(d.investors?.[0]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);
  if (loading) return <div style={{padding:8,color:'var(--text-dim)'}}>LOADING WHALES…</div>;
  return (
    <div style={{display:'flex',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{width:180,borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'4px 8px',fontSize:9,fontWeight:700,color:'var(--text-dim)',borderBottom:'1px solid var(--border)'}}>SUPERINVESTORS · 13F</div>
        <div style={{flex:1,overflow:'auto'}}>
          {investors.map(inv=>(
            <div key={inv.fund} onClick={()=>setSelected(inv)} style={{padding:'6px 8px',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.03)',background: selected?.fund===inv.fund?'var(--accent-soft)':undefined}} className="row-hover">
              <div style={{fontSize:11,fontWeight:700,color: selected?.fund===inv.fund?'var(--accent)':'var(--text-bright)'}}>{inv.name}</div>
              <div style={{fontSize:9,color:'var(--text-mute)'}}>{inv.fund}</div>
              <div style={{display:'flex',gap:4,marginTop:2}}><span style={{fontSize:8,background:'var(--surface-sunken)',padding:'1px 4px',borderRadius:2}}>{inv.aum}</span><span style={{fontSize:8,color:inv.activity==='BUYING'?'var(--positive)':'var(--negative)'}}>{inv.activity}</span><span style={{fontSize:8,color: inv.performance>=0?'var(--positive)':'var(--negative)'}}>{inv.performance>0?'+':''}{inv.performance}%</span></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {selected ? (
          <>
            <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:36,height:36,borderRadius:18,background:selected.color,color:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>{selected.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-bright)'}}>{selected.name} · {selected.fund}</div>
                <div style={{fontSize:10,color:'var(--text-dim)'}}>{selected.quarter} · {selected.aum} AUM · TOP {selected.topHolding}</div>
              </div>
            </div>
            <div style={{padding:'6px 8px',display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(70px, 1fr))',gap:6,overflow:'auto',flex:1}}>
              {selected.holdings.map((h:string)=>(
                <button key={h} onClick={()=>setSymbol(h)} style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',borderRadius:4,padding:'8px 6px',cursor:'pointer',textAlign:'center'}} className="row-hover">
                  <div style={{fontSize:12,fontWeight:700,color:'var(--accent)'}}>{h}</div>
                  <div style={{fontSize:8,color:'var(--text-dim)',marginTop:2}}>13F HOLD</div>
                </button>
              ))}
            </div>
          </>
        ) : <div style={{padding:12,color:'var(--text-dim)'}}>SELECT INVESTOR</div>}
      </div>
    </div>
  );
}
