import type { StreakResult } from "@/lib/types";
import { normalCdf } from "./core";

/** Expected longest run of an event with probability `p` over `n` trials. */
function expectedLongestRun(n: number, p: number): number {
  if (n <= 0 || p <= 0 || p >= 1) return 0;
  return Math.log(n * (1 - p)) / Math.log(1 / p);
}

/**
 * Streak analysis plus a Wald–Wolfowitz runs test on the win/loss sequence.
 *
 * Two things traders routinely misread. First, they treat a long losing run as
 * proof the system broke, when a run of that length was always likely — hence
 * the expected-versus-observed comparison. Second, they assume wins and losses
 * are independent; if the runs test rejects, they are not, which means the
 * strategy is regime-dependent and every independence-assuming number in this
 * report (the bootstrap included) is optimistic.
 */
export function analyseStreaks(pnl: number[]): StreakResult {
  const outcomes = pnl.filter((x) => x !== 0).map((x) => x > 0);
  const n = outcomes.length;

  if (n === 0) {
    return {
      longestWin: 0,
      longestLoss: 0,
      expectedLongestWin: 0,
      expectedLongestLoss: 0,
      runs: 0,
      expectedRuns: 0,
      runsZ: 0,
      runsPValue: 1,
    };
  }

  let longestWin = 0;
  let longestLoss = 0;
  let current = 0;
  let runs = 1;

  for (let i = 0; i < n; i++) {
    if (i > 0 && outcomes[i] !== outcomes[i - 1]) {
      runs++;
      current = 0;
    }
    current++;
    if (outcomes[i]) {
      if (current > longestWin) longestWin = current;
    } else if (current > longestLoss) {
      longestLoss = current;
    }
  }

  const n1 = outcomes.filter(Boolean).length;
  const n2 = n - n1;

  if (n1 === 0 || n2 === 0) {
    return {
      longestWin,
      longestLoss,
      expectedLongestWin: 0,
      expectedLongestLoss: 0,
      runs,
      expectedRuns: 1,
      runsZ: 0,
      runsPValue: 1,
    };
  }

  const winRate = n1 / n;
  const expectedRuns = (2 * n1 * n2) / n + 1;
  const variance =
    (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  const sd = Math.sqrt(Math.max(variance, 0));
  const z = sd === 0 ? 0 : (runs - expectedRuns) / sd;

  return {
    longestWin,
    longestLoss,
    expectedLongestWin: expectedLongestRun(n, winRate),
    expectedLongestLoss: expectedLongestRun(n, 1 - winRate),
    runs,
    expectedRuns,
    runsZ: z,
    runsPValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))),
  };
}
