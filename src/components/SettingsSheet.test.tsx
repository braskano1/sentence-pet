import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import { SettingsSheet } from './SettingsSheet';

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

beforeEach(() => useGameStore.setState({ audio: defaultAudioSettings() }));

describe('SettingsSheet', () => {
  it('renders the four channel sliders', () => {
    render(<SettingsSheet onClose={() => {}} />);
    expect(screen.getByLabelText(/master volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sfx volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/music volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice volume/i)).toBeInTheDocument();
  });

  it('moving the SFX slider updates the store', () => {
    render(<SettingsSheet onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/sfx volume/i), { target: { value: '0.5' } });
    expect(useGameStore.getState().audio.sfx.level).toBeCloseTo(0.5);
  });

  it('mute-all toggles the store flag', async () => {
    render(<SettingsSheet onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /mute all/i }));
    expect(useGameStore.getState().audio.allMuted).toBe(true);
  });

  it('per-channel mute toggle updates the store', async () => {
    render(<SettingsSheet onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sfx mute/i }));
    expect(useGameStore.getState().audio.sfx.muted).toBe(true);
  });
});
