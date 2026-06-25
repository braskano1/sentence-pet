import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevPanel } from './DevPanel';
import { useGameStore } from '../state/gameStore';

describe('DevPanel', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('opens from the collapsed toggle', () => {
    render(<DevPanel />);
    expect(screen.queryByText('DEV')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    expect(screen.getByText('DEV')).toBeTruthy();
  });

  it('+50xp adds xp to the store', () => {
    render(<DevPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    const before = useGameStore.getState().pet.xp;
    fireEvent.click(screen.getByRole('button', { name: '+50xp' }));
    expect(useGameStore.getState().pet.xp).toBe(before + 50);
  });

  it('reroll keeps species a valid value', () => {
    render(<DevPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    fireEvent.click(screen.getByRole('button', { name: 'reroll' }));
    expect(['leaf', 'fire', 'air', 'water']).toContain(useGameStore.getState().pet.species);
  });
});
