import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatRadar } from './StatRadar';

describe('StatRadar', () => {
  it('renders all five axis labels with values', () => {
    const { getByText } = render(
      <StatRadar stats={{ hp: 70, atk: 60, def: 50, spd: 40, luk: 30 }} color="#8b5cf6" specialty="hp" />,
    );
    expect(getByText(/HP 70/)).toBeTruthy();
    expect(getByText(/LUK 30/)).toBeTruthy();
  });
});
