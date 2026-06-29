import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('renders options and fires onChange', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="element" value="leaf" onChange={onChange}>
        <option value="leaf">leaf</option>
        <option value="fire">fire</option>
      </Select>,
    );
    const select = screen.getByLabelText('element');
    expect(select).toHaveValue('leaf');
    fireEvent.change(select, { target: { value: 'fire' } });
    expect(onChange).toHaveBeenCalled();
  });
});
