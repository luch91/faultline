import { describe, expect, it } from 'vitest';
import { evaluate, verifySafeguard } from '../../../../packages/simulator/src';
import { missingApproval, missingApprovalIntervention } from '../../../../fixtures/workflows/missing-approval';
import { contextPaths, degrees, networkFor } from './model';
import { motionAt, projectScreen, screenQuadAt } from './motion';

describe('locked reference presentation with actual workflow data', () => {
  it('keeps policy separate from actual gates across all evaluated scenarios', async () => {
    const baseline = await evaluate(missingApproval);
    const failure = await evaluate(missingApproval, missingApprovalIntervention);
    const safeguard = await verifySafeguard(missingApproval, missingApprovalIntervention, 'deploy-production', 'human-approval');
    expect([baseline.outcome, failure.outcome, safeguard.repaired.outcome]).toEqual(['SAFE_EXECUTION', 'UNSAFE_EXECUTION', 'SAFE_BLOCK']);
    const network = networkFor(missingApproval, failure, missingApprovalIntervention, null);
    expect(network.links.filter(link => link.gate)).toHaveLength(2);
    expect(network.links.some(link => link.gate && link.from === 'human-approval')).toBe(false);
    expect(network.links.some(link => link.policy && link.from === 'human-approval')).toBe(true);
    expect(network.nodes.find(node => node.id === 'deploy-production')?.state).toBe('UNSAFE');
    const repaired = networkFor(safeguard.patched, safeguard.repaired, missingApprovalIntervention, { stepId: 'deploy-production', conditionId: 'human-approval' });
    expect(repaired.nodes.find(node => node.id === 'human-approval')?.state).toBe('VIOLATED');
    expect(repaired.nodes.find(node => node.id === 'deploy-production')?.state).toBe('BLOCKED');
    expect(repaired.links.filter(link => link.tested)).toHaveLength(1);
  });
  it('derives every record, chart value, and context path from declared evidence', async () => {
    const network = networkFor(missingApproval, await evaluate(missingApproval), null, null);
    const ids = new Set(network.nodes.map(node => node.id));
    expect(ids.size).toBe(network.nodes.length);
    expect(network.links.every(link => ids.has(link.from) && ids.has(link.to))).toBe(true);
    expect(degrees(network).reduce((sum, record) => sum + record.count, 0)).toBe(network.links.length * 2);
    const path = contextPaths(network, 'deploy-production').get('human-approval');
    expect(path?.map(link => link.relation)).toEqual(['POLICY APPLIES TO', 'POLICY REQUIREMENT']);
    const token = network.nodes.find(node => node.id === 'missing-approval-source:token:56');
    expect(token?.name).toBe('human');
    expect(token?.detail).toContain('56:61');
  });
  it('reproduces measured cuts and radial formation instead of generic graph animation', () => {
    expect(motionAt(1.53).environment).toBe(0);
    expect(motionAt(47 / 30).environment).toBe(1);
    expect(motionAt(2.7).expansion).toBeLessThan(motionAt(3.7).expansion);
    expect(motionAt(5).expansion).toBe(1);
    expect(motionAt(7.9).analytics).toBe(1);
    expect(motionAt(314 / 30).phase).toBe('overview');
    expect(screenQuadAt(11)).toEqual([[130, 28], [618, 28], [614, 372], [131, 370]]);
    expect(projectScreen(screenQuadAt(5))).not.toContain('NaN');
    expect(motionAt(18.56).focus).toBe(1);
  });
});
