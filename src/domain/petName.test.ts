import { describe, expect, it } from 'vitest';
import { sanitizePetName, MAX_PET_NAME } from './petName';

describe('sanitizePetName', () => {
  it('trims surrounding whitespace', () => expect(sanitizePetName('  Rex  ')).toBe('Rex'));
  it('caps length at MAX_PET_NAME', () => {
    expect(MAX_PET_NAME).toBe(14);
    expect(sanitizePetName('x'.repeat(20))).toHaveLength(14);
  });
  it('passes an empty / whitespace-only name through as empty', () => {
    expect(sanitizePetName('')).toBe('');
    expect(sanitizePetName('   ')).toBe('');
  });
});
