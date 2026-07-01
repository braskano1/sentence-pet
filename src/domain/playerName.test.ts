import { describe, it, expect } from 'vitest';
import { sanitizeName, NAME_MIN, NAME_MAX } from './playerName';

describe('sanitizeName', () => {
  it('accepts a normal name and trims/collapses whitespace', () => {
    const r = sanitizeName('  Ava   Lee  ');
    expect(r).toEqual({ ok: true, name: 'Ava Lee' });
  });

  it('rejects too short', () => {
    expect(sanitizeName('A').ok).toBe(false);
    expect(sanitizeName('A').reason).toBe('length');
  });

  it('rejects too long (>NAME_MAX)', () => {
    const long = 'a'.repeat(NAME_MAX + 1);
    expect(sanitizeName(long).ok).toBe(false);
    expect(sanitizeName(long).reason).toBe('length');
  });

  it('rejects digits (blocks phone numbers / number-runs)', () => {
    expect(sanitizeName('Ava123').ok).toBe(false);
    expect(sanitizeName('Ava123').reason).toBe('charset');
  });

  it('rejects emails and urls via charset (@ . / :)', () => {
    expect(sanitizeName('me@x.com').ok).toBe(false);
    expect(sanitizeName('http://x').ok).toBe(false);
  });

  it('rejects blocklisted words case-insensitively', () => {
    expect(sanitizeName('SuperDarn', { blocklist: ['darn'] }).ok).toBe(false);
    expect(sanitizeName('SuperDarn', { blocklist: ['darn'] }).reason).toBe('blocked');
  });

  it('allows accented letters (NFKC-normalized)', () => {
    expect(sanitizeName('Zoé').ok).toBe(true);
  });

  it('NAME_MIN/NAME_MAX are 2 and 16', () => {
    expect([NAME_MIN, NAME_MAX]).toEqual([2, 16]);
  });
});
