import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StarPips } from './StarPips';

describe('StarPips', () => {
  it('renders three stars total, filled to n', () => {
    const { container } = render(<StarPips n={2} />);
    expect(container.textContent).toBe('★★★');
    expect(container.querySelector('.text-slate-300')?.textContent).toBe('★');
  });

  it('clamps n to the max', () => {
    const { container } = render(<StarPips n={9} max={3} />);
    expect(container.textContent).toBe('★★★');
    expect(container.querySelector('.text-slate-300')?.textContent).toBe('');
  });
});
