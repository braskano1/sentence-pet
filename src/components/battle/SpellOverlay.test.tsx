import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellOverlay } from './SpellOverlay';

const challenge = { words: ['he', 'eat'], wrongIndex: 1, tip: 'เขา → he eats 👍' };

describe('SpellOverlay', () => {
  it('renders the wrong sentence as tappable chips and reports the tapped index', () => {
    const onResolve = vi.fn();
    render(<SpellOverlay challenge={challenge} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: 'eat' }));
    expect(onResolve).toHaveBeenCalledWith(1);
  });
});
