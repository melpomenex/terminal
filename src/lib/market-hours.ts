/**
 * Determine whether a given exchange is currently open for trading.
 * Uses UTC-offset arithmetic so no external timezone library is needed.
 */

interface ExchangeSchedule {
  /** Weekday open hour in local time (0-23) */
  openH: number;
  /** Weekday open minute in local time (0-59) */
  openM: number;
  /** Weekday close hour in local time */
  closeH: number;
  /** Weekday close minute in local time */
  closeM: number;
  /** Standard UTC offset in hours for the exchange's timezone (no DST) */
  utcOffset: number;
}

const SCHEDULES: Record<string, ExchangeSchedule> = {
  // Americas
  NYSE:   { openH: 9,  openM: 30, closeH: 16, closeM: 0,  utcOffset: -5 },
  NASDAQ: { openH: 9,  openM: 30, closeH: 16, closeM: 0,  utcOffset: -5 },
  TSX:    { openH: 9,  openM: 30, closeH: 16, closeM: 0,  utcOffset: -5 },
  MEX:    { openH: 8,  openM: 30, closeH: 15, closeM: 0,  utcOffset: -6 },
  BVMF:   { openH: 10, openM: 0,  closeH: 17, closeM: 0,  utcOffset: -3 },

  // Europe
  LSE:    { openH: 8,  openM: 0,  closeH: 16, closeM: 30, utcOffset: 0 },
  FRA:    { openH: 9,  openM: 0,  closeH: 17, closeM: 30, utcOffset: 1 },
  EPA:    { openH: 9,  openM: 0,  closeH: 17, closeM: 30, utcOffset: 1 },
  Euronext: { openH: 9, openM: 0, closeH: 17, closeM: 30, utcOffset: 1 },
  MIL:    { openH: 9,  openM: 0,  closeH: 17, closeM: 30, utcOffset: 1 },
  MCE:    { openH: 9,  openM: 0,  closeH: 17, closeM: 30, utcOffset: 1 },

  // Asia / Pacific
  TSE:    { openH: 9,  openM: 0,  closeH: 15, closeM: 0,  utcOffset: 9 },
  HKEX:   { openH: 9,  openM: 30, closeH: 16, closeM: 0,  utcOffset: 8 },
  SHZ:    { openH: 9,  openM: 30, closeH: 15, closeM: 0,  utcOffset: 8 },
  BSE:    { openH: 9,  openM: 15, closeH: 15, closeM: 30, utcOffset: 5.5 },
  NSE:    { openH: 9,  openM: 15, closeH: 15, closeM: 30, utcOffset: 5.5 },
  ASX:    { openH: 10, openM: 0,  closeH: 16, closeM: 0,  utcOffset: 10 },
  KSC:    { openH: 9,  openM: 0,  closeH: 15, closeM: 30, utcOffset: 9 },
};

/**
 * Map a Yahoo Finance exchange name to our canonical exchange code.
 */
function mapExchange(yfExchange: string): string {
  const upper = yfExchange.toUpperCase();
  if (/NYS|NYSE|NYQ|ARC/.test(upper)) return 'NYSE';
  if (/NAS|NMS|NGS|NCM|O TC|OTC/.test(upper)) return 'NASDAQ';
  if (/TSX|TOR|TV/.test(upper)) return 'TSX';
  if (/MEX|MEXI/.test(upper)) return 'MEX';
  if (/SAO|BVMF|BSP/.test(upper)) return 'BVMF';
  if (/LSE|LON/.test(upper)) return 'LSE';
  if (/FRA|GER|ETR|DUI/.test(upper)) return 'FRA';
  if (/EPA|PAR/.test(upper)) return 'EPA';
  if (/MIL|MTA/.test(upper)) return 'MIL';
  if (/MCE|MAD/.test(upper)) return 'MCE';
  if (/TKS|JPX|TYO|JPN/.test(upper)) return 'TSE';
  if (/HKG|HKE/.test(upper)) return 'HKEX';
  if (/SHZ|SHH|SHA|SHG/.test(upper)) return 'SHZ';
  if (/BSE|BOM/.test(upper)) return 'BSE';
  if (/NSI|NSE|NSE/.test(upper)) return 'NSE';
  if (/ASX|AX/.test(upper)) return 'ASX';
  if (/KSC|KOE|KRX/.test(upper)) return 'KSC';
  if (upper.includes('EURONEXT')) return 'Euronext';
  return upper;
}

/**
 * Returns true if the exchange associated with the given Yahoo Finance
 * exchange code is currently within its normal trading session.
 */
export function isExchangeOpen(exchangeCode: string): boolean {
  const now = new Date();
  const nowMs = now.getTime();
  const utcMs = nowMs + now.getTimezoneOffset() * 60_000;

  const sched = SCHEDULES[exchangeCode] ?? SCHEDULES[mapExchange(exchangeCode)];
  if (!sched) return false;

  // Local time as milliseconds since midnight
  const localMs = utcMs + sched.utcOffset * 3_600_000;
  const localDate = new Date(localMs);
  const day = localDate.getDay();
  // Weekend
  if (day === 0 || day === 6) return false;

  const localMinutes = localDate.getHours() * 60 + localDate.getMinutes();
  const openMinutes = sched.openH * 60 + sched.openM;
  const closeMinutes = sched.closeH * 60 + sched.closeM;

  return localMinutes >= openMinutes && localMinutes < closeMinutes;
}

/** IANA timezones for global terminal clocks. */
export const TERMINAL_CLOCKS = [
  { id: 'NY', label: 'NY', tz: 'America/New_York' },
  { id: 'LDN', label: 'LDN', tz: 'Europe/London' },
  { id: 'TKY', label: 'TKY', tz: 'Asia/Tokyo' },
  { id: 'HK', label: 'HK', tz: 'Asia/Hong_Kong' },
] as const;

export type SessionPhase = 'pre' | 'open' | 'after' | 'closed';

/**
 * US equities session phase using America/New_York wall clock.
 * Pre-market 4:00–9:30, regular 9:30–16:00, after-hours 16:00–20:00.
 */
export function getUsSessionPhase(now = new Date()): SessionPhase {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // hour12:false can still emit 24 for midnight in some engines — normalize
  const h = hour === 24 ? 0 : hour;
  const mins = h * 60 + minute;

  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'pre';
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'open';
  if (mins >= 16 * 60 && mins < 20 * 60) return 'after';
  return 'closed';
}

export function sessionLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'pre': return 'PRE-MKT';
    case 'open': return 'OPEN';
    case 'after': return 'AFTER';
    case 'closed': return 'CLOSED';
  }
}

export function formatTzTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Compact display labels for index pulse symbols. */
export const PULSE_INDICES = [
  { symbol: 'SPY', label: 'SPX' },
  { symbol: 'QQQ', label: 'NDX' },
  { symbol: 'DIA', label: 'DJI' },
  { symbol: 'IWM', label: 'RUT' },
  { symbol: '^VIX', label: 'VIX' },
  { symbol: 'TLT', label: 'TLT' },
  { symbol: 'GLD', label: 'GOLD' },
  { symbol: 'BTC-USD', label: 'BTC' },
] as const;
