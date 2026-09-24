import { describe, it, expect } from 'vitest';
import {
  futureValue, presentValue, annuityPayment, npv, irr, bondPrice, yieldToMaturity,
} from '@/lib/math/financial-math';

describe('TVM financial math', () => {
  it('future value of a lump sum compounds correctly', () => {
    expect(futureValue(1000, 10, 1)).toBeCloseTo(1100, 6);        // 1100
    expect(futureValue(1000, 10, 2)).toBeCloseTo(1210, 6);        // 1210
    expect(futureValue(1000, 0, 5)).toBe(1000);                    // no growth
  });

  it('supports multiple compounding periods per year', () => {
    // 1000 at 10% semiannual for 1y = 1000 * (1.05)^2 = 1102.50
    expect(futureValue(1000, 10, 1, 2)).toBeCloseTo(1102.50, 6);
  });

  it('present value inverts future value', () => {
    const fv = futureValue(2500, 7.5, 6);
    expect(presentValue(fv, 7.5, 6)).toBeCloseTo(2500, 4);
  });

  it('annuity payment matches a known 30y mortgage', () => {
    // 300k @ 6%/yr monthly for 360 periods ≈ 1798.65
    const pmt = annuityPayment(300_000, 6, 360);
    expect(pmt).toBeCloseTo(1798.65, 1);
  });

  it('zero-rate annuity divides principal evenly', () => {
    expect(annuityPayment(1200, 0, 12)).toBeCloseTo(100, 6);
  });

  it('NPV of a known cashflow series', () => {
    // -1000, 500, 500, 500 at 10% -> 243.43
    expect(npv(10, [-1000, 500, 500, 500])).toBeCloseTo(243.43, 1);
  });

  it('NPV at the IRR is zero', () => {
    const flows = [-1000, 300, 420, 680];
    const rate = irr(flows)!;
    expect(npv(rate, flows)).toBeCloseTo(0, 6);
  });

  it('IRR of a simple doubling flow is 100%', () => {
    expect(irr([-100, 200])!).toBeCloseTo(100, 4);
  });

  it('IRR returns null when all flows share a sign', () => {
    expect(irr([100, 200, 300])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
  });

  it('bond price at yield = coupon trades at par', () => {
    expect(bondPrice(1000, 5, 10, 5)).toBeCloseTo(1000, 4);
  });

  it('bond price falls when yield rises above coupon', () => {
    expect(bondPrice(1000, 5, 10, 7)).toBeLessThan(1000);
    expect(bondPrice(1000, 5, 10, 3)).toBeGreaterThan(1000);
  });

  it('YTM round-trips a bond price', () => {
    const price = bondPrice(1000, 6, 8, 5.5);
    const ytm = yieldToMaturity(1000, 6, 8, price)!;
    expect(ytm).toBeCloseTo(5.5, 4);
  });
});
