import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import { SettingsSheet } from './SettingsSheet';

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

let authValue: {
  isAnonymous: boolean;
  user: { email: string | null } | null;
  signOut: () => void;
  linkEmail: (e: string, p: string) => Promise<void>;
};
vi.mock('../auth/useAuth', () => ({ useAuth: () => authValue }));

beforeEach(() => {
  authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut: vi.fn(), linkEmail: vi.fn().mockResolvedValue(undefined) };
});

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

describe('SettingsSheet — Account section', () => {
  it('a real user sees their email and a sign-out that also exits to menu', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const onExitToMenu = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut, linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={onExitToMenu} />);
    expect(screen.getByText(/k@s\.th/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
    expect(onExitToMenu).toHaveBeenCalled();
  });

  it('a failed sign-out shows an error and does NOT exit to menu', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('network'));
    const onExitToMenu = vi.fn();
    authValue = { isAnonymous: false, user: { email: 'k@s.th' }, signOut, linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={onExitToMenu} />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't sign out/i);
    expect(onExitToMenu).not.toHaveBeenCalled();
  });

  it('a guest sees Save your progress and Exit to menu (no email, no sign-out)', () => {
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={() => {}} />);
    expect(screen.getByRole('button', { name: /save your progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exit to menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
  });

  it('guest Save your progress opens the sign-up form', () => {
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /save your progress/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & play/i })).toBeInTheDocument();
  });

  it('guest Exit to menu calls onExitToMenu', () => {
    const onExitToMenu = vi.fn();
    authValue = { isAnonymous: true, user: null, signOut: vi.fn(), linkEmail: vi.fn() };
    render(<SettingsSheet onClose={() => {}} onExitToMenu={onExitToMenu} />);
    fireEvent.click(screen.getByRole('button', { name: /exit to menu/i }));
    expect(onExitToMenu).toHaveBeenCalled();
  });

  it('Replay intro fires the callback', () => {
    const onReplayIntro = vi.fn();
    render(<SettingsSheet onClose={() => {}} onReplayIntro={onReplayIntro} onExitToMenu={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /replay intro/i }));
    expect(onReplayIntro).toHaveBeenCalled();
  });
});
