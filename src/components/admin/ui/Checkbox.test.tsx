import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders the label and reflects checked', () => {
    render(<Checkbox label="enabled" checked onChange={() => {}} />);
    expect(screen.getByLabelText('enabled')).toBeChecked();
  });

  it('fires onChange when toggled', () => {
    const onChange = vi.fn();
    render(<Checkbox label="enabled" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('enabled'));
    expect(onChange).toHaveBeenCalled();
  });

  it('passes through disabled', () => {
    render(<Checkbox label="starter" checked={false} disabled onChange={() => {}} />);
    expect(screen.getByLabelText('starter')).toBeDisabled();
  });
});
