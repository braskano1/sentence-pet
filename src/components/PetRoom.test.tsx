import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

beforeEach(() => useGameStore.getState().resetForTest());

describe('PetRoom', () => {
  it('Play opens the drill picker', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    expect(screen.getByRole('img', { name: /^pet-/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
  });

  it('Shop button navigates to shop', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /shop/i }));
    expect(useGameStore.getState().screen).toBe('shop');
  });

  it('shows no room background image by default (free default)', () => {
    useGameStore.getState().resetForTest();
    render(<PetRoom />);
    expect(screen.queryByTestId('room-bg')).toBeNull();
  });

  it('renders the active room background when one is equipped', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipBackground('decor:beach');
    render(<PetRoom />);
    const bg = screen.getByTestId('room-bg');
    expect(bg).toBeInTheDocument();
    expect(bg).toHaveAttribute('src', GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!.sprite);
  });

  it('My Pets button opens the collection screen', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    expect(screen.getByRole('button', { name: /my pets/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /my pets/i }));
    expect(useGameStore.getState().screen).toBe('collection');
  });

  it('shows identity chip with level, the XP bar label, and My Pets button', () => {
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true, xp: 40 })) }));
    render(<PetRoom />);
    expect(screen.getByText(/Lv 2/)).toBeTruthy();
    expect(screen.getByText(/XP →/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /my pets/i })).toBeTruthy();
  });

  it('Care tab shows happiness and a feed button per owned food; feeding calls the store', () => {
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })), inventory: { ...s.inventory, protein: 3 } }));
    render(<PetRoom />);
    expect(screen.getByText(/Happiness/i)).toBeTruthy();
    const feedProtein = screen.getByRole('button', { name: /feed protein/i });
    fireEvent.click(feedProtein);
    expect(useGameStore.getState().inventory.protein).toBe(0);
  });

  it('switches to the Power tab', () => {
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
    render(<PetRoom />);
    fireEvent.click(screen.getByRole('tab', { name: /power/i }));
    expect(screen.getByRole('tabpanel')).toBeTruthy();
  });

  it('Power tab shows level/power/specialty rail', () => {
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
    render(<PetRoom />);
    fireEvent.click(screen.getByRole('tab', { name: /power/i }));
    expect(screen.getByText('Level')).toBeTruthy();
    expect(screen.getByText(/Specialty/i)).toBeTruthy();
    expect(screen.getByText(/\/ 50/)).toBeTruthy();
  });
});

describe('PetRoom Eggs button', () => {
  beforeEach(() => useGameStore.getState().resetForTest());
  it('routes to the gacha screen', () => {
    render(<PetRoom />);
    fireEvent.click(screen.getByRole('button', { name: /^eggs/i }));
    expect(useGameStore.getState().screen).toBe('gacha');
  });
});
