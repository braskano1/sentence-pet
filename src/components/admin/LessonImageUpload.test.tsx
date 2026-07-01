import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../firebase/imageTranscode', () => ({ downscaleSprite: vi.fn(async (f: File) => f) }));
const uploadLessonImage = vi.fn(async (_id: string, _slot: string, _f: File) => 'https://download/lesson.png');
const deleteByUrl = vi.fn(async (_url: string) => {});
vi.mock('../../firebase/storage', () => ({
  uploadLessonImage: (...a: unknown[]) => uploadLessonImage(...(a as [string, string, File])),
  deleteByUrl: (...a: unknown[]) => deleteByUrl(...(a as [string])),
}));

import { LessonImageUpload } from './LessonImageUpload';

beforeEach(() => { vi.clearAllMocks(); });

describe('LessonImageUpload', () => {
  it('uploads via uploadLessonImage(itemId, slot, file) and reports the url', async () => {
    const onUpload = vi.fn();
    render(<LessonImageUpload label="upload image" itemId="c0u1-fc-1" slot="image"
      value={undefined} onUpload={onUpload} onClear={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('upload image') as HTMLInputElement,
      { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('https://download/lesson.png'));
    expect(uploadLessonImage).toHaveBeenCalledWith('c0u1-fc-1', 'image', expect.any(File));
  });

  it('clears via deleteByUrl for the leftImage slot', async () => {
    const onClear = vi.fn();
    render(<LessonImageUpload label="upload left" itemId="c0u1-mt-1" slot="leftImage"
      value="https://download/old.png" onUpload={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'clear upload left' }));
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(deleteByUrl).toHaveBeenCalledWith('https://download/old.png'));
  });
});
