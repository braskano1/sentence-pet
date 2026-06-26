import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HintButton } from './HintButton';

describe('HintButton', () => {
  it('calls onHint when tapped', () => {
    const onHint = vi.fn();
    render(<HintButton onHint={onHint} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(onHint).toHaveBeenCalled();
  });
  it('is disabled when there is nothing to fill', () => {
    render(<HintButton onHint={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /hint/i })).toBeDisabled();
  });
});
