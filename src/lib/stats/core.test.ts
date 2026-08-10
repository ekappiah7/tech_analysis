import { describe, expect, it } from "vitest";
import {
  benjaminiHochberg,
  cumulative,
  incompleteBeta,
  maxDrawdown,
  mean,
  normalCdf,
  normalInv,
  quantile,
  stdev,
  studentTTwoSidedP,
  tTestAgainstZero,
} from "./core";

describe("descriptive statistics", () => {
  it("computes mean and sample standard deviation", () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(xs)).toBe(5);
    // Sample sd of this classic set is sqrt(32/7).
    expect(stdev(xs)).toBeCloseTo(Math.sqrt(32 / 7), 10);
  });

  it("interpolates quantiles linearly", () => {
    const xs = [1, 2, 3, 4];
    expect(quantile(xs, 0)).toBe(1);
    expect(quantile(xs, 1)).toBe(4);
    expect(quantile(xs, 0.5)).toBeCloseTo(2.5, 10);
  });

  it("finds the worst peak-to-trough decline", () => {
    expect(maxDrawdown([1, 3, 2, 5, 1])).toBe(4);
    expect(maxDrawdown([1, 2, 3])).toBe(0);
  });

  it("accumulates from a starting balance", () => {
    expect(cumulative([1, -2, 3], 10)).toEqual([11, 9, 12]);
  });
});

describe("normal distribution", () => {
  it("matches known CDF values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(-2.575829)).toBeCloseTo(0.005, 5);
  });

  it("inverts itself", () => {
    for (const p of [0.001, 0.025, 0.1, 0.5, 0.9, 0.975, 0.999]) {
      expect(normalCdf(normalInv(p))).toBeCloseTo(p, 6);
    }
  });

  it("returns the textbook critical value", () => {
    expect(normalInv(0.975)).toBeCloseTo(1.959964, 4);
  });
});

describe("Student's t", () => {
  it("matches published critical values", () => {
    // Two-sided 5% critical value at 10 df is 2.228.
    expect(studentTTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    // At 1% and 20 df it is 2.845.
    expect(studentTTwoSidedP(2.845, 20)).toBeCloseTo(0.01, 3);
  });

  it("approaches the normal tail as df grows", () => {
    expect(studentTTwoSidedP(1.959964, 100000)).toBeCloseTo(0.05, 3);
  });

  it("evaluates the incomplete beta at known points", () => {
    expect(incompleteBeta(1, 1, 0.4)).toBeCloseTo(0.4, 8);
    expect(incompleteBeta(2, 2, 0.5)).toBeCloseTo(0.5, 8);
  });

  it("finds no effect in a sample centred on zero", () => {
    const { p } = tTestAgainstZero([-2, -1, 0, 1, 2]);
    expect(p).toBeCloseTo(1, 6);
  });

  it("finds an effect in a clearly positive sample", () => {
    const { t, p } = tTestAgainstZero([9, 10, 11, 10, 10, 9, 11, 10]);
    expect(t).toBeGreaterThan(10);
    expect(p).toBeLessThan(0.001);
  });
});

describe("Benjamini–Hochberg", () => {
  it("adjusts a uniform ladder to a common q-value", () => {
    const q = benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.05]);
    for (const value of q) expect(value).toBeCloseTo(0.05, 10);
  });

  it("preserves input order", () => {
    const q = benjaminiHochberg([0.9, 0.001]);
    expect(q[1]).toBeLessThan(q[0]);
  });

  it("enforces monotonicity and caps at one", () => {
    const q = benjaminiHochberg([0.5, 0.6, 0.9, 0.95]);
    expect(Math.max(...q)).toBeLessThanOrEqual(1);
    for (const value of q) expect(value).toBeLessThanOrEqual(1);
  });

  it("handles the empty case", () => {
    expect(benjaminiHochberg([])).toEqual([]);
  });
});
