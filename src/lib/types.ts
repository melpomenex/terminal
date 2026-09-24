export interface WatchlistItem {
	symbol: string;
	price: number | null;
	previousClose: number | null;
	change: number | null;
	changePercent: number | null;
	high52w: number | null;
	low52w: number | null;
	seriesId?: number;
}

export interface ChartData {
	symbol: string;
	price: number | null;
	previousClose: number | null;
	high52w: number | null;
	low52w: number | null;
	currency: string;
	exchange: string;
	timestamps: number[];
	open: number[];
	high: number[];
	low: number[];
	close: number[];
	volume: number[];
}

export interface NewsItem {
	title: string;
	link: string;
	pubDate: string;
	source: string;
}

export interface SearchQuote {
	symbol: string;
	name: string | null;
	exchange: string | null;
	type: string | null;
	score: number | null;
	seriesId?: number;
}
