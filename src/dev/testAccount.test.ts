import { describe, it, expect, vi } from 'vitest';

// Avoid initialising the real firebase auth module on import.
vi.mock('../firebase/auth', () => ({ auth: {} }));

import { viewAsTestAccount, TEST_EMAIL, TEST_PASSWORD } from './testAccount';

describe('viewAsTestAccount', () => {
  it('creates the account and seeds progress on first use', async () => {
    const create = vi.fn().mockResolvedValue({});
    const seed = vi.fn();
    const signIn = vi.fn();
    await viewAsTestAccount({ create, seed, signIn });
    expect(create).toHaveBeenCalledOnce();
    expect(seed).toHaveBeenCalledOnce();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in (no seed) when the account already exists', async () => {
    const create = vi.fn().mockRejectedValue({ code: 'auth/email-already-in-use' });
    const seed = vi.fn();
    const signIn = vi.fn().mockResolvedValue(undefined);
    await viewAsTestAccount({ create, seed, signIn });
    expect(signIn).toHaveBeenCalledWith(TEST_EMAIL, TEST_PASSWORD);
    expect(seed).not.toHaveBeenCalled();
  });

  it('rethrows unexpected errors', async () => {
    const create = vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(
      viewAsTestAccount({ create, seed: vi.fn(), signIn: vi.fn() }),
    ).rejects.toMatchObject({ code: 'auth/network-request-failed' });
  });
});
