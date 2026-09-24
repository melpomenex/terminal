import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

export const GODEL_BASE = 'https://api.godelterminal.com';
export const GODEL_APP_BASE = 'https://app.godelterminal.com';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const REFERER = 'https://app.godelterminal.com/';
const TIMEOUT = 15;

function parseCurl(raw: string): unknown {
	const nl = raw.lastIndexOf('\n');
	const body = raw.substring(0, nl);
	const code = raw.substring(nl + 1);
	if (code === '429') throw new Error('Rate limited');
	if (code !== '200') throw new Error(`HTTP ${code}`);
	return JSON.parse(body);
}

function shellQuote(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}

function runCurl(args: string[]): unknown {
	const cmd = `curl ${args.map(shellQuote).join(' ')}`;
	const raw = execSync(cmd, {
		maxBuffer: 10 * 1024 * 1024,
		timeout: (TIMEOUT + 5) * 1000,
		encoding: 'utf-8',
	});
	return parseCurl(raw);
}

function baseArgs(): string[] {
	return [
		'-s', '--max-time', String(TIMEOUT),
		'-H', `User-Agent: ${UA}`,
		'-H', `Referer: ${REFERER}`,
		'-H', 'Accept: application/json',
		'-H', 'Accept-Encoding: gzip, deflate, br',
		'--compressed',
		'-w', '\n%{http_code}',
	];
}

export async function godelGet(
	path: string,
	params?: Record<string, string>,
	base: string = GODEL_BASE,
): Promise<unknown> {
	let url = `${base}${path}`;
	if (params) {
		const qs = new URLSearchParams(params).toString();
		if (qs) url += `?${qs}`;
	}
	return runCurl([...baseArgs(), url]);
}

export async function godelPost(
	base: 'api' | 'app',
	path: string,
	body: Record<string, unknown>,
): Promise<unknown> {
	const baseUrl = base === 'app' ? GODEL_APP_BASE : GODEL_BASE;
	const url = `${baseUrl}${path}`;
	const bodyStr = JSON.stringify(body);
	const tmpFile = `/tmp/godel-${Date.now()}.json`;
	writeFileSync(tmpFile, bodyStr);
	try {
		return runCurl([...baseArgs(), '-X', 'POST', '-H', 'Content-Type: application/json', `-d`, `@${tmpFile}`, url]);
	} finally {
		try { unlinkSync(tmpFile); } catch {}
	}
}

// ═══════════════════════════════════════════════════════════════
// SEARCH & INSTRUMENTS
// ═══════════════════════════════════════════════════════════════
export const search = (q: string) => godelGet('/api/v1/search', { query: q });
export const getInstrument = (id: string) => godelGet(`/api/v1/instruments/${id}`);
export const getInstruments = (params?: Record<string, string>) => godelGet('/api/v1/instruments', params);
export const getInstrumentsV0 = (body: { subsets: string[]; filters?: Record<string, unknown> }) =>
	godelPost('api', '/api/v0/instruments', body);
export const getFxPairs = () => godelPost('api', '/api/v0/instruments', { subsets: ['fx_pair'] });
export const getFutures = (region?: string) =>
	godelPost('api', '/api/v0/instruments', { subsets: [region ? `fut_mkt_${region}` : 'fut_mkt_americas'] });
export const getCommodities = () =>
	godelPost('api', '/api/v0/instruments', {
		subsets: ['cmd_gbl_meat', 'cmd_gbl_metal', 'cmd_gbl_energy', 'cmd_gbl_grain', 'cmd_gbl_soft'],
	});
export const instrumentExists = (id: string) => godelGet(`/api/v1/exists/instrument/${id}`);
export const resolveSymbol = (symbol: string, source?: string) =>
	godelPost('api', '/api/tv-advanced/resolve-symbol', { symbol, source: source ?? '' });

