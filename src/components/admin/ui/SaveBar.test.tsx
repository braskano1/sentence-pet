import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveBar } from './SaveBar';

describe('SaveBar', () => {
  it('fires onSave when valid and clicked', () => {
    const onSave = vi.fn();
    render(<SaveBar valid status="" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('disables Save when invalid', () => {
    render(<SaveBar valid={false} status="" onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows the status text', () => {
    render(<SaveBar valid status="saved ✓" onSave={() => {}} />);
    expect(screen.getByText('saved ✓')).toBeInTheDocument();
  });

  it('shows the error count when invalid', () => {
    render(<SaveBar valid={false} status="" errorCount={3} onSave={() => {}} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
