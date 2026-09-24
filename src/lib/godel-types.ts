export interface GodelSearchResult {
	symbol: string;
	name: string;
	exchange: string;
	type: string;
	seriesId: number;
	figi?: string;
	isin?: string;
}

export interface GodelWatchlistItem {
	seriesId: number;
	symbol: string;
	name: string;
	price: number;
	previousClose: number;
	change: number;
	changePercent: number;
	high52w?: number;
	low52w?: number;
	figi?: string;
	isin?: string;
}

export interface GodelBar {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface GodelNewsItem {
	id: string;
	title: string;
	link: string;
	pubDate: string;
	source: string;
	summary?: string;
	imageUrl?: string;
	afterCursor?: string;
	beforeCursor?: string;
}

export interface GodelNewsCategory {
	id: string;
	name: string;
	slug: string;
}

export interface GodelBreakingNews {
	headline: string;
	link: string;
	timestamp: string;
	urgency: 'low' | 'medium' | 'high';
}

export interface GodelCompanyProfile {
	seriesId: number;
	symbol: string;
	name: string;
	description: string;
	sector: string;
	industry: string;
	marketCap: number;
	employees: number;
	exchange: string;
	currency: string;
	country: string;
	website: string;
	ceo?: string;
	founded?: string;
	pe?: number;
	forwardPe?: number;
	ev?: number;
	dividendYield?: number;
	avgVolume?: number;
	high52w?: number;
	low52w?: number;
}

export interface GodelEarningsEntry {
	period: string;
	epsActual: number | null;
	epsEstimate: number | null;
	revenueActual: number | null;
	revenueEstimate: number | null;
	surprisePercent: number | null;
	reportDate: string;
}

export interface GodelEarningsEstimate {
	period: string;
	epsEstimate: number;
	revenueEstimate: number;
	numberOfAnalysts: number;
	growthRate?: number;
}

export interface GodelAnalystRating {
	firm: string;
	analyst: string;
	rating: string;
	priceTarget: number | null;
	date: string;
}

export interface GodelAnalystRatingsSummary {
	strongBuy: number;
	buy: number;
	hold: number;
	sell: number;
	strongSell: number;
	priceTargetLow: number;
	priceTargetHigh: number;
	priceTargetMean: number;
	priceTargetMedian: number;
	ratings: GodelAnalystRating[];
}

export interface GodelOptionContract {
	strike: number;
	expiry: string;
	type: 'call' | 'put';
	lastPrice: number;
	bid: number;
	ask: number;
	volume: number;
	openInterest: number;
	impliedVolatility: number;
	delta?: number;
	gamma?: number;
	theta?: number;
	vega?: number;
}

export interface GodelOptionsChain {
	seriesId: number;
	symbol: string;
	expirations: string[];
	contracts: GodelOptionContract[];
}

export interface GodelShortInterest {
	seriesId: number;
	shortInterest: number;
	daysToCover: number;
	shortRatio: number;
	percentFloat: number;
	asOfDate: string;
}

export interface GodelDividend {
	exDate: string;
	payDate: string;
	amount: number;
	frequency: string;
}

export interface GodelSector {
	name: string;
	performance: number;
	changePercent: number;
}

export interface GodelIPO {
	company: string;
	ticker: string;
	expectedDate: string;
	priceRange: { low: number; high: number };
	sharesOffered: number;
	valuation: number;
	leadUnderwriter: string;
}

export interface GodelVenue {
	id: string;
	name: string;
	mic: string;
	country: string;
	timezone: string;
}

export interface GodelChatChannel {
	id: string;
	name: string;
	memberCount: number;
	unreadCount: number;
}

export interface GodelChatMessage {
	id: string;
	channelId: string;
	author: string;
	content: string;
	timestamp: string;
	reactions?: Array<{ emoji: string; count: number }>;
}