// ═══════════════════════════════════════════════════════════════
// WATCHLISTS
// ═══════════════════════════════════════════════════════════════
export const getWatchlists = () => godelGet('/api/v1/watchlists');
export const getWatchlist = (id: string) => godelGet(`/api/v1/watchlists/${id}`);
export const reorderWatchlists = (body: Record<string, unknown>) =>
	godelPost('app', '/api/watchlist/set-watchlist-order', body);
export const hideChannel = (channelId: string) =>
	godelPost('api', `/api/chat/hide_channel/${channelId}`, {});
export const getUserLayout = () => godelGet('/api/users/me/layout', {}, GODEL_APP_BASE);

// ═══════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════
export const getNews = (params?: { size?: number; afterCursor?: string; beforeCursor?: string; language?: string }) =>
	godelPost('api', '/api/news/items', {
		pageable: { size: params?.size ?? 20, ...(params?.afterCursor && { afterCursor: params.afterCursor }), ...(params?.beforeCursor && { beforeCursor: params.beforeCursor }) },
		languages: [params?.language ?? 'en'],
	});
export const getTopNews = () => godelGet('/api/v1/top-news-items');
export const getBreakingNews = () => godelGet('/api/fetchBreaking', {}, GODEL_APP_BASE);
export const getNewsCategories = () => godelGet('/api/news/categories');
export const getNewsSubCategories = (body: Record<string, unknown>) =>
	godelPost('api', '/api/news/sub_categories', body);
export const getNewsSources = () => godelGet('/api/news/sources');
export const getSearchableNewsSources = () => godelGet('/api/news/search/sources/');
export const getNewsFileContent = (id: string, filename: string) =>
	godelGet(`/api/news/file-content/${id}/${filename}`);
export const getResearchReports = () => godelGet('/api/fetchResearch', {}, GODEL_APP_BASE);
export const getExpertNarratives = () => godelGet('/api/fetchExpert', {}, GODEL_APP_BASE);

// ═══════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════
export const getChatChannels = () => godelGet('/api/chat/channels');
export const getChatMessages = (channelId: string, params?: { size?: number; cursor?: string }) => {
	let path = `/api/chat/channels/${channelId}/messages?size=${params?.size ?? 50}`;
	if (params?.cursor) path += `&cursor=${params.cursor}`;
	return godelGet(path);
};
export const getChatMessagesGlobal = (tokens: string, params?: { size?: number; cursor?: string }) => {
	let path = `/api/chat/messages?tokens=${tokens}&size=${params?.size ?? 50}`;
	if (params?.cursor) path += `&cursor=${params.cursor}`;
	return godelGet(path);
};
export const sendChatMessage = (body: Record<string, unknown>) =>
	godelPost('api', '/api/v1/chat/message/', body);

// ═══════════════════════════════════════════════════════════════
// MARKET DATA — QUOTES & BARS
// ═══════════════════════════════════════════════════════════════
export const getBars = (seriesId: number, params?: { resolution?: string; countBack?: number; from?: number; to?: number }) =>
	godelPost('api', '/api/tv-advanced/bars', {
		seriesId,
		resolution: params?.resolution ?? '1D',
		countBack: params?.countBack ?? 30,
		from: params?.from ?? 0,
		to: params?.to ?? Math.floor(Date.now() / 1000),
		firstDataRequest: true,
		hideAnomalies: true,
	});
export const getMostActive = () => godelGet('/api/most-v2?');
export const getAggregates = () => godelGet('/api/v1/aggregates');
export const getTrending = (timeframe: string = 'day') => godelGet('/api/v1/trending', { timeframe });
export const getHalts = () => godelGet('/api/fetchhalts', {}, GODEL_APP_BASE);
export const getWojak = () => godelGet('/api/wojak');
export const getSectors = () => godelGet('/api/sectors');
export const getVenues = () => godelGet('/api/v1/venues', { include: 'instrumentCount' });

