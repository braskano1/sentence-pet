import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const m = vi.hoisted(() => ({
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  viewAsTestAccount: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ signIn: m.signIn, signOut: m.signOut }) }));
vi.mock('../dev/testAccount', () => ({ viewAsTestAccount: m.viewAsTestAccount }));

import { DevPanel } from './DevPanel';
import { useGameStore, selectActivePet } from '../state/gameStore';

function openPanel() {
  render(<DevPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'dev' }));
}

describe('DevPanel', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
    m.signIn.mockClear();
    m.signOut.mockClear();
    m.viewAsTestAccount.mockClear();
  });

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

  it('VIEW AS · new player resets to the egg-hatch first run', () => {
    openPanel();
    useGameStore.setState({ screen: 'petRoom', coins: 999 });
    fireEvent.click(screen.getByRole('button', { name: /new player/i }));
    const s = useGameStore.getState();
    expect(s.screen).toBe('egg');
    expect(s.coins).toBe(0);
    expect(selectActivePet(s).hatched).toBe(false);
  });

  it('VIEW AS · loadout populates a returning-player progress state', () => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: /loadout/i }));
    const s = useGameStore.getState();
    expect(s.pets).toHaveLength(2);
    expect(s.coins).toBe(500);
    expect(selectActivePet(s).hatched).toBe(true);
  });

  it('VIEW AS · sign out calls signOut', () => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(m.signOut).toHaveBeenCalled();
  });

  it('VIEW AS · test acct calls viewAsTestAccount', () => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: /test acct/i }));
    expect(m.viewAsTestAccount).toHaveBeenCalled();
  });
});
