'use client';

import type { ChartData } from '@/lib/types';
import { useTerminalContext } from '@/context/terminal-context';

export default function SecurityDescription({ panelId }: { panelId?: string }) {
  const { chart, loading, watchlist } = useTerminalContext();

  if (loading) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING...</div>;
  if (!chart) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO DATA</div>;

  const quote = watchlist.find((w) => w.symbol === chart.symbol);
  const price = quote?.price ?? chart.price ?? 0;
  const prev = quote?.previousClose ?? chart.previousClose ?? 0;
  const change = quote?.change ?? (price - prev);
  const changePct = quote?.changePercent ?? (prev > 0 ? (change / prev) * 100 : 0);
  const isUp = change >= 0;
  const h52 = Number(chart.high52w) || 0;
  const l52 = Number(chart.low52w) || 0;
  const span = h52 - l52 || 1;
  const pct52 = Math.min(100, Math.max(0, ((price - l52) / span) * 100));
  const lastOpen = chart.open?.[chart.open.length - 1];
  const lastHigh = chart.high?.[chart.high.length - 1];
  const lastLow = chart.low?.[chart.low.length - 1];
  const lastClose = chart.close?.[chart.close.length - 1];
  const totalVol = chart.volume?.reduce((a, b) => a + (b || 0), 0) || 0;
  const avgVol = totalVol / (chart.timestamps.length || 1);

  const field = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', gap: 8 }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-bright)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );

  const clr = isUp ? 'var(--positive)' : 'var(--negative)';
  const fmtVol = (v: number) =>
    v > 1e9 ? `${(v / 1e9).toFixed(2)}B` :
    v > 1e6 ? `${(v / 1e6).toFixed(2)}M` :
    v > 1e3 ? `${(v / 1e3).toFixed(1)}K` :
    v.toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--row-stripe)' }}>
      <div style={{ padding: '6px 10px' }}>
        {/* Moniker header */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 6,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--accent)', letterSpacing: 0.5 }}>
              {chart.symbol}
            </div>
            <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--text-mute)', marginTop: 1 }}>
              {chart.exchange || 'US'} · {chart.currency || 'USD'} Equity
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', color: clr, fontVariantNumeric: 'tabular-nums' }}>
              {price.toFixed(2)}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: clr, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
            </div>
          </div>
        </div>

        {field('OPEN', lastOpen?.toFixed(2) ?? '---')}
        {field('HIGH', lastHigh?.toFixed(2) ?? '---')}
        {field('LOW', lastLow?.toFixed(2) ?? '---')}
        {field('CLOSE', lastClose?.toFixed(2) ?? '---')}
        {field('PREV CLOSE', chart.previousClose?.toFixed(2) ?? '---')}
        <div style={{ borderBottom: '1px solid var(--border-soft)', margin: '5px 0' }} />
        {field('VOLUME', fmtVol(totalVol))}
        {field('AVG VOL', fmtVol(avgVol))}
        <div style={{ borderBottom: '1px solid var(--border-soft)', margin: '5px 0' }} />
        <div style={{ padding: '2px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)', letterSpacing: 0.4 }}>52 WEEK RANGE</span>
            <span style={{ color: 'var(--text-mute)', fontSize: 'var(--font-size-xxs)' }}>{pct52.toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>{chart.low52w?.toFixed(2)}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--border-soft)', position: 'relative', borderRadius: 1 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: `${pct52}%`, height: '100%', background: 'var(--accent-dim)' }} />
              <div style={{ position: 'absolute', top: -2, left: `calc(${pct52}% - 1px)`, width: 2, height: 10, background: 'var(--accent-bright)' }} />
            </div>
            <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' }}>{chart.high52w?.toFixed(2)}</span>
          </div>
        </div>
        <div style={{ borderBottom: '1px solid var(--border-soft)', margin: '5px 0' }} />
        {field('EXCHANGE', chart.exchange ?? '---')}
        {field('CURRENCY', chart.currency ?? '---')}
        {field('BARS', `${chart.timestamps.length}`)}
      </div>
    </div>
  );
}
