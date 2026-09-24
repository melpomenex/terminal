'use client';

import { useState } from 'react';
import type { DataProvenance, QualityLevel } from '@/lib/types/provenance';
import { QUALITY_STYLES, provenanceAgeMs } from '@/lib/types/provenance';

interface ProvenanceBadgeProps {
  /** A full provenance record (preferred — enables latency details). */
  provenance?: DataProvenance;
  /** Or just a quality level, e.g. for statically-known panels. */
  quality?: QualityLevel;
  /** Override suffix, e.g. "15m" for delayed feeds. */
  suffix?: string;
  /** `compact` renders a dot + label; default renders a full pill. */
  compact?: boolean;
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return 'unknown age';
  if (ms < 1_000) return 'fresh';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

/**
 * Color-coded market data provenance pill. Every panel that renders market
 * data should carry one so users can inspect source, quality tier, and
 * retrieval latency. Hover reveals full provenance details.
 */
export default function ProvenanceBadge({ provenance, quality, suffix, compact }: ProvenanceBadgeProps) {
  const [showDetail, setShowDetail] = useState(false);

  const level: QualityLevel | undefined = provenance?.quality ?? quality;
  if (!level) return null;
  const style = QUALITY_STYLES[level];
  if (!style) return null;

  const label = suffix ? `${style.label} (${suffix})` : provenance?.delayMinutes ? `${style.label} (${provenance.delayMinutes}m)` : style.label;
  const latency = provenance ? formatLatency(provenanceAgeMs(provenance)) : null;

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={`Data provenance: ${label}. ${style.description}`}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        onFocus={() => setShowDetail(true)}
        onBlur={() => setShowDetail(false)}
        onClick={(e) => { e.stopPropagation(); setShowDetail((v) => !v); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 3 : 5,
          padding: compact ? '0 3px' : '1px 6px',
          background: 'transparent',
          border: `1px solid ${style.color}`,
          borderRadius: 'var(--radius-sm)',
          color: style.color,
          fontSize: 'var(--font-size-xxs)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          cursor: 'help',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}
      >
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: style.color, boxShadow: `0 0 4px ${style.color}` }} />
        {label}
      </button>

      {showDetail && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            right: 0,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '6px 9px',
            fontSize: 'var(--font-size-xxs)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            zIndex: 'var(--z-overlay)',
            pointerEvents: 'none',
            display: 'grid',
            gap: 2,
          }}
        >
          <span><strong style={{ color: style.color }}>{style.description}</strong></span>
          {provenance?.sourceProvider && <span>Source: {provenance.sourceProvider}</span>}
          {latency && <span>Retrieved: {latency}</span>}
          {provenance?.exchangeTimestamp && <span>Exchange print: {new Date(provenance.exchangeTimestamp).toLocaleTimeString()}</span>}
          {provenance?.currency && <span>Currency: {provenance.currency}</span>}
          {provenance?.entitlementRequired && <span style={{ color: 'var(--negative)' }}>Requires: {provenance.entitlementRequired}</span>}
        </span>
      )}
    </span>
  );
}
