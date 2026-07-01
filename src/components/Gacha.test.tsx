import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Gacha } from './Gacha';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

describe('Gacha screen', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  // After a pull, the hatch cinematic plays first; advance through it to the card.
  function advanceCinematic() {
    fireEvent.click(screen.getByTestId('evolution-stage'));            // skip -> reveal
    fireEvent.click(screen.getByRole('button', { name: /continue/i })); // onDone -> name card
  }

  it('shows the pull button disabled when too poor', () => {
    render(<Gacha />);
    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
  });

  it('enables pull when the player can afford an egg', () => {
    useGameStore.getState().addCoinsForTest(60);
    render(<Gacha />);
    expect(screen.getByRole('button', { name: /pull/i })).not.toBeDisabled();
  });

  it('pulling reveals the new pet with its rarity, and grows the collection', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    expect(useGameStore.getState().pets).toHaveLength(2);
    advanceCinematic();
    const rarity = useGameStore.getState().lastPull?.rarity ?? '';
    expect(screen.getByText(new RegExp(`^${rarity}$`, 'i'))).toBeTruthy();
  });

  it('Back returns to the pet room', () => {
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('shows the drop-rate odds for each rarity on the pull screen', () => {
    render(<Gacha />);
    const total = GAME_CONFIG.gacha.rarities.reduce((s, r) => s + r.weight, 0);
    for (const r of GAME_CONFIG.gacha.rarities) {
      const pct = Math.round((r.weight / total) * 100);
      expect(
        screen.getByText(new RegExp(`${r.rarity}\\s*${pct}%`, 'i')),
      ).toBeInTheDocument();
    }
  });

  it('Back from the reveal returns to the pull screen (not petRoom); a second Back leaves to the room', () => {
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().setScreen('gacha');
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    advanceCinematic();
    // On the reveal card: Back should go back to eggs, not navigate away.
    fireEvent.click(screen.getByRole('button', { name: /back to eggs/i }));
    expect(useGameStore.getState().screen).toBe('gacha');
    expect(screen.getByRole('button', { name: /pull/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /name your pet/i })).toBeNull();
    // Now on the pull screen: Back leaves to the room.
    fireEvent.click(screen.getByRole('button', { name: /back to room/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('names the pulled pet from the reveal field', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    advanceCinematic();
    const field = screen.getByRole('textbox', { name: /name your pet/i });
    fireEvent.change(field, { target: { value: 'Sparky' } });
    fireEvent.click(screen.getByRole('button', { name: /^name$/i }));
    const pulled = useGameStore.getState().lastPull!;
    expect(useGameStore.getState().pets.find((p) => p.id === pulled.id)!.name).toBe('Sparky');
    expect(screen.getByText('Sparky!')).toBeInTheDocument();
  });

  it('plays the hatch cinematic on pull, then shows the name card', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    // cinematic overlay first — name card not shown yet
    expect(screen.getByTestId('evolution-stage')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /name your pet/i })).toBeNull();
    advanceCinematic();
    expect(screen.getByRole('textbox', { name: /name your pet/i })).toBeInTheDocument();
  });

  it('plays pull SFX when the Pull button is clicked', () => {
    play.mockClear();
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    expect(play).toHaveBeenCalledWith('pull');
  });
});
