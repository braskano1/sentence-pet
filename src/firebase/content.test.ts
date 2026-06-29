import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  writeBatch: () => ({ set: mocks.batchSet, commit: mocks.batchCommit }),
}));
vi.mock('./db', () => ({ db: {} }));

import { fetchCoursesIndex, saveCourse } from './content';
import type { Course } from '../content/course';

describe('fetchCoursesIndex', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the index list when the index doc exists', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ courses: [{ id: 'default', title: 'Beginner' }] }) });
    const idx = await fetchCoursesIndex();
    expect(idx).toEqual([{ id: 'default', title: 'Beginner' }]);
  });
  it('falls back to a synthetic default entry when no index doc exists', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    const idx = await fetchCoursesIndex();
    expect(idx[0].id).toBe('default');
  });
});

describe('saveCourse', () => {
  beforeEach(() => vi.clearAllMocks());
  it('omits undefined emoji/l1Ready from the written index entry', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ courses: [] }) });
    const course: Course = {
      id: 'default', title: 'Beginner Course',
      pool: {}, units: [], gates: [],
    }; // no emoji, no l1Ready
    await saveCourse(course);
    // find the index write (second batch.set call writes { courses: [...] })
    const indexWrite = mocks.batchSet.mock.calls.find((c) => c[1] && 'courses' in c[1]);
    expect(indexWrite).toBeTruthy();
    const entry = indexWrite![1].courses[0];
    expect(entry).toEqual({ id: 'default', title: 'Beginner Course' });
    expect('emoji' in entry).toBe(false);
    expect('l1Ready' in entry).toBe(false);
  });
});
