import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol') || 'AAPL';
  const sym = symbol.toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  try {
    const url = `https://stockanalysis.com/stocks/${encodeURIComponent(sym.toLowerCase())}/forecast/`;
    const html = execSync(
      `curl -s --max-time 15 -H 'User-Agent: Mozilla/5.0 (compatible; Qube/1.0)' '${url}'`,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
    );

    let consensus = '';
    let targetMean: number | null = null;
    let targetLow: number | null = null;
    let targetHigh: number | null = null;
    let targetMedian: number | null = null;

    // Consensus
    const consMatch = html.match(/consensus rating of "([^"]+)"/);
    if (consMatch) consensus = consMatch[1];

    // Price target average
    const avgMatch = html.match(/average price target of \$?([\d.]+)/);
    if (avgMatch) targetMean = parseFloat(avgMatch[1]);

    // Low/high targets
    const lowMatch = html.match(/lowest target is \$?([\d.]+)/);
    if (lowMatch) targetLow = parseFloat(lowMatch[1]);

    const highMatch = html.match(/highest is \$?([\d.]+)/);
    if (highMatch) targetHigh = parseFloat(highMatch[1]);

    // Try to extract median if present
    const medMatch = html.match(/median.*?\$?([\d.]+)/);
    if (medMatch) targetMedian = parseFloat(medMatch[1]);
    if (!targetMedian && targetMean) targetMedian = targetMean;

    // Rating distribution — look for Strong Buy X, Buy X, etc.
    let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
    const ratingSection = html.match(/Strong Buy([\s\S]{0,2000})Strong Sell/);
    if (ratingSection) {
      const chunk = ratingSection[1];
      // Extract counts from the bar segments — typically they appear as numbers in spans
      const nums = chunk.match(/>(\d+)<\/span>/g);
      if (nums && nums.length >= 5) {
        strongBuy = parseInt(nums[0].replace(/[><\/span]/g, ''));
        buy = parseInt(nums[1].replace(/[><\/span]/g, ''));
        hold = parseInt(nums[2].replace(/[><\/span]/g, ''));
        sell = parseInt(nums[3].replace(/[><\/span]/g, ''));
        strongSell = parseInt(nums[4].replace(/[><\/span]/g, ''));
      }
    }

    // Individual analyst ratings from table
    const ratings: Array<{ firm: string; rating: string; priceTarget: number | null; date: string }> = [];
    // Pattern: analyst-name title="Name"...rating info...price target...date
    const analystPattern = /analyst-name[^>]*title="([^"]+)"[\s\S]*?<td[^>]*class="rating[^"]*"[^>]*>([\s\S]*?)<\/td>/g;
    let match;
    while ((match = analystPattern.exec(html)) !== null && ratings.length < 30) {
      const firm = match[1];
      const ratingCell = match[2].trim();
      // Extract the rating text
      const ratingMatch = ratingCell.match(/>(Buy|Hold|Sell|Strong Buy|Strong Sell|Outperform|Underperform|Neutral|Overweight|Underweight|Equal-Weight|Sector Perform|Market Perform|Mixed)<|^\s*(Buy|Hold|Sell|Strong Buy|Strong Sell|Outperform|Underperform|Neutral)/);
      const rating = ratingMatch ? (ratingMatch[1] || ratingMatch[2]) : ratingCell.replace(/<[^>]+>/g, '').trim();

      // Try to extract price target and date near this match
      const after = html.substring(match.index, match.index + 1500);
      const ptMatch = after.match(/class="[^"]*pt[^"]*"[^>]*>\$?([\d.]+)/);
      const dateMatch = after.match(/class="[^"]*date[^"]*"[^>]*>([^<]+)/);

      ratings.push({
        firm,
        rating,
        priceTarget: ptMatch ? parseFloat(ptMatch[1]) : null,
        date: dateMatch ? dateMatch[1].trim() : '',
      });
    }

    // If we couldn't extract distribution counts, try the broader text
    if (strongBuy === 0 && buy === 0 && hold === 0) {
      const sbMatch = html.match(/Strong Buy.*?(\d+)/);
      if (sbMatch) strongBuy = parseInt(sbMatch[1]);
    }

    return NextResponse.json({
      symbol: sym,
      consensus,
      strongBuy, buy, hold, sell, strongSell,
      targetMean, targetLow, targetHigh, targetMedian,
      ratings,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
