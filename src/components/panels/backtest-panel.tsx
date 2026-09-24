'use client';
import { useMemo, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { sma, ema, rsi } from '@/lib/indicators';

type Strat = 'SMA_CROSS'|'EMA_CROSS'|'RSI_REVERSION';

export default function BacktestPanel({ panelId }: { panelId?: string }) {
  const { chart, symbol } = useTerminalContext();
  const [strat,setStrat]=useState<Strat>('SMA_CROSS');
  const [fast,setFast]=useState(20);
  const [slow,setSlow]=useState(50);
  const [rsiPeriod,setRsiPeriod]=useState(14);
  const result = useMemo(()=>{
    if (!chart?.close?.length) return null;
    const close = chart.close as number[];
    let buySell: {type:'BUY'|'SELL', idx:number, price:number}[]=[];
    let equity: number[]=[];
    if (strat==='SMA_CROSS' || strat==='EMA_CROSS') {
      const f = strat==='SMA_CROSS' ? sma(close, fast) : ema(close, fast);
      const s = strat==='SMA_CROSS' ? sma(close, slow) : ema(close, slow);
      let pos=false;
      let entry=0;
      let eq=10000;
      for (let i=1;i<close.length;i++) {
        const pf=f[i-1], ps=s[i-1], cf=f[i], cs=s[i];
        if (pf==null||ps==null||cf==null||cs==null) { equity.push(eq); continue; }
        if (!pos && pf<=ps && cf>cs) { pos=true; entry=close[i]; buySell.push({type:'BUY', idx:i, price:close[i]}); }
        else if (pos && pf>=ps && cf<cs) { pos=false; const ret=(close[i]-entry)/entry; eq=eq*(1+ret); buySell.push({type:'SELL', idx:i, price:close[i]}); }
        equity.push(eq);
      }
      const totalReturn = (equity[equity.length-1]-10000)/10000*100;
      const buyHold = (close[close.length-1]-close[0])/close[0]*100;
      const wins = buySell.filter((_,idx)=> idx%2===1).length;
      return { equity, buySell, totalReturn, buyHold, trades: Math.floor(buySell.length/2), win: eq };
    } else {
      const r = rsi(close, rsiPeriod);
      let eq=10000; let pos=false; let entry=0;
      for (let i=0;i<close.length;i++) {
        const rv=r[i];
        if (rv==null){ equity.push(eq); continue; }
        if (!pos && rv<30){ pos=true; entry=close[i]; buySell.push({type:'BUY', idx:i, price:close[i]}); }
        else if (pos && rv>70){ pos=false; const ret=(close[i]-entry)/entry; eq=eq*(1+ret); buySell.push({type:'SELL', idx:i, price:close[i]}); }
        equity.push(eq);
      }
      const totalReturn = (equity[equity.length-1]-10000)/10000*100;
      const buyHold = (close[close.length-1]-close[0])/close[0]*100;
      return { equity, buySell, totalReturn, buyHold, trades: Math.floor(buySell.length/2), win: eq };
    }
  },[chart, strat, fast, slow, rsiPeriod]);

  if (!chart) return <div style={{padding:8,color:'var(--text-dim)'}}>LOAD A SYMBOL TO BACKTEST</div>;
  const eq = result?.equity??[];
  const W=360,H=100, padL=40, padR=10, padT=10, padB=18;
  const min = eq.length? Math.min(...eq):0;
  const max = eq.length? Math.max(...eq):1;
  const range = max-min||1;
  const xScale=(i:number)=>padL + (i/Math.max(1,eq.length-1))*(W-padL-padR);
  const yScale=(v:number)=>padT + (1-(v-min)/range)*(H-padT-padB);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'auto',fontFamily:'var(--font)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderBottom:'1px solid var(--border)',flexShrink:0,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700}}>LAB · {symbol}</span>
        {(['SMA_CROSS','EMA_CROSS','RSI_REVERSION'] as Strat[]).map(s=>(
          <button key={s} onClick={()=>setStrat(s)} style={{fontSize:9,padding:'1px 6px',border:`1px solid ${strat===s?'var(--accent)':'var(--border-soft)'}`,background: strat===s?'var(--accent-soft)':'transparent',color: strat===s?'var(--accent)':'var(--text-dim)'}}>{s.replace('_',' ')}</button>
        ))}
        {strat!=='RSI_REVERSION' ? (
          <>
            <span style={{fontSize:9,color:'var(--text-dim)'}}>FAST <input type="number" value={fast} onChange={e=>setFast(Number(e.target.value))} style={{width:40,background:'var(--surface-sunken)',border:'1px solid var(--border)',color:'var(--text-bright)',fontSize:10}} /></span>
            <span style={{fontSize:9,color:'var(--text-dim)'}}>SLOW <input type="number" value={slow} onChange={e=>setSlow(Number(e.target.value))} style={{width:40,background:'var(--surface-sunken)',border:'1px solid var(--border)',color:'var(--text-bright)',fontSize:10}} /></span>
          </>
        ) : (
          <span style={{fontSize:9,color:'var(--text-dim)'}}>RSI <input type="number" value={rsiPeriod} onChange={e=>setRsiPeriod(Number(e.target.value))} style={{width:40,background:'var(--surface-sunken)',border:'1px solid var(--border)',color:'var(--text-bright)',fontSize:10}} /></span>
        )}
      </div>
      {result && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6,padding:'6px 8px'}}>
            {[
              {l:'TOTAL RET', v:`${result.totalReturn>0?'+':''}${result.totalReturn.toFixed(2)}%`, col: result.totalReturn>=0?'var(--positive)':'var(--negative)'},
              {l:'BUY & HOLD', v:`${result.buyHold>0?'+':''}${result.buyHold.toFixed(2)}%`, col: result.buyHold>=0?'var(--positive)':'var(--negative)'},
              {l:'TRADES', v:`${result.trades}`, col:'var(--text-bright)'},
              {l:'EQUITY', v:`$${result.win.toFixed(0)}`, col:'var(--accent)'},
            ].map(c=><div key={c.l} style={{background:'var(--surface-raised)',border:'1px solid var(--border-soft)',borderRadius:3,padding:'4px 6px',textAlign:'center'}}><div style={{fontSize:7,color:'var(--text-faint)'}}>{c.l}</div><div style={{fontSize:12,fontWeight:700,color:c.col}}>{c.v}</div></div>)}
          </div>
          <div style={{padding:'0 8px'}}>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',background:'rgba(0,0,0,0.2)',borderRadius:3}}>
              <line x1={padL} y1={yScale(10000)} x2={W-padR} y2={yScale(10000)} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
              {eq.length>1 && <polyline points={eq.map((v,i)=>`${xScale(i)},${yScale(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
              {result.buySell.map((bs,i)=>(
                <circle key={i} cx={xScale(bs.idx)} cy={yScale(eq[bs.idx]??10000)} r={3} fill={bs.type==='BUY'?'var(--positive)':'var(--negative)'}><title>{`${bs.type} @ ${bs.price.toFixed(2)}`}</title></circle>
              ))}
            </svg>
          </div>
          <div style={{padding:'4px 8px',maxHeight:120,overflow:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'48px 70px 70px 1fr',padding:'2px 4px',fontSize:8,color:'var(--text-dim)'}}><span>SIDE</span><span>PRICE</span><span>P/L</span><span>DATE</span></div>
            {result.buySell.map((bs,i)=>{
              const prev = i>0? result.buySell[i-1]:null;
              const pnl = prev && bs.type==='SELL' ? (bs.price-prev.price)/prev.price*100 : null;
              const ts = chart.timestamps[bs.idx];
              return <div key={i} style={{display:'grid',gridTemplateColumns:'48px 70px 70px 1fr',padding:'2px 4px',fontSize:11,background: bs.type==='BUY'?'rgba(0,176,80,0.06)':'rgba(239,68,68,0.06)'}}>
                <span style={{color:bs.type==='BUY'?'var(--positive)':'var(--negative)',fontWeight:700}}>{bs.type}</span>
                <span>{bs.price.toFixed(2)}</span>
                <span style={{color: pnl!=null? (pnl>=0?'var(--positive)':'var(--negative)'):'var(--text-mute)'}}>{pnl!=null?`${pnl>0?'+':''}${pnl.toFixed(2)}%`:'--'}</span>
                <span style={{color:'var(--text-faint)',fontSize:10}}>{ts? new Date(ts*1000).toLocaleDateString():''}</span>
              </div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
