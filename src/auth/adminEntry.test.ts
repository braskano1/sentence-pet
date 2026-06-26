import { describe, it, expect } from 'vitest';
import { isAdminEntry } from './adminEntry';

describe('isAdminEntry', () => {
  it('is true for the #admin hash', () => {
    expect(isAdminEntry('#admin')).toBe(true);
  });
  it('is false for empty or other hashes', () => {
    expect(isAdminEntry('')).toBe(false);
    expect(isAdminEntry('#shop')).toBe(false);
    expect(isAdminEntry('#admins')).toBe(false);
  });
});
