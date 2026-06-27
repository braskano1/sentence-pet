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

  it('per-channel mute toggle updates the store', async () => {
    render(<SettingsSheet onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sfx mute/i }));
    expect(useGameStore.getState().audio.sfx.muted).toBe(true);
  });

  it('muting a channel disables (greys) its own slider', () => {
    useGameStore.setState((s) => ({ audio: { ...s.audio, sfx: { ...s.audio.sfx, muted: true } } }));
    render(<SettingsSheet onClose={() => {}} />);
    expect(screen.getByLabelText(/sfx volume/i)).toBeDisabled();
    // a sibling channel that is not muted stays enabled
    expect(screen.getByLabelText(/music volume/i)).not.toBeDisabled();
  });

  it('muting Master disables the SFX/Music/Voice sliders', () => {
    useGameStore.setState((s) => ({ audio: { ...s.audio, master: { ...s.audio.master, muted: true } } }));
    render(<SettingsSheet onClose={() => {}} />);
    expect(screen.getByLabelText(/sfx volume/i)).toBeDisabled();
    expect(screen.getByLabelText(/music volume/i)).toBeDisabled();
    expect(screen.getByLabelText(/voice volume/i)).toBeDisabled();
    // Master's own slider greys too (via its own mute)
    expect(screen.getByLabelText(/master volume/i)).toBeDisabled();
  });
});
