'use client';

import { useTerminalContext } from '@/context/terminal-context';
import type { GodelCompanyProfile } from '@/lib/godel-types';

function fmtBig(v: number | null | undefined): string {
	if (v == null) return 'N/A';
	const abs = Math.abs(v);
	const sign = v < 0 ? '-' : '';
	if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
	if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
	return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
	if (v == null) return 'N/A';
	return v.toFixed(decimals);
}

function fmtPct(v: number | null | undefined): string {
	if (v == null) return 'N/A';
	return `${(v * 100).toFixed(2)}%`;
}

export default function FundamentalsPanel({ panelId }: { panelId?: string }) {
	const { symbol, companyProfile, loading, chart } = useTerminalContext();

	if (loading && !companyProfile) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>LOADING...</div>;
	if (!companyProfile) return <div style={{ padding: 8, color: 'var(--amber-dim)' }}>NO DATA</div>;

	const p = companyProfile as unknown as Record<string, unknown>;
	const price = chart?.price ?? null;

	const field = (label: string, value: string, color?: string) => (
		<div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
			<span style={{ color: 'var(--amber-dim)', fontSize: 11 }}>{label}</span>
			<span style={{ color: color ?? 'var(--amber)', fontSize: 11 }}>{value}</span>
		</div>
	);

	const divider = () => (
		<div key={`sep-${Math.random()}`} style={{ borderBottom: '1px solid var(--border)', margin: '3px 0' }} />
	);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
			<div style={{ padding: '4px 8px', flex: 1, minHeight: 0, overflow: 'auto' }}>
				<div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: 'var(--amber-bright)' }}>
					{String(p.symbol ?? p.ticker ?? symbol)} <span style={{ fontWeight: 400, color: 'var(--amber-dim)' }}>{String(p.name ?? '')}</span>
				</div>
				{p.description ? (
					<div style={{ fontSize: 10, color: 'var(--amber-dim)', marginBottom: 4, lineHeight: 1.4, maxHeight: 48, overflow: 'hidden' }}>
						{String(p.description).slice(0, 200)}
					</div>
				) : null}
				{divider()}
				{field('MARKET CAP', fmtBig(p.marketCap as number | null))}
				{p.pe != null ? field('P/E RATIO', fmtNum(p.pe as number)) : null}
				{p.forwardPe != null ? field('FWD P/E', fmtNum(p.forwardPe as number)) : null}
				{p.dividendYield != null ? field('DIV YIELD', fmtPct(p.dividendYield as number)) : null}
				{price != null && p.dividendYield != null ? field('DIV / SHARE', fmtNum(price * (p.dividendYield as number) / 4)) : null}
				{divider()}
				{field('SECTOR', String(p.sector ?? 'N/A'))}
				{field('INDUSTRY', String(p.industry ?? 'N/A'))}
				{field('EXCHANGE', String(p.exchange ?? 'N/A'))}
				{field('CURRENCY', String(p.currency ?? 'N/A'))}
				{field('COUNTRY', String(p.country ?? 'N/A'))}
				{divider()}
				{p.employees ? field('EMPLOYEES', Number(p.employees).toLocaleString()) : null}
				{p.ceo ? field('CEO', String(p.ceo)) : null}
				{p.founded ? field('FOUNDED', String(p.founded)) : null}
				{p.website ? field('WEBSITE', String(p.website), 'var(--amber)') : null}
				{divider()}
				{p.high52w != null ? field('52W HIGH', fmtNum(p.high52w as number)) : null}
				{p.low52w != null ? field('52W LOW', fmtNum(p.low52w as number)) : null}
				{p.avgVolume != null ? field('AVG VOL', fmtBig(p.avgVolume as number)) : null}
				{p.ev != null ? field('ENTERPRISE VALUE', fmtBig(p.ev as number)) : null}
			</div>
		</div>
	);
}
