import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PressButton } from './PressButton';

describe('PressButton', () => {
  it('renders children and forwards className', () => {
    render(<PressButton className="my-class">Hello</PressButton>);
    const btn = screen.getByRole('button', { name: 'Hello' });
    expect(btn).toHaveClass('my-class');
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<PressButton onClick={onClick}>Tap</PressButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Tap' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<PressButton disabled onClick={onClick}>Nope</PressButton>);
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
