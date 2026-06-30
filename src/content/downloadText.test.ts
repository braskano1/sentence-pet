import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadText } from './downloadText';

const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;

describe('downloadText', () => {
  beforeEach(() => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:fake');
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = origRevoke;
  });

  it('clicks an anchor with the filename and revokes the url', () => {
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') { el.click = click; anchor = el; }
      return el;
    });

    downloadText('# hello', 'pets-guide.md');

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor?.download).toBe('pets-guide.md');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    spy.mockRestore();
  });
});
