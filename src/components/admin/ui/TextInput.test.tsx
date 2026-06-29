import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('shows the value and fires onChange on typing', () => {
    const onChange = vi.fn();
    render(<TextInput aria-label="name" value="Sprout" onChange={onChange} />);
    const input = screen.getByLabelText('name');
    expect(input).toHaveValue('Sprout');
    fireEvent.change(input, { target: { value: 'Sproutling' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('marks aria-invalid when invalid', () => {
    render(<TextInput aria-label="name" value="" onChange={() => {}} invalid />);
    expect(screen.getByLabelText('name')).toHaveAttribute('aria-invalid', 'true');
  });
});
