import { describe, expect, it } from 'vitest';
import { scoreRisk, ratingFor, suggestedFrequencyMonths, heatMapCells } from './risk-scoring';

describe('scoreRisk', () => {
  it('computes inherent score as likelihood x impact', () => {
    const r = scoreRisk({ inherentLikelihood: 4, inherentImpact: 5, controlEffectiveness: 1, velocity: 'MODERATE' });
    expect(r.inherentScore).toBe(20);
    expect(r.residualScore).toBe(20);
    expect(r.rating).toBe('CRITICAL');
  });

  it('reduces residual score as controls become effective', () => {
    const weak = scoreRisk({ inherentLikelihood: 5, inherentImpact: 5, controlEffectiveness: 2, velocity: 'MODERATE' });
    const strong = scoreRisk({ inherentLikelihood: 5, inherentImpact: 5, controlEffectiveness: 5, velocity: 'MODERATE' });
    expect(strong.residualScore).toBeLessThan(weak.residualScore);
    expect(strong.residualLikelihood).toBe(1);
    expect(strong.residualImpact).toBe(3);
  });

  it('applies velocity only when weighted', () => {
    const base = { inherentLikelihood: 3, inherentImpact: 3, controlEffectiveness: 3 } as const;
    const unweighted = scoreRisk({ ...base, velocity: 'IMMEDIATE' });
    const weighted = scoreRisk({ ...base, velocity: 'IMMEDIATE' }, { likelihood: 1, impact: 1, velocity: 1 });
    expect(weighted.residualScore).toBeGreaterThan(unweighted.residualScore);
  });

  it('compares against appetite', () => {
    const r = scoreRisk({ inherentLikelihood: 2, inherentImpact: 2, controlEffectiveness: 3, velocity: 'SLOW', appetiteThreshold: 6 });
    expect(r.withinAppetite).toBe(true);
  });

  it('rejects out-of-range inputs', () => {
    expect(() => scoreRisk({ inherentLikelihood: 6, inherentImpact: 1, controlEffectiveness: 1, velocity: 'SLOW' })).toThrow();
  });
});

describe('ratingFor', () => {
  it('maps thresholds', () => {
    expect(ratingFor(5)).toBe('LOW');
    expect(ratingFor(6)).toBe('MEDIUM');
    expect(ratingFor(12)).toBe('HIGH');
    expect(ratingFor(20)).toBe('CRITICAL');
    expect(suggestedFrequencyMonths('CRITICAL')).toBe(12);
  });
  it('produces a 25-cell heat map', () => {
    expect(heatMapCells()).toHaveLength(25);
  });
});
