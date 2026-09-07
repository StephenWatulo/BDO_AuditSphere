import { z } from 'zod';
import type { Severity } from './constants';

export const scaleValue = z.number().int().min(1).max(5);

export const ScoringWeightsSchema = z.object({
  likelihood: z.number().min(0).default(1),
  impact: z.number().min(0).default(1),
  velocity: z.number().min(0).default(0),
});
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export const ThresholdsSchema = z.object({
  LOW: z.number(),
  MEDIUM: z.number(),
  HIGH: z.number(),
  CRITICAL: z.number(),
});
export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const DEFAULT_THRESHOLDS: Thresholds = { LOW: 5, MEDIUM: 10, HIGH: 16, CRITICAL: 25 };
export const DEFAULT_WEIGHTS: ScoringWeights = { likelihood: 1, impact: 1, velocity: 0 };

export const VELOCITY_FACTOR: Record<'SLOW' | 'MODERATE' | 'FAST' | 'IMMEDIATE', number> = {
  SLOW: 0.85,
  MODERATE: 1,
  FAST: 1.15,
  IMMEDIATE: 1.3,
};

export const RiskInputSchema = z.object({
  inherentLikelihood: scaleValue,
  inherentImpact: scaleValue,
  /** 1 = no effective controls ... 5 = fully effective. */
  controlEffectiveness: scaleValue,
  velocity: z.enum(['SLOW', 'MODERATE', 'FAST', 'IMMEDIATE']).default('MODERATE'),
  appetiteThreshold: z.number().optional(),
});
export type RiskInput = z.input<typeof RiskInputSchema>;

export interface RiskScoreResult {
  inherentScore: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  rating: Severity;
  withinAppetite: boolean | null;
}

/**
 * Standard model: score = L x I on a 1-5 scale (max 25).
 * Control effectiveness reduces likelihood (controls mostly stop events happening)
 * and, to a lesser degree, impact (detective/corrective controls limit damage).
 * Velocity multiplies the residual score when weighted.
 */
export function scoreRisk(
  input: RiskInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): RiskScoreResult {
  const parsed = RiskInputSchema.parse(input);
  const w = ScoringWeightsSchema.parse(weights);

  const inherentScore = round(
    parsed.inherentLikelihood * w.likelihood * (parsed.inherentImpact * w.impact),
  );

  // Effectiveness 1..5 => mitigation 0..0.8 of likelihood, 0..0.4 of impact.
  const mitigation = (parsed.controlEffectiveness - 1) / 4;
  const residualLikelihood = clamp(round(parsed.inherentLikelihood * (1 - 0.8 * mitigation)), 1, 5);
  const residualImpact = clamp(round(parsed.inherentImpact * (1 - 0.4 * mitigation)), 1, 5);

  const velocityFactor = 1 + (VELOCITY_FACTOR[parsed.velocity] - 1) * w.velocity;
  const residualScore = round(
    residualLikelihood * w.likelihood * (residualImpact * w.impact) * velocityFactor,
  );

  const rating = ratingFor(residualScore, thresholds);
  const withinAppetite =
    parsed.appetiteThreshold === undefined ? null : residualScore <= parsed.appetiteThreshold;

  return { inherentScore, residualLikelihood, residualImpact, residualScore, rating, withinAppetite };
}

export function ratingFor(score: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): Severity {
  if (score <= thresholds.LOW) return 'LOW';
  if (score <= thresholds.MEDIUM) return 'MEDIUM';
  if (score <= thresholds.HIGH) return 'HIGH';
  return 'CRITICAL';
}

/** Suggested audit frequency in months, based on residual rating. */
export function suggestedFrequencyMonths(rating: Severity): number {
  return { CRITICAL: 12, HIGH: 18, MEDIUM: 36, LOW: 60 }[rating];
}

/** 5x5 heat-map cell descriptor used by dashboards. */
export function heatMapCells(thresholds: Thresholds = DEFAULT_THRESHOLDS) {
  const cells: { likelihood: number; impact: number; score: number; rating: Severity }[] = [];
  for (let l = 1; l <= 5; l++)
    for (let i = 1; i <= 5; i++)
      cells.push({ likelihood: l, impact: i, score: l * i, rating: ratingFor(l * i, thresholds) });
  return cells;
}

function round(n: number, dp = 2) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
