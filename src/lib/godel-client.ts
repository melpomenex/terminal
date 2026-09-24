export const GODEL_BASE = 'https://api.godelterminal.com';
export const GODEL_APP_BASE = 'https://app.godelterminal.com';

const HEADERS: Record<string, string> = {
	'User-Agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
	Referer: 'https://app.godelterminal.com/',
	Accept: 'application/json',
};

const TIMEOUT = 15_000;

export async function godelGet(path: string, params?: Record<string, string>, base?: string): Promise<unknown> {
	let url = `${base ?? GODEL_BASE}${path}`;
	if (params) {
		const qs = new URLSearchParams(params).toString();
		if (qs) url += `?${qs}`;
	}
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
	try {
		const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

export async function godelPost(
	base: 'api' | 'app',
	path: string,
	body: Record<string, unknown>,
): Promise<unknown> {
	const baseUrl = base === 'app' ? GODEL_APP_BASE : GODEL_BASE;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
	try {
		const res = await fetch(`${baseUrl}${path}`, {
			method: 'POST',
			headers: { ...HEADERS, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: ctrl.signal,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}
