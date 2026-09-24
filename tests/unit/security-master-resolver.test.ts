import { describe, it, expect } from 'vitest';
import { SecurityMasterResolver, resolveToRef } from '@/lib/security-master/resolver';

describe('SecurityMasterResolver', () => {
  const r = new SecurityMasterResolver();

  describe('equity resolution', () => {
    it('resolves a plain US equity ticker', () => {
      const ref = r.resolve('AAPL');
      expect(ref).not.toBeNull();
      expect(ref!.assetClass).toBe('EQUITY');
      expect(ref!.symbol).toBe('AAPL');
      expect(ref!.id).toBe('EQUITY:XNAS:AAPL');
    });

    it('resolves Bloomberg-qualified mnemonics', () => {
      const ref = r.resolve('AAPL US Equity');
      expect(ref).not.toBeNull();
      expect(ref!.symbol).toBe('AAPL');
      expect(ref!.assetClass).toBe('EQUITY');
    });

    it('normalizes dual share classes to canonical hyphen form', () => {
      for (const input of ['BRK.B', 'BRK-B', 'BRK/B']) {
        const ref = r.resolve(input);
        expect(ref, input).not.toBeNull();
        expect(ref!.symbol).toBe('BRK-B');
      }
    });

    it('maps GOOG/GOOGL share-class family', () => {
      const ref = r.resolve('GOOGL');
      expect(ref!.symbol).toBe('GOOGL');
      const other = r.resolve('GOOG');
      expect(other!.symbol).toBe('GOOG');
    });
  });

  describe('options symbology', () => {
    it('parses human form "AAPL 260515 C 200"', () => {
      const ref = r.resolve('AAPL 260515 C 200');
      expect(ref).not.toBeNull();
      expect(ref!.assetClass).toBe('OPTION');
      expect(ref!.name).toContain('Call');
      expect(ref!.name).toContain('200');
      expect(ref!.name).toContain('2026-05-15');
    });

    it('parses OSI form "AAPL 260515C00200000"', () => {
      const ref = r.resolve('AAPL 260515C00200000');
      expect(ref).not.toBeNull();
      expect(ref!.assetClass).toBe('OPTION');
      expect(ref!.id).toContain('OPTION:OCC:AAPL');
    });

    it('parses ISO-date + CALL word form', () => {
      const ref = r.resolve('TSLA 2026-03-20 CALL 250');
      expect(ref).not.toBeNull();
      expect(ref!.name).toContain('Call');
    });
  });

  describe('FX, crypto, indices, yields, futures', () => {
    it('resolves FX majors with slash and Curncy forms', () => {
      for (const input of ['EURUSD', 'EUR/USD', 'EURUSD Curncy']) {
        const ref = r.resolve(input);
        expect(ref, input).not.toBeNull();
        expect(ref!.assetClass).toBe('FX');
        expect(ref!.symbol).toBe('EURUSD');
      }
    });

    it('resolves crypto composites (BTC-USD)', () => {
      const ref = r.resolve('BTC-USD');
      expect(ref!.assetClass).toBe('CRYPTO');
      expect(ref!.symbol).toBe('BTC-USD');
    });

    it('resolves Yahoo index composites (^GSPC -> SPX)', () => {
      const ref = r.resolve('^GSPC');
      expect(ref!.assetClass).toBe('INDEX');
      expect(ref!.symbol).toBe('SPX');
    });

    it('resolves sovereign yields (US10Y)', () => {
      const ref = r.resolve('US10Y');
      expect(ref!.assetClass).toBe('BOND_GOVT');
    });

    it('resolves futures composites (CL=F, ES=F)', () => {
      const cl = r.resolve('CL=F');
      expect(cl!.assetClass).toBe('FUTURE');
      const es = r.resolve('ES=F');
      expect(es!.assetClass).toBe('FUTURE');
    });

    it('resolves FX =X composites (EURUSD=X)', () => {
      const ref = r.resolve('EURUSD=X');
      expect(ref!.assetClass).toBe('FX');
    });
  });

  describe('edge behavior', () => {
    it('returns null for empty input', () => {
      expect(r.resolve('')).toBeNull();
      expect(r.resolve('   ')).toBeNull();
    });

    it('falls back to an EQUITY guess in resolveToRef', () => {
      const ref = resolveToRef('ZZZZZ');
      expect(ref.assetClass).toBe('EQUITY');
      expect(ref.symbol).toBe('ZZZZZ');
    });

    it('fuzzy scoring ranks exact > prefix > substring > subsequence', () => {
      expect(r.fuzzyScore('AAPL', 'AAPL')).toBeGreaterThan(r.fuzzyScore('AAPL', 'AAPL.US'));
      expect(r.fuzzyScore('APPL', 'APPLE INC')).toBeGreaterThan(0);
      expect(r.fuzzyScore('zzz', 'AAPL')).toBe(0);
    });
  });
});