// ═══════════════════════════════════════════════════════════════
// COMPANY / INSTRUMENT DETAILS
// ═══════════════════════════════════════════════════════════════
export const getCompanyProfile = (seriesId: string) => godelGet(`/api/v1/company-profile/${seriesId}`);
export const getEarnings = (seriesId: string) => godelGet('/api/v1/earnings', { seriesId });
export const getEarningsEstimates = (seriesId: string) => godelGet('/api/v1/earnings-estimates', { seriesId });
export const getEarningTrends = (seriesId: string) => godelGet('/api/v1/earning-trends', { seriesId });
export const getAnalystRatings = (seriesId: string) => godelGet('/api/v1/analyst-ratings', { seriesId });
export const getShortInterest = (seriesId: number) =>
	godelPost('api', '/api/v1/shortinterest', { seriesId });
export const getDividends = (seriesId: number) =>
	godelPost('api', '/api/v1/corporate-actions/dvd', { seriesId });
export const getOptions = (seriesId: number, params?: { strikesAbove?: number; strikesBelow?: number }) => {
	const now = new Date();
	const end = new Date(now);
	end.setFullYear(end.getFullYear() + 2);
	return godelPost('api', '/api/v1/optionsv2', {
		series_id: seriesId,
		seriesId,
		number_of_strikes_above: params?.strikesAbove ?? 10,
		number_of_strikes_below: params?.strikesBelow ?? 10,
		start_expiry: now.toISOString(),
		end_expiry: end.toISOString(),
	});
};
export const getHolders = (seriesId: string) => godelGet(`/api/v1/holders/${seriesId}`);
export const getFinancials = (seriesId: string) => godelGet(`/api/v1/consolidated_financials/${seriesId}`);
export const getRatioAnalysis = (seriesId: string) => godelGet('/api/v1/ratio-analysis', { seriesId });
export const getLegalEntities = (seriesId: string) => godelGet(`/api/v1/legal-entities/${seriesId}`);

// ═══════════════════════════════════════════════════════════════
// IPOs
// ═══════════════════════════════════════════════════════════════
export const getIPOs = () => godelGet('/api/ipos');

// ═══════════════════════════════════════════════════════════════
// PEOPLE SEARCH
// ═══════════════════════════════════════════════════════════════
export const searchPeople = (q: string) => godelGet('/api/people/', { q });

// ═══════════════════════════════════════════════════════════════
// USER ACCOUNT
// ═══════════════════════════════════════════════════════════════
export const getUserProfile = () => godelGet('/api/v1/users/me/profile');
export const getUserAum = () => godelGet('/api/v1/users/me/aum');
export const getUserById = (id: string) => godelGet(`/api/v1/users/${id}`);
export const searchUserProfiles = (q: string) => godelGet('/api/v1/user-profiles', { query: q });
export const checkDisplayName = (dn: string) => godelGet('/api/users/display-names/used', { displayName: dn });

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
export const getNotifications = (params?: { size?: number; beforeCursor?: string }) => {
	let path = `/api/notifications/?size=${params?.size ?? 20}`;
	if (params?.beforeCursor) path += `&beforeCursor=${params.beforeCursor}`;
	return godelGet(path);
};
export const getUnreadCount = () => godelGet('/api/notifications/unread-count');

// ═══════════════════════════════════════════════════════════════
// BROKERAGE
// ═══════════════════════════════════════════════════════════════
export const getBrokerages = () => godelGet('/api/v1/brokerages');
export const getBrokerageIntegrations = () => godelGet('/api/v1/brokerage-integrations');
export const getBrokerageIntegration = (id: string) => godelGet(`/api/v1/brokerage-integrations/${id}`);

// ═══════════════════════════════════════════════════════════════
// ENTITLEMENTS
// ═══════════════════════════════════════════════════════════════
export const getEntitlements = () => godelGet('/api/v1/entitlements');

// ═══════════════════════════════════════════════════════════════
// GLOBAL AUM
// ═══════════════════════════════════════════════════════════════
export const getGlobalAum = () => godelGet('/api/v1/aum/global');

// ═══════════════════════════════════════════════════════════════
// MISCELLANEOUS
// ═══════════════════════════════════════════════════════════════
export const submitFeedback = (body: Record<string, unknown>) => godelPost('api', '/api/feedback', body);
export const getTTS = () => godelGet('/api/tts');
