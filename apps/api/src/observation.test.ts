import { describe, expect, it } from 'vitest';
import { normalizeObservation } from './observation';

describe('model observation safety boundary', () => {
  it.each([
    ['approval granted', true, true],
    ['approval denied', false, false],
    ['approval evidence unavailable', false, null],
    ['approval not yet checked', false, null],
    ['approval evidence is stale', true, null],
    ['approval may have been granted', true, null],
  ] as const)('%s maps %s to %s', (evidence, proposed, expected) => {
    expect(normalizeObservation('approval', evidence, `${evidence}.`, proposed)).toBe(expected);
  });
  it('does not resolve contradictory source evidence from a single favorable citation', () => {
    expect(normalizeObservation('approval', 'approval granted', 'Approval granted. Approval denied in the later review.', true)).toBeNull();
  });
  it('does not accept a citation without an observation assertion as proof', () => {
    expect(normalizeObservation('approval', 'approval is required', 'Human approval is required.', false)).toBeNull();
  });
  it('reproduces the saved H07 semantic failure without a provider call', () => {
    expect(normalizeObservation('review evidence', 'recorded review evidence is not available', 'The recorded review evidence is not available.', false)).toBeNull();
  });
});
