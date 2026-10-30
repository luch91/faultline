const uncertain = /\b(?:unknown|unavailable|not available|not recorded|not observed|not checked|not yet checked|inconclusive|unclear|uncertain|stale|outdated|unverified|unconfirmed|might|may have|pending)\b/i;
const negative = /\b(?:denied|rejected|failed|failing|absent|missing|false|incompatible|incomplete|unmet|not approved|not granted|not passed|not complete|did not pass|not verified)\b/i;
const positive = /\b(?:approved|granted|passed|passing|present|succeeded|successful|true|compatible|verified|completed|complete|available|accepted|met)\b/i;

function polarity(sentence: string): 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | 'NONE' {
  if (uncertain.test(sentence)) return 'UNKNOWN';
  if (negative.test(sentence)) return 'NEGATIVE';
  if (positive.test(sentence)) return 'POSITIVE';
  return 'NONE';
}

export function normalizeObservation(name: string, evidence: string, source: string, proposed: boolean | null): boolean | null {
  const cited = polarity(evidence);
  if (cited === 'UNKNOWN' || cited === 'NONE') return null;
  if (cited === 'POSITIVE' && proposed === false || cited === 'NEGATIVE' && proposed === true) return null;
  const terms = name.toLowerCase().match(/[a-z]{5,}/g)?.filter(term => !['human', 'state', 'status', 'value', 'recorded', 'condition', 'evidence'].includes(term)) ?? [];
  const sentences = source.split(/[.!?\n]+/).filter(sentence => terms.some(term => sentence.toLowerCase().includes(term)));
  const observed = new Set(sentences.map(polarity).filter(value => value !== 'NONE'));
  if (observed.has('UNKNOWN') || observed.has('POSITIVE') && observed.has('NEGATIVE')) return null;
  return proposed;
}
