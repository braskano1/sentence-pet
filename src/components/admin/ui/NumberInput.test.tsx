import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('fires onValueChange with the parsed number', () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="gen" value={1} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('gen'), { target: { value: '4' } });
    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  it('fires onValueChange(null) when the field is cleared', () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="gen" value={1} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('gen'), { target: { value: '' } });
    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
