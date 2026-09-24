/**
 * Core TVM / valuation financial math (pure functions).
 * Shared by the CALC panel, tests, and the AI Brain tool surface.
 */

/** Future value: FV = PV(1 + r/m)^(m·t) */
export function futureValue(pv: number, ratePct: number, years: number, compoundsPerYear = 1): number {
  const r = ratePct / 100, m = compoundsPerYear;
  return pv * Math.pow(1 + r / m, m * years);
}

/** Present value: PV = FV / (1 + r/m)^(m·t) */
export function presentValue(fv: number, ratePct: number, years: number, compoundsPerYear = 1): number {
  const r = ratePct / 100, m = compoundsPerYear;
  return fv / Math.pow(1 + r / m, m * years);
}

/** Payment for an ordinary annuity (monthly convention). */
export function annuityPayment(pv: number, ratePct: number, periods: number): number {
  const r = ratePct / 100 / 12;
  if (r === 0) return pv / periods;
  return (pv * r) / (1 - Math.pow(1 + r, -periods));
}

/** Net present value of cashflows (t = 0..n), discount rate in percent. */
export function npv(ratePct: number, cashflows: number[]): number {
  const r = ratePct / 100;
  return cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
}

/** IRR via bisection on NPV (percent, or null when no sign change). */
export function irr(cashflows: number[]): number | null {
  const f = (r: number) => npv(r * 100, cashflows);
  let lo = -0.9999, hi = 10;
  const fLo = f(lo), fHi = f(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-9) return mid * 100;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; }
  }
  return ((lo + hi) / 2) * 100;
}

/** Bond price: annual coupon paid semiannually, face at maturity. */
export function bondPrice(face: number, couponPct: number, years: number, yieldPct: number): number {
  const c = (face * couponPct) / 100 / 2;
  const y = yieldPct / 100 / 2;
  const n = Math.round(years * 2);
  if (y === 0) return face + c * n;
  return (c * (1 - Math.pow(1 + y, -n))) / y + face / Math.pow(1 + y, n);
}

/** Yield to maturity via bisection on bondPrice (percent, or null). */
export function yieldToMaturity(face: number, couponPct: number, years: number, price: number): number | null {
  const f = (y: number) => bondPrice(face, couponPct, years, y) - price;
  let lo = -20, hi = 500;
  const fLo = f(lo), fHi = f(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) { hi = mid; } else { lo = mid; }
  }
  return (lo + hi) / 2;
}
