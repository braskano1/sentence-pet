import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevPanel } from './DevPanel';
import { useGameStore, selectActivePet } from '../state/gameStore';

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
    const before = selectActivePet(useGameStore.getState()).xp;
    fireEvent.click(screen.getByRole('button', { name: '+50xp' }));
    expect(selectActivePet(useGameStore.getState()).xp).toBe(before + 50);
  });

  it('reroll keeps species a valid value', () => {
    render(<DevPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    fireEvent.click(screen.getByRole('button', { name: 'reroll' }));
    expect(['leaf', 'fire', 'air', 'water']).toContain(selectActivePet(useGameStore.getState()).species);
  });

  it('+pet adds a pet and makes it active', () => {
    render(<DevPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    const before = useGameStore.getState().pets.length;
    fireEvent.click(screen.getByRole('button', { name: '+pet' }));
    const s = useGameStore.getState();
    expect(s.pets).toHaveLength(before + 1);
    expect(s.activePetId).toBe(s.pets[s.pets.length - 1].id);
  });

  it('next cycles the active pet', () => {
    render(<DevPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'dev' }));
    fireEvent.click(screen.getByRole('button', { name: '+pet' })); // now 2 pets, active = new
    const firstActive = useGameStore.getState().activePetId;
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(useGameStore.getState().activePetId).not.toBe(firstActive);
  });
});
