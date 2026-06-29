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

  it('closes on Escape', () => {
    const a = def('a', { name: 'Alpha' });
    let closed = false;
    render(<DexDetail def={a} defs={[a]} caught={new Set(['a'])} onClose={() => { closed = true; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});

describe('DexDetail per-stage art', () => {
  it('renders every stage of the chain with correct caught/uncaught alt text', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { name: 'Gamma', dexNo: 3, evolvesFromId: 'b' });
    render(<DexDetail def={a} defs={[a, b, c]} caught={new Set(['a', 'b'])} onClose={() => {}} />);
    expect(screen.getByAltText('Alpha')).toBeInTheDocument(); // caught
    expect(screen.getByAltText('Beta')).toBeInTheDocument();  // caught
    expect(screen.getByAltText('Undiscovered')).toBeInTheDocument(); // uncaught tip
    expect(screen.getAllByRole('img').length).toBe(3);
  });

  it('shows different sprite art per stage (not three identical adult sprites)', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a' });
    render(<DexDetail def={a} defs={[a, b]} caught={new Set(['a', 'b'])} onClose={() => {}} />);
    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    expect(imgs.length).toBe(2);
    // baby (root) vs adult (tip) resolve to distinct sprite sources.
    expect(imgs[0].src).not.toBe(imgs[1].src);
  });
});
