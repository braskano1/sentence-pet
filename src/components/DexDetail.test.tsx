import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

function def(id: string, over: Partial<PetDef> = {}): PetDef {
  return {
    id, name: id, gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, ...over,
  };
}

describe('DexDetail', () => {
  it('renders each def in the chain; caught shows name, uncaught shows ???', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a' });
    render(<DexDetail def={a} defs={[a, b]} caught={new Set(['a'])} onClose={() => {}} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument(); // caught
    expect(screen.getAllByText('???').length).toBeGreaterThan(0); // uncaught Beta
  });

  it('calls onClose when the close button is clicked', () => {
    const a = def('a', { name: 'Alpha' });
    let closed = false;
    render(<DexDetail def={a} defs={[a]} caught={new Set(['a'])} onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});
