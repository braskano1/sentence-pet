import { describe, it, expect } from 'vitest';
import { firebaseApp } from './app';
import { db } from './db';
import { auth, signIn, signOutUser, onAuthChange } from './auth';

describe('firebase init', () => {
  it('exports an initialized app, db, and auth', () => {
    expect(firebaseApp).toBeTruthy();
    expect(db).toBeTruthy();
    expect(auth).toBeTruthy();
  });

  it('exposes auth helpers', () => {
    expect(typeof signIn).toBe('function');
    expect(typeof signOutUser).toBe('function');
    expect(typeof onAuthChange).toBe('function');
  });
});
