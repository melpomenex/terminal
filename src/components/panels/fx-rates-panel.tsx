'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WatchlistItem } from '@/lib/types';

const STORAGE_KEY = 'blm_fx_watchlist';
const DEFAULT_PAIRS = [
	'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDCAD=X', 'AUDUSD=X',
	'USDCNH=X', 'EURGBP=X', 'EURJPY=X', 'GBPJPY=X', 'USDCHF=X',
];
const REFRESH_MS = 30_000;

function stripSuffix(symbol: string): string {
	return symbol.replace('=X', '');
}

function loadPairs(): string[] {
	if (typeof window === 'undefined') return DEFAULT_PAIRS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.length > 0) return parsed;
		}
	} catch {}
	return DEFAULT_PAIRS;
}

function savePairs(pairs: string[]) {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs)); } catch {}
}

export default function FxRatesPanel({ panelId }: { panelId?: string }) {
	const [pairs, setPairs] = useState<string[]>(DEFAULT_PAIRS);
	const [items, setItems] = useState<WatchlistItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showInput, setShowInput] = useState(false);
	const [inputVal, setInputVal] = useState('');
	const mounted = useRef(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		mounted.current = true;
		setPairs(loadPairs());
		return () => { mounted.current = false; };
	}, []);

	const fetchRates = useCallback(async (symbols: string[]) => {
		if (!symbols.length) return;
		try {
			const res = await fetch(`/api/yfin/fx-rates?symbols=${symbols.join(',')}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			if (mounted.current) {
				setItems(data.items ?? []);
				setError(null);
			}
		} catch (e) {
			if (mounted.current) setError(String(e));
		}
	}, []);

	useEffect(() => {
		fetchRates(pairs);
		const id = setInterval(() => fetchRates(pairs), REFRESH_MS);
		return () => clearInterval(id);
	}, [pairs, fetchRates]);

	useEffect(() => {
		if (showInput && inputRef.current) inputRef.current.focus();
	}, [showInput]);

	const addPair = () => {
		const sym = inputVal.trim().toUpperCase();
		if (!sym) return;
		const normalized = sym.endsWith('=X') ? sym : `${sym}=X`;
		if (pairs.includes(normalized)) {
			setInputVal('');
			setShowInput(false);
			return;
		}
		const updated = [...pairs, normalized];
		setPairs(updated);
		savePairs(updated);
		setInputVal('');
		setShowInput(false);
	};

	const removePair = (sym: string) => {
		const updated = pairs.filter((p) => p !== sym);
		setPairs(updated);
		savePairs(updated);
	};

	const resetPairs = () => {
		setPairs(DEFAULT_PAIRS);
		savePairs(DEFAULT_PAIRS);
	};

	const fmtRate = (price: number | null): string => {
		if (price == null) return '---';
		// JPY pairs typically have 2 decimal places; others have 4
		return price.toFixed(2);
	};

	const fmtChange = (val: number | null): string => {
		if (val == null) return '---';
		return `${val >= 0 ? '+' : ''}${val.toFixed(4)}`;
	};

	const fmtPct = (val: number | null): string => {
		if (val == null) return '---';
		return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
			{/* Header */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '4px 8px',
				borderBottom: '1px solid var(--border)',
			}}>
				<span style={{ fontSize: 11, color: 'var(--amber-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
					FX RATES
				</span>
				<div style={{ display: 'flex', gap: 4 }}>
					<button
						onClick={() => setShowInput(!showInput)}
						style={{
							fontSize: 10,
							color: 'var(--amber)',
							background: 'transparent',
							border: '1px solid var(--amber-dim)',
							cursor: 'pointer',
							padding: '1px 6px',
							fontFamily: 'inherit',
						}}
					>
						+ADD
					</button>
					<button
						onClick={resetPairs}
						style={{
							fontSize: 10,
							color: 'var(--amber-dim)',
							background: 'transparent',
							border: '1px solid var(--border)',
							cursor: 'pointer',
							padding: '1px 6px',
							fontFamily: 'inherit',
						}}
					>
						RESET
					</button>
				</div>
			</div>

			{/* Add pair input */}
			{showInput && (
				<div style={{ padding: '4px 8px', display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
					<input
						ref={inputRef}
						value={inputVal}
						onChange={(e) => setInputVal(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') addPair(); if (e.key === 'Escape') { setShowInput(false); setInputVal(''); } }}
						placeholder="e.g. GBPUSD=X"
						style={{
							flex: 1,
							fontSize: 12,
							fontFamily: 'inherit',
							color: 'var(--amber)',
							background: 'rgba(255,255,255,0.04)',
							border: '1px solid var(--amber-dim)',
							padding: '2px 6px',
							outline: 'none',
						}}
					/>
					<button
						onClick={addPair}
						style={{
							fontSize: 10,
							color: 'var(--green)',
							background: 'transparent',
							border: '1px solid var(--green)',
							cursor: 'pointer',
							padding: '1px 8px',
							fontFamily: 'inherit',
						}}
					>
						OK
					</button>
				</div>
			)}

			{/* Column headers */}
			<div style={{
				display: 'grid',
				gridTemplateColumns: '1fr 76px 72px 68px 32px',
				padding: '3px 8px',
				fontSize: 10,
				color: 'var(--amber-dim)',
				borderBottom: '1px solid var(--border)',
			}}>
				<span>PAIR</span>
				<span style={{ textAlign: 'right' }}>RATE</span>
				<span style={{ textAlign: 'right' }}>CHG</span>
				<span style={{ textAlign: 'right' }}>CHG%</span>
				<span />
			</div>

			{/* Error state */}
			{error && (
				<div style={{ padding: '8px', fontSize: 11, color: 'var(--red)' }}>
					ERR: {error}
				</div>
			)}

			{/* Data rows */}
			<div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
				{items.map((item: WatchlistItem) => {
					const isUp = (item.changePercent ?? 0) >= 0;
					const clr = item.changePercent == null ? 'var(--amber)' : (isUp ? 'var(--green)' : 'var(--red)');
					return (
						<div
							key={item.symbol}
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr 76px 72px 68px 32px',
								padding: '2px 8px',
								fontSize: 13,
								color: 'var(--amber)',
								borderBottom: '1px solid rgba(255,255,255,0.03)',
							}}
						>
							<span style={{ fontWeight: 700, color: 'var(--amber-bright)' }}>
								{stripSuffix(item.symbol)}
							</span>
							<span style={{ textAlign: 'right' }}>
								{fmtRate(item.price)}
							</span>
							<span style={{ textAlign: 'right', color: clr }}>
								{fmtChange(item.change)}
							</span>
							<span style={{ textAlign: 'right', color: clr }}>
								{fmtPct(item.changePercent)}
							</span>
							<button
								onClick={() => removePair(item.symbol)}
								style={{
									fontSize: 11,
									color: 'var(--red)',
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									padding: 0,
									fontFamily: 'inherit',
									opacity: 0.5,
								}}
								title="Remove"
							>
								x
							</button>
						</div>
					);
				})}
				{items.length === 0 && !error && (
					<div style={{ padding: 8, fontSize: 11, color: 'var(--amber-dim)' }}>
						LOADING...
					</div>
				)}
			</div>

			{/* Footer */}
			<div style={{
				padding: '2px 8px',
				fontSize: 9,
				color: 'var(--amber-dim)',
				borderTop: '1px solid var(--border)',
				display: 'flex',
				justifyContent: 'space-between',
			}}>
				<span>{pairs.length} PAIRS</span>
				<span>REFRESH 30s</span>
			</div>
		</div>
	);
}
