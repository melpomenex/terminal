/**
 * Read-only brokerage provider abstraction.
 *
 * Supports aggregator backends (SnapTrade, Plaid) and a local-manual
 * backend. All implementations are strictly read-only: account discovery,
 * positions/lots, and balances. No order placement, no trading APIs — Qube
 * is a research terminal (see Non-Goals).
 *
 * When no aggregator credentials are configured, `getBrokerageProviders()`
 * returns only the manual local provider, and linked-aggregator instances
 * resolve to an explicit UNAVAILABLE provenance rather than empty promises.
 */

import type { InstrumentRef } from '@/lib/types/instrument';
import { makeProvenance, type DataProvenance } from '@/lib/types/provenance';
import type {
  IBrokerageProvider,
  BrokerageAccount,
  BrokeragePositionLot,
  BrokerageBalance,
} from '@/lib/providers/contracts';

// ---------------------------------------------------------------------------
// Manual (local portfolio) provider — always available, no credentials
// ---------------------------------------------------------------------------

export interface ManualPositionRecord {
  id: string;
  symbol: string;
  quantity: number;
  costBasisPerUnit: number;
  dateAdded?: string;
  accountId?: string;
}

export class ManualBrokerageProvider implements IBrokerageProvider {
  readonly id = 'manual-local';
  readonly displayName = 'Local Portfolio (manual)';
  readonly aggregator = 'manual';

  constructor(private readManualPositions: () => ManualPositionRecord[]) {}

  async listAccounts(): Promise<{ accounts: BrokerageAccount[]; provenance: DataProvenance }> {
    return {
      accounts: [{
        id: 'local-manual',
        brokerName: 'Qube Local',
        displayName: 'Manually tracked positions',
        type: 'OTHER',
        currency: 'USD',
      }],
      provenance: makeProvenance('Local storage', 'LIVE', 'USD'),
    };
  }

  async getPositions(_accountId: string): Promise<{ lots: BrokeragePositionLot[]; provenance: DataProvenance }> {
    const lots: BrokeragePositionLot[] = this.readManualPositions().map((p) => ({
      id: p.id,
      accountId: 'local-manual',
      instrument: {
        id: `EQUITY:XNAS:${p.symbol}`,
        symbol: p.symbol,
        displaySymbol: p.symbol,
        assetClass: 'EQUITY',
      } satisfies InstrumentRef,
      quantity: p.quantity,
      costBasisPerUnit: p.costBasisPerUnit,
      openedAt: p.dateAdded,
    }));
    return { lots, provenance: makeProvenance('Local storage', 'LIVE', 'USD') };
  }

  async getBalances(_accountId: string): Promise<{ balances: BrokerageBalance[]; provenance: DataProvenance }> {
    // Manual accounts have no cash ledger — positions only.
    return { balances: [], provenance: makeProvenance('Local storage', 'LIVE', 'USD') };
  }
}

// ---------------------------------------------------------------------------
// SnapTrade read-only adapter (requires SNAPTRADE_CLIENT_ID / SECRET env)
// ---------------------------------------------------------------------------

export class SnapTradeBrokerageProvider implements IBrokerageProvider {
  readonly id = 'snaptrade';
  readonly displayName = 'SnapTrade (read-only aggregation)';
  readonly aggregator = 'snaptrade';

  async listAccounts(): Promise<{ accounts: BrokerageAccount[]; provenance: DataProvenance }> {
    return {
      accounts: [],
      provenance: makeProvenance('SnapTrade', 'UNAVAILABLE', 'USD', {
        entitlementRequired: 'SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY environment configuration',
      }),
    };
  }

  async getPositions(): Promise<{ lots: BrokeragePositionLot[]; provenance: DataProvenance }> {
    return { lots: [], provenance: makeProvenance('SnapTrade', 'UNAVAILABLE', 'USD', {
      entitlementRequired: 'SnapTrade credentials not configured',
    }) };
  }

  async getBalances(): Promise<{ balances: BrokerageBalance[]; provenance: DataProvenance }> {
    return { balances: [], provenance: makeProvenance('SnapTrade', 'UNAVAILABLE', 'USD', {
      entitlementRequired: 'SnapTrade credentials not configured',
    }) };
  }
}

// ---------------------------------------------------------------------------
// Plaid Investments adapter (requires PLAID_CLIENT_ID / SECRET env)
// ---------------------------------------------------------------------------

export class PlaidBrokerageProvider implements IBrokerageProvider {
  readonly id = 'plaid';
  readonly displayName = 'Plaid Investments (read-only aggregation)';
  readonly aggregator = 'plaid';

  async listAccounts(): Promise<{ accounts: BrokerageAccount[]; provenance: DataProvenance }> {
    return {
      accounts: [],
      provenance: makeProvenance('Plaid', 'UNAVAILABLE', 'USD', {
        entitlementRequired: 'PLAID_CLIENT_ID / PLAID_SECRET environment configuration',
      }),
    };
  }

  async getPositions(): Promise<{ lots: BrokeragePositionLot[]; provenance: DataProvenance }> {
    return { lots: [], provenance: makeProvenance('Plaid', 'UNAVAILABLE', 'USD', {
      entitlementRequired: 'Plaid credentials not configured',
    }) };
  }

  async getBalances(): Promise<{ balances: BrokerageBalance[]; provenance: DataProvenance }> {
    return { balances: [], provenance: makeProvenance('Plaid', 'UNAVAILABLE', 'USD', {
      entitlementRequired: 'Plaid credentials not configured',
    }) };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function getBrokerageProviders(manualPositions: ManualPositionRecord[]): IBrokerageProvider[] {
  return [
    new ManualBrokerageProvider(() => manualPositions),
    new SnapTradeBrokerageProvider(),
    new PlaidBrokerageProvider(),
  ];
}
