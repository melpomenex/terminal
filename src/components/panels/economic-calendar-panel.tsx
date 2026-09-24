'use client';

import { useEffect, useState, useMemo } from 'react';

interface CalendarEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
}

const IMPACT_COLORS: Record<string, string> = {
  High: 'var(--amber-bright)',
  Medium: 'var(--amber)',
  Low: 'var(--amber-dim)',
  Holiday: 'var(--amber-dim)',
};

const COLS = '52px 44px 40px 1fr 44px 52px 52px';

const BTN = (active: boolean) => ({
  fontSize: 10,
  fontFamily: 'var(--font)',
  padding: '1px 5px',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  background: active ? 'var(--amber)' : 'transparent',
  color: active ? '#000' : 'var(--amber-dim)',
  cursor: 'pointer',
  borderRadius: 0,
  whiteSpace: 'nowrap' as const,
});

function n(val: string | undefined) {
  return val && val.trim() ? val.trim() : 'N/A';
}

function parseEvents(raw: CalendarEvent[]) {
  return raw
    .filter((e) => e.date)
    .map((e) => ({ ...e, ts: new Date(e.date!).getTime() }))
    .sort((a, b) => a.ts - b.ts);
}

export default function EconomicCalendarPanel({ panelId }: { panelId?: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<Set<string>>(new Set());
  const [impacts, setImpacts] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchCalendar() {
      try {
        const res = await fetch('/api/yfin/economic-calendar');
        const json = await res.json();
        if (!cancelled) {
          const items = parseEvents(json.items ?? []);
          setEvents(items);
          const cSet = new Set<string>();
          items.forEach((e: CalendarEvent) => {
            if (e.country && e.country !== 'All') cSet.add(e.country);
          });
          setCurrencies(cSet);
          setImpacts(new Set(['High', 'Medium', 'Low']));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCalendar();
    return () => { cancelled = true; };
  }, []);

  const toggleCurrency = (c: string) => {
    setCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const toggleImpact = (imp: string) => {
    setImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(imp)) next.delete(imp);
      else next.add(imp);
      return next;
    });
  };

  const allCurrencies = useMemo(() => [...currencies].sort(), [currencies]);
  const impactLevels = ['High', 'Medium', 'Low'];

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (e.country === 'All' || currencies.has(e.country ?? '')) &&
          (impacts.has(e.impact ?? '') || !impactLevels.includes(e.impact ?? '')),
      ),
    [events, currencies, impacts],
  );

  if (loading) {
    return (
      <div style={{ padding: 8, color: 'var(--amber-dim)', fontFamily: 'var(--font)', fontSize: 12 }}>
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font)' }}>
      {/* Filters */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        {impactLevels.map((imp) => (
          <button key={imp} onClick={() => toggleImpact(imp)} style={BTN(impacts.has(imp))}>
            {imp.toUpperCase().slice(0, 4)}
          </button>
        ))}
        <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
        {allCurrencies.map((c) => (
          <button key={c} onClick={() => toggleCurrency(c)} style={BTN(currencies.has(c))}>
            {c}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div
        style={{
          padding: '3px 8px',
          fontSize: 10,
          color: 'var(--amber-dim)',
          display: 'grid',
          gridTemplateColumns: COLS,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>DATE</span>
        <span>TIME</span>
        <span>CCY</span>
        <span>EVENT</span>
        <span>IMP</span>
        <span style={{ textAlign: 'right' }}>FORECAST</span>
        <span style={{ textAlign: 'right' }}>PREV</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 8, color: 'var(--amber-dim)', fontSize: 12 }}>No events this week</div>
        ) : (
          filtered.map((e, i) => {
            const d = new Date(e.date!);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const impactColor = IMPACT_COLORS[e.impact || ''] || 'var(--amber-dim)';

            return (
              <div
                key={`${e.title}-${e.country}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: 'var(--amber)',
                  borderBottom: '1px solid #0a0700',
                }}
              >
                <span style={{ color: 'var(--amber-dim)', fontSize: 10 }}>{dateStr}</span>
                <span style={{ color: 'var(--amber-dim)', fontSize: 10 }}>{timeStr}</span>
                <span style={{ color: impactColor, fontWeight: 700, fontSize: 10 }}>{n(e.country)}</span>
                <span style={{ color: 'var(--amber)', lineHeight: 1.3 }} className="glow">{n(e.title)}</span>
                <span style={{ color: impactColor, fontSize: 10 }}>{(e.impact || '').toUpperCase().slice(0, 3)}</span>
                <span style={{ textAlign: 'right', color: 'var(--amber-dim)', fontSize: 10 }}>{n(e.forecast)}</span>
                <span style={{ textAlign: 'right', color: 'var(--amber-dim)', fontSize: 10 }}>{n(e.previous)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
