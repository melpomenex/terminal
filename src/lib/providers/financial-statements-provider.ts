/**
 * Financial Statements Provider — normalizes SEC EDGAR XBRL company facts
 * into standardized multi-period Income Statement / Balance Sheet / Cash Flow
 * structures (`StandardizedStatement` from the provider contracts).
 *
 * Runs server-side only (uses secGet → node child-process curl).
 */

import type { InstrumentRef } from '@/lib/types/instrument';
import { makeProvenance, type DataProvenance } from '@/lib/types/provenance';
import type {
  IFinancialStatementsProvider,
  StandardizedStatement,
  StatementLine,
  StatementPeriod,
  StatementType,
} from '@/lib/providers/contracts';
import { getCompanyFacts, tickerToCik } from '@/lib/sec-edgar';

// ---------------------------------------------------------------------------
// XBRL concept maps
// ---------------------------------------------------------------------------

type ConceptMap = Array<{ key: string; label: string; concepts: string[]; percentOf?: string; indent?: number }>;

const INCOME_LINES: ConceptMap = [
  { key: 'revenue', label: 'Total Revenue', concepts: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], percentOf: 'revenue' },
  { key: 'cogs', label: 'Cost of Revenue', concepts: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'], percentOf: 'revenue', indent: 1 },
  { key: 'grossProfit', label: 'Gross Profit', concepts: ['GrossProfit'], percentOf: 'revenue' },
  { key: 'rnd', label: 'R&D Expense', concepts: ['ResearchAndDevelopmentExpense'], percentOf: 'revenue', indent: 1 },
  { key: 'sga', label: 'SG&A Expense', concepts: ['SellingGeneralAndAdministrativeExpense'], percentOf: 'revenue', indent: 1 },
  { key: 'opex', label: 'Total Operating Expenses', concepts: ['OperatingExpenses'], percentOf: 'revenue', indent: 1 },
  { key: 'operatingIncome', label: 'Operating Income (EBIT)', concepts: ['OperatingIncomeLoss'], percentOf: 'revenue' },
  { key: 'interestExpense', label: 'Interest Expense', concepts: ['InterestExpense', 'InterestExpenseNonoperating'], percentOf: 'revenue', indent: 1 },
  { key: 'pretaxIncome', label: 'Pretax Income', concepts: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'], percentOf: 'revenue' },
  { key: 'taxExpense', label: 'Income Tax Expense', concepts: ['IncomeTaxExpenseBenefit'], percentOf: 'revenue', indent: 1 },
  { key: 'netIncome', label: 'Net Income', concepts: ['NetIncomeLoss', 'ProfitLoss'], percentOf: 'revenue' },
  { key: 'epsBasic', label: 'EPS (Basic)', concepts: ['EarningsPerShareBasic'] },
  { key: 'epsDiluted', label: 'EPS (Diluted)', concepts: ['EarningsPerShareDiluted'] },
  { key: 'sharesDiluted', label: 'Diluted Shares Out.', concepts: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'] },
];

const BALANCE_LINES: ConceptMap = [
  { key: 'cash', label: 'Cash & Equivalents', concepts: ['CashAndCashEquivalentsAtCarryingValue'] },
  { key: 'shortTermInvestments', label: 'Short-Term Investments', concepts: ['ShortTermInvestments'], indent: 1 },
  { key: 'receivables', label: 'Accounts Receivable', concepts: ['AccountsReceivableNetCurrent'], indent: 1 },
  { key: 'inventory', label: 'Inventory', concepts: ['InventoryNet'], indent: 1 },
  { key: 'currentAssets', label: 'Total Current Assets', concepts: ['AssetsCurrent'] },
  { key: 'ppe', label: 'Property, Plant & Equip.', concepts: ['PropertyPlantAndEquipmentNet'], indent: 1 },
  { key: 'goodwill', label: 'Goodwill', concepts: ['Goodwill'], indent: 1 },
  { key: 'intangibles', label: 'Intangibles', concepts: ['IntangibleAssetsNetExcludingGoodwill'], indent: 1 },
  { key: 'totalAssets', label: 'Total Assets', concepts: ['Assets'] },
  { key: 'currentLiabilities', label: 'Total Current Liabilities', concepts: ['LiabilitiesCurrent'] },
  { key: 'shortTermDebt', label: 'Short-Term Debt', concepts: ['LongTermDebtCurrent', 'DebtCurrent'], indent: 1 },
  { key: 'payables', label: 'Accounts Payable', concepts: ['AccountsPayableCurrent'], indent: 1 },
  { key: 'longTermDebt', label: 'Long-Term Debt', concepts: ['LongTermDebtNoncurrent', 'LongTermDebt'], indent: 1 },
  { key: 'totalLiabilities', label: 'Total Liabilities', concepts: ['Liabilities'] },
  { key: 'retainedEarnings', label: 'Retained Earnings', concepts: ['RetainedEarningsAccumulatedDeficit'], indent: 1 },
  { key: 'equity', label: 'Total Shareholder Equity', concepts: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'] },
];

const CASHFLOW_LINES: ConceptMap = [
  { key: 'cfo', label: 'Cash from Operations', concepts: ['NetCashProvidedByUsedInOperatingActivities'] },
  { key: 'capex', label: 'Capital Expenditures', concepts: ['PaymentsToAcquirePropertyPlantAndEquipment'], indent: 1 },
  { key: 'fcf', label: 'Free Cash Flow', concepts: [] /* computed: cfo + capex */ },
  { key: 'acquisitions', label: 'Acquisitions', concepts: ['PaymentsToAcquireBusinessesNetOfCashAcquired'], indent: 1 },
  { key: 'cfi', label: 'Cash from Investing', concepts: ['NetCashProvidedByUsedInInvestingActivities'] },
  { key: 'debtIssued', label: 'Debt Issued', concepts: ['ProceedsFromIssuanceOfLongTermDebt', 'LongTermDebt'], indent: 1 },
  { key: 'debtRepaid', label: 'Debt Repaid', concepts: ['RepaymentsOfLongTermDebt'], indent: 1 },
  { key: 'buybacks', label: 'Share Repurchases', concepts: ['PaymentsForRepurchaseOfCommonStock'], indent: 1 },
  { key: 'dividendsPaid', label: 'Dividends Paid', concepts: ['PaymentsOfDividendsCommonStock'], indent: 1 },
  { key: 'cff', label: 'Cash from Financing', concepts: ['NetCashProvidedByUsedInFinancingActivities'] },
  { key: 'netChangeCash', label: 'Net Change in Cash', concepts: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect', 'CashCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect'] },
];

// ---------------------------------------------------------------------------
// XBRL fact extraction
// ---------------------------------------------------------------------------

interface FactEntry {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string;
}

interface ConceptFacts {
  label?: string;
  units?: Record<string, FactEntry[]>;
}

type FactsByConcept = Record<string, ConceptFacts>;

function durationDays(entry: FactEntry): number {
  if (!entry.start) return 0; // instant fact (balance sheet)
  return (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
}

/** Pick the best fact per period bucket for a concept. */
function factsForPeriods(
  concept: ConceptFacts | undefined,
  period: StatementPeriod,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!concept?.units) return out;
  const entries = [...(concept.units.USD ?? []), ...(concept.units.shares ?? []), ...(concept.units['USD/shares'] ?? [])];
  if (entries.length === 0) return out;

  const isAnnual = period === 'ANNUAL' || period === 'TTM';
  for (const e of entries) {
    if (period !== 'TTM') {
      const dur = durationDays(e);
      if (isAnnual) {
        if (!(dur >= 300 && dur <= 400)) continue;
        if (e.form && !e.form.startsWith('10-K')) continue;
      } else {
        if (!(dur >= 60 && dur <= 100)) continue;
        if (e.form && !e.form.startsWith('10-Q') && !e.form.startsWith('10-K')) continue;
      }
    } else {
      // TTM: latest 4 rolling quarters approximated by the most recent
      // entry per ~90d bucket; simpler: use latest annual frame if fresh,
      // else latest 10-Q cumulative is not TTM — accept latest annual + note.
      const dur = durationDays(e);
      if (!(dur >= 300 && dur <= 400)) continue;
    }

    // Period label: FY<endYear> or Q<quarter> <endYear>
    const endDate = new Date(e.end + 'T00:00:00Z');
    const year = endDate.getUTCFullYear();
    const label = isAnnual
      ? `FY${year}`
      : `Q${Math.floor(endDate.getUTCMonth() / 3) + (endDate.getUTCDate() > 15 ? 1 : 0)} ${year}`;

    // Prefer the most recently filed value per period.
    const existing = out.get(label);
    if (existing === undefined || (e.fy ?? 0) >= 0) out.set(label, e.val);
  }
  return out;
}

function takeRecentPeriods(periods: string[], limit: number): string[] {
  // Sort FY2021/F Q labels chronologically then take the last N
  const sorted = [...periods].sort((a, b) => {
    const num = (s: string) => {
      const y = parseInt(s.match(/(\d{4})/)?.[1] ?? '0', 10);
      const q = parseInt(s.match(/Q(\d)/)?.[1] ?? '0', 10);
      return y * 10 + q;
    };
    return num(a) - num(b);
  });
  return sorted.slice(-limit);
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class SecEdgarStatementsProvider implements IFinancialStatementsProvider {
  readonly id = 'sec-edgar-xbrl';
  readonly displayName = 'SEC EDGAR XBRL';

  async getStatements(
    instrument: InstrumentRef,
    statementType: StatementType,
    period: StatementPeriod,
    limit = 5,
  ): Promise<{ statements: StandardizedStatement[]; provenance: DataProvenance }> {
    const cik = await tickerToCik(instrument.symbol);
    if (!cik) {
      throw new Error(`No SEC CIK for ${instrument.symbol}`);
    }
    const facts = await getCompanyFacts(cik);
    if (!facts) {
      throw new Error(`No XBRL company facts for ${instrument.symbol} (CIK ${cik})`);
    }
    const usGaap = ((facts.facts as Record<string, unknown>)?.['us-gaap'] as FactsByConcept) ?? {};

    const lineDefs = statementType === 'INCOME_STATEMENT' ? INCOME_LINES
      : statementType === 'BALANCE_SHEET' ? BALANCE_LINES
      : CASHFLOW_LINES;

    // Collect period maps per line
    const linePeriods: Array<{ def: ConceptMap[number]; map: Map<string, number> }> = [];
    for (const def of lineDefs) {
      const map = new Map<string, number>();
      for (const concept of def.concepts) {
        const got = factsForPeriods(usGaap[concept], period);
        if (got.size > 0) {
          // First concept in the list that yields data wins (priority order).
          for (const [k, v] of got) if (!map.has(k)) map.set(k, v);
          break;
        }
      }
      linePeriods.push({ def, map });
    }

    // Union of periods across all lines, then take the N most recent
    const allPeriods = new Set<string>();
    for (const { map } of linePeriods) for (const p of map.keys()) allPeriods.add(p);
    const periods = takeRecentPeriods([...allPeriods], limit);
    if (periods.length === 0) {
      throw new Error(`No ${period} facts available for ${instrument.symbol}`);
    }

    const lines: StatementLine[] = linePeriods.map(({ def, map }) => ({
      key: def.key,
      label: def.label,
      values: Object.fromEntries(periods.map((p) => [p, map.get(p) ?? null])),
      percentOf: def.percentOf,
      indent: def.indent,
    }));

    // Computed free cash flow
    if (statementType === 'CASH_FLOW') {
      const cfo = lines.find((l) => l.key === 'cfo');
      const capex = lines.find((l) => l.key === 'capex');
      const fcfIdx = lines.findIndex((l) => l.key === 'fcf');
      if (cfo && capex && fcfIdx >= 0) {
        const values: Record<string, number | null> = {};
        for (const p of periods) {
          const o = cfo.values[p], x = capex.values[p];
          values[p] = o != null && x != null ? o + x : null; // capex stored negative
        }
        lines[fcfIdx] = { ...lines[fcfIdx], values };
      }
    }

    const currency = ((Object.values(usGaap)[0]?.units ? Object.keys(Object.values(usGaap)[0].units!) : []) as string[]).find((u) => u === 'USD') ?? 'USD';

    return {
      statements: [{
        statementType,
        periods,
        periodType: period,
        currency,
        lines,
        provenance: makeProvenance('SEC EDGAR XBRL (companyfacts)', 'LIVE', currency),
      }],
      provenance: makeProvenance('SEC EDGAR XBRL (companyfacts)', 'LIVE', currency),
    };
  }
}

export const secEdgarStatementsProvider = new SecEdgarStatementsProvider();
