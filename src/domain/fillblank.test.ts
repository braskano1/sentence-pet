import { describe, it, expect } from 'vitest';
import { gradeFillBlank, hintAt } from './fillblank';

describe('gradeFillBlank', () => {
  it('strict trimmed match against answer', () => {
    expect(gradeFillBlank({ answer: 'eat' }, '  eat ')).toBe(true);
  });
  it('accepts alternates', () => {
    expect(gradeFillBlank({ answer: 'eat', alternates: ['eats'] }, 'eats')).toBe(true);
  });
  it('rejects wrong', () => {
    expect(gradeFillBlank({ answer: 'eat' }, 'drink')).toBe(false);
  });
  it('is case-sensitive strict (no lowercasing)', () => {
    expect(gradeFillBlank({ answer: 'eat' }, 'EAT')).toBe(false);
  });
});

describe('hintAt ladder', () => {
  const item = { answer: 'eat' };
  it('0 → L1, 1 → first letter, 2 → length dots, 3+ → reveal', () => {
    expect(hintAt(item, 0, 'กิน')).toBe('กิน');
    expect(hintAt(item, 1, 'กิน')).toBe('e…');
    expect(hintAt(item, 2, 'กิน')).toBe('• • •');
    expect(hintAt(item, 3, 'กิน')).toBe('eat');
    expect(hintAt(item, 9, 'กิน')).toBe('eat');
  });
  it('skips L1 step when no helper (null)', () => {
    expect(hintAt({ answer: 'eat' }, 0, null)).toBe('e…');
  });
  it('skips L1 step when helper blank', () => {
    expect(hintAt({ answer: 'eat' }, 0, '   ')).toBe('e…');
  });
});
