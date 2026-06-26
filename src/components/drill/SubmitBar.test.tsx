import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubmitBar } from './SubmitBar';

describe('SubmitBar', () => {
  it('renders a Submit button and calls onSubmit when tapped', () => {
    const onSubmit = vi.fn();
    render(<SubmitBar onSubmit={onSubmit} />);
    const btn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not call onSubmit when disabled', () => {
    const onSubmit = vi.fn();
    render(<SubmitBar onSubmit={onSubmit} disabled />);
    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
