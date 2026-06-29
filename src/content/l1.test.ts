import { describe, it, expect } from 'vitest';
import { showL1 } from './l1';

describe('showL1 display rule', () => {
  const helper = { th: 'แมว' };
  it('shows Thai only when enabled + TH + helper present', () => {
    expect(showL1({ l1Enabled: true }, 'TH', helper)).toBe('แมว');
  });
  it('hides when unit l1 disabled', () => {
    expect(showL1({ l1Enabled: false }, 'TH', helper)).toBeNull();
  });
  it('hides in ENG mode', () => {
    expect(showL1({ l1Enabled: true }, 'ENG', helper)).toBeNull();
  });
  it('hides when no helper', () => {
    expect(showL1({ l1Enabled: true }, 'TH', undefined)).toBeNull();
  });
  it('hides when helper th is blank', () => {
    expect(showL1({ l1Enabled: true }, 'TH', { th: '  ' })).toBeNull();
  });
});
