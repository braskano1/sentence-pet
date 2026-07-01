import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// downscaleSprite passes the file through in tests (no canvas in jsdom).
vi.mock('../../firebase/imageTranscode', () => ({
  downscaleSprite: vi.fn(async (f: File) => f),
}));

import { ImageUpload } from './ImageUpload';

function setup(props: Partial<React.ComponentProps<typeof ImageUpload>> = {}) {
  const onUpload = vi.fn();
  const onClear = vi.fn();
  const upload = vi.fn(async (_f: File) => 'https://download/new.png');
  const remove = vi.fn(async (_url: string) => {});
  render(
    <ImageUpload label="upload image" value={undefined}
      onUpload={onUpload} onClear={onClear} upload={upload} remove={remove} {...props} />,
  );
  return { onUpload, onClear, upload, remove };
}

const file = () => new File(['x'], 'a.png', { type: 'image/png' });

function pickFile() {
  const input = screen.getByLabelText('upload image') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file()] } });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ImageUpload', () => {
  it('picks a file, uploads it, and reports the new url', async () => {
    const { onUpload, upload } = setup();
    pickFile();
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('https://download/new.png'));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('deletes the prior object when replacing with a different url', async () => {
    const { remove } = setup({ value: 'https://download/old.png' });
    pickFile();
    await waitFor(() => expect(remove).toHaveBeenCalledWith('https://download/old.png'));
  });

  it('does NOT delete when the new url equals the prior url', async () => {
    const { onUpload, remove } = setup({ value: 'https://download/new.png' }); // upload returns this same url
    pickFile();
    // Wait for the full upload path to complete before asserting the absence of a delete.
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('https://download/new.png'));
    expect(remove).not.toHaveBeenCalled();
  });

  it('clears the value and best-effort deletes the prior object', async () => {
    const { onClear, remove } = setup({ value: 'https://download/old.png' });
    fireEvent.click(screen.getByRole('button', { name: 'clear upload image' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(remove).toHaveBeenCalledWith('https://download/old.png'));
  });

  it('swallows a remove() rejection (no throw escapes the component)', async () => {
    const remove = vi.fn(async () => { throw new Error('not found'); });
    const onClear = vi.fn();
    render(
      <ImageUpload label="upload image" value="https://download/old.png"
        onUpload={vi.fn()} onClear={onClear} upload={vi.fn(async () => 'https://download/new.png')} remove={remove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'clear upload image' }));
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(remove).toHaveBeenCalled()); // rejection swallowed, test does not error
  });

  it('shows an error message when upload throws', async () => {
    render(
      <ImageUpload label="upload image" value={undefined}
        onUpload={vi.fn()} onClear={vi.fn()}
        upload={vi.fn(async () => { throw new Error('upload failed'); })} remove={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText('upload image') as HTMLInputElement, { target: { files: [file()] } });
    await waitFor(() => expect(screen.getByText(/upload failed/)).toBeInTheDocument());
  });
});
