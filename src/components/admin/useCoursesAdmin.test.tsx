import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const fetchCoursesIndex = vi.fn();
const fetchCourse = vi.fn();
const saveCourse = vi.fn().mockResolvedValue(undefined);
const deleteCourse = vi.fn().mockResolvedValue(undefined);

vi.mock('../../firebase/content', () => ({
  fetchCoursesIndex: () => fetchCoursesIndex(),
  fetchCourse: (id: string) => fetchCourse(id),
  saveCourse: (c: unknown) => saveCourse(c),
  deleteCourse: (id: string) => deleteCourse(id),
}));

import { useCoursesAdmin } from './useCoursesAdmin';
import { useContentStore } from '../../content/store';

const THAI = { id: 'thai', title: 'Thai', pool: {}, units: [], gates: [] };

beforeEach(() => {
  fetchCoursesIndex.mockReset().mockResolvedValue([
    { id: 'thai', title: 'Thai' },
    { id: 'money', title: 'Money' },
  ]);
  fetchCourse.mockReset().mockResolvedValue(THAI);
  saveCourse.mockClear();
  deleteCourse.mockClear();
});

describe('useCoursesAdmin', () => {
  it('loads the course index on mount', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await waitFor(() => expect(result.current.index).toHaveLength(2));
  });

  it('switchTo fetches the course and sets it active in the store', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.switchTo('thai'); });
    expect(fetchCourse).toHaveBeenCalledWith('thai');
    expect(useContentStore.getState().activeCourseId).toBe('thai');
  });

  it('create saves a new empty course, refreshes the index, and switches to it', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.create({ title: 'Brand New' }); });
    expect(saveCourse).toHaveBeenCalled();
    const saved = saveCourse.mock.calls[0][0];
    expect(saved.title).toBe('Brand New');
    expect(useContentStore.getState().course?.id).toBe(saved.id);
  });

  it('remove deletes then refreshes the index', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.remove('money'); });
    expect(deleteCourse).toHaveBeenCalledWith('money');
    expect(fetchCoursesIndex).toHaveBeenCalledTimes(2); // mount + after remove
  });
});
