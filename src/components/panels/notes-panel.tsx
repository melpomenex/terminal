'use client';
import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

interface Note { id:string; symbol:string; text:string; tag:string; createdAt:string; }

export default function NotesPanel({ panelId }: { panelId?: string }) {
  const { symbol } = useTerminalContext();
  const [notes,setNotes]=useState<Note[]>(()=>{ if(typeof window==='undefined') return []; try{ return JSON.parse(localStorage.getItem('blm_notes')||'[]'); }catch{return [];} });
  const [text,setText]=useState('');
  const [tag,setTag]=useState('IDEA');
  const [filter,setFilter]=useState<'ALL'|string>('ALL');
  useEffect(()=>{ try{ localStorage.setItem('blm_notes', JSON.stringify(notes)); }catch{} },[notes]);
  const add=()=>{
    if (!text.trim()) return;
    const n:Note={id: crypto.randomUUID(), symbol, text: text.trim(), tag, createdAt: new Date().toISOString()};
    setNotes([n,...notes]); setText('');
  };
  const filtered = notes.filter(n=> {
    if (filter!=='ALL' && n.tag!==filter && n.symbol!==filter) return false;
    return true;
  });
  const tags = ['ALL','IDEA','RISK','EARNINGS','FLOW','LONG','SHORT'];
  const symNotes = notes.filter(n=>n.symbol===symbol);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700}}>NOTES · <span style={{color:'var(--accent)'}}>{symbol}</span> · {symNotes.length}</span>
        <div style={{display:'flex',gap:2,marginLeft:8}}>
          {tags.map(t=><button key={t} onClick={()=>setFilter(t as any)} style={{fontSize:8,padding:'1px 5px',border:`1px solid ${filter===t?'var(--accent)':'var(--border-soft)'}`,background:filter===t?'var(--accent-soft)':'transparent',color:filter===t?'var(--accent)':'var(--text-dim)'}}>{t}</button>)}
        </div>
      </div>
      <div style={{padding:'6px 8px',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-soft)',display:'flex',gap:6,flexShrink:0}}>
        <select value={tag} onChange={e=>setTag(e.target.value)} style={{background:'var(--surface-sunken)',border:'1px solid var(--border-soft)',color:'var(--text-bright)',fontSize:10,padding:'3px 6px',borderRadius:2}}>
          {['IDEA','RISK','EARNINGS','FLOW','LONG','SHORT','WATCH'].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') add(); }} placeholder={`NOTE FOR ${symbol}…`} style={{flex:1,background:'var(--surface-sunken)',border:'1px solid var(--border-soft)',borderRadius:2,padding:'4px 8px',fontSize:11,color:'var(--text-bright)'}} />
        <button onClick={add} style={{fontSize:10,padding:'3px 10px',background:'var(--accent)',color:'#000',fontWeight:700,borderRadius:2}}>ADD</button>
      </div>
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {filtered.length===0 && <div style={{padding:12,color:'var(--text-dim)',fontSize:11}}>NO NOTES YET — PRESS ADD TO JOURNAL {symbol}</div>}
        {filtered.map(n=>(
          <div key={n.id} style={{padding:'6px 8px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:8,background: n.symbol===symbol?'var(--accent-soft)':'transparent'}}>
            <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
              <span style={{fontSize:8,padding:'1px 5px',borderRadius:2,background: n.tag==='LONG'?'var(--positive-soft)':n.tag==='SHORT'?'var(--negative-soft)':'var(--surface-sunken)',color: n.tag==='LONG'?'var(--positive)':n.tag==='SHORT'?'var(--negative)':'var(--text-dim)',border:'1px solid var(--border-soft)',fontWeight:700}}>{n.tag}</span>
              <span style={{fontSize:8,color:'var(--text-faint)'}}>{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{fontWeight:700,color:'var(--accent)',fontSize:11}}>{n.symbol}</span><span style={{fontSize:11,color:'var(--text-bright)',wordBreak:'break-word'}}>{n.text}</span></div>
            </div>
            <button onClick={()=>setNotes(notes.filter(x=>x.id!==n.id))} style={{fontSize:12,color:'var(--text-faint)',flexShrink:0}}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
