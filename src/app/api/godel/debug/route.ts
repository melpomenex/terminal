import { NextResponse } from 'next/server';

export async function GET() {
	try {
		const { execSync } = require('node:child_process');
		// Test 1: basic connectivity
		const test = execSync("curl -s --max-time 10 -o /dev/null -w '%{http_code}' 'https://api.godelterminal.com/api/v1/watchlists'", { encoding: 'utf-8', timeout: 15000 });
		return NextResponse.json({ step1_http_code: test.trim() });
	} catch (e) {
		return NextResponse.json({ error: String(e), message: String((e as any)?.message ?? '').slice(0, 500) });
	}
}
