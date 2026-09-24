'use client';

import { useEffect, useState } from 'react';
import { useTerminalContext } from '@/context/terminal-context';

interface ArticleData {
	title: string;
	paragraphs: string[];
	pubDate: string;
	source: string;
	author: string;
}

const FONT_SIZES = [11, 13, 15];

export default function ArticleViewer({ url, onBack }: { url: string; onBack: () => void }) {
	const [article, setArticle] = useState<ArticleData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [fontSizeIdx, setFontSizeIdx] = useState(1);

	useEffect(() => {
		setLoading(true);
		setError('');
		fetch(`/api/yfin/article?url=${encodeURIComponent(url)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) throw new Error(data.error);
				setArticle(data);
			})
			.catch(() => setError('Failed to load article'))
			.finally(() => setLoading(false));
	}, [url]);

	const fontSize = FONT_SIZES[fontSizeIdx];

	if (loading) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#000' }}>
				<div style={{ padding: '8px 12px', borderBottom: '1px solid #332200', display: 'flex', alignItems: 'center', gap: 12 }}>
					<button onClick={onBack} style={backBtnStyle}>&laquo; Back</button>
					<span style={{ color: 'var(--amber-dim)', fontSize: 12 }}>LOADING ARTICLE...</span>
				</div>
				<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<span style={{ color: 'var(--amber-dim)' }}>Fetching content...</span>
				</div>
			</div>
		);
	}

	if (error || !article) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#000' }}>
				<div style={{ padding: '8px 12px', borderBottom: '1px solid #332200', display: 'flex', alignItems: 'center', gap: 12 }}>
					<button onClick={onBack} style={backBtnStyle}>&laquo; Back</button>
					<span style={{ color: '#cc3333', fontSize: 12 }}>ERROR</span>
				</div>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
					<span style={{ color: 'var(--amber-dim)', fontSize: 13 }}>{error || 'Could not load article'}</span>
					<a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', fontSize: 12 }}>
						Open in external browser &rarr;
					</a>
				</div>
			</div>
		);
	}

	const formattedDate = article.pubDate
		? new Date(article.pubDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
		: '';

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#000' }}>
			{/* Toolbar */}
			<div style={{ padding: '6px 12px', borderBottom: '1px solid #332200', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
				<button onClick={onBack} style={backBtnStyle}>&laquo; Back</button>
				<span style={{ flex: 1 }} />
				{/* Font size controls */}
				{FONT_SIZES.map((s, i) => (
					<button
						key={i}
						onClick={() => setFontSizeIdx(i)}
						style={{
							...fontBtnStyle,
							background: i === fontSizeIdx ? 'var(--amber-dim)' : 'transparent',
							color: i === fontSizeIdx ? '#000' : 'var(--amber)',
							fontSize: Math.max(9, s - 4),
							width: 22,
							height: 22,
							fontWeight: i === fontSizeIdx ? 900 : 400,
						}}
					>A</button>
				))}
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					style={{
						padding: '3px 10px',
						border: '1px solid var(--amber-dim)',
						color: 'var(--amber)',
						fontSize: 10,
						textDecoration: 'none',
						display: 'flex',
						alignItems: 'center',
						gap: 4,
					}}
				>Export PDF &darr;</a>
			</div>

			{/* Scrollable content */}
			<div style={{ flex: 1, minHeight: 0, padding: '16px 20px' }}>
				{/* Title */}
				<h1 style={{
					color: 'var(--amber)',
					fontSize: 20,
					fontWeight: 700,
					margin: 0,
					marginBottom: 12,
					lineHeight: 1.3,
				}} className="glow">{article.title}</h1>

				{/* Meta line */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
					<span style={{ color: 'var(--amber)', fontSize: 11 }}>Source: {article.source}</span>
					<span style={{ color: 'var(--amber-dim)', fontSize: 11 }}>|</span>
					{formattedDate && <span style={{ color: 'var(--amber)', fontSize: 11 }}>Publication Date: {formattedDate}</span>}
					{article.author && (
						<>
							<span style={{ color: 'var(--amber-dim)', fontSize: 11 }}>|</span>
							<span style={{ color: 'var(--amber)', fontSize: 11 }}>By {article.author}</span>
						</>
					)}
				</div>

				{/* Divider */}
				<div style={{ height: 1, background: '#332200', marginBottom: 16 }} />

				{/* Body paragraphs */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					{article.paragraphs.map((p, i) => (
						<p key={i} style={{
							color: '#ccaa77',
							fontSize,
							lineHeight: 1.55,
							margin: 0,
							whiteSpace: 'pre-wrap',
						}}>{p}</p>
					))}
				</div>
			</div>
		</div>
	);
}

const backBtnStyle: React.CSSProperties = {
	padding: '3px 10px',
	border: '1px solid var(--amber)',
	color: 'var(--amber)',
	fontSize: 11,
	cursor: 'pointer',
	background: 'transparent',
	fontFamily: 'inherit',
};

const fontBtnStyle: React.CSSProperties = {
	border: '1px solid var(--amber-dim)',
	color: 'var(--amber)',
	cursor: 'pointer',
	background: 'transparent',
	fontFamily: 'inherit',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
};
