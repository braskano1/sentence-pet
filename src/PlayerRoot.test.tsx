import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { loading: boolean; isAnonymous: boolean };
vi.mock('./auth/useAuth', () => ({ useAuth: () => authValue }));
// Stub the heavy children so we only test routing.
vi.mock('./components/menu/MainMenu', () => ({
  MainMenu: ({ onSignedUp, onPlayGuest }: { onSignedUp: () => void; onPlayGuest: () => void }) => (
    <div>
      <button onClick={onSignedUp}>MENU</button>
      <button onClick={onPlayGuest}>PLAY_GUEST</button>
    </div>
  ),
}));
vi.mock('./components/menu/IntroVideo', () => ({
  IntroVideo: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>INTRO</button>,
}));
vi.mock('./App', () => ({
  default: ({ onExitToMenu }: { onExitToMenu?: () => void }) => (
    <div>GAME<button onClick={() => onExitToMenu?.()}>EXIT</button></div>
  ),
}));
vi.mock('./components/DevPanel', () => ({ DevPanel: () => <div>DEVPANEL</div> }));

import { PlayerRoot } from './PlayerRoot';

describe('PlayerRoot routing', () => {
  it('loading shows neither menu nor game', () => {
    authValue = { loading: true, isAnonymous: false };
    render(<PlayerRoot />);
    expect(screen.queryByText('MENU')).toBeNull();
    expect(screen.queryByText('GAME')).toBeNull();
  });

  it('anonymous shows the MainMenu', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    expect(screen.getByText('MENU')).toBeInTheDocument();
  });

  it('renders the DevPanel on the signed-out menu too (reachable before sign-in)', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    expect(screen.getByText('MENU')).toBeInTheDocument();
    expect(screen.getByText('DEVPANEL')).toBeInTheDocument();
  });

  it('signed-in shows the game', () => {
    authValue = { loading: false, isAnonymous: false };
    render(<PlayerRoot />);
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });

  it('after sign-up the intro plays, then the game when done', () => {
    authValue = { loading: false, isAnonymous: true };
    const { rerender } = render(<PlayerRoot />);
    fireEvent.click(screen.getByText('MENU'));     // onSignedUp → pendingIntro = true
    // Mid-flip: pendingIntro is true but isAnonymous hasn't flipped yet — must NOT flash MainMenu.
    expect(screen.queryByText('MENU')).toBeNull();
    expect(screen.getByText('INTRO')).toBeInTheDocument();
    authValue = { loading: false, isAnonymous: false }; // auth flips after the link
    rerender(<PlayerRoot />);
    expect(screen.getByText('INTRO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('INTRO'));     // onDone → pendingIntro = false
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });

  it('Play as guest plays the intro first, then the game (still anonymous)', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    fireEvent.click(screen.getByText('PLAY_GUEST'));   // guestPlay = true + pendingIntro = true
    expect(screen.queryByText('MENU')).toBeNull();
    expect(screen.getByText('INTRO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('INTRO'));         // onDone → intro ends
    expect(screen.getByText('GAME')).toBeInTheDocument(); // anon + guestPlay → GAME, not MENU
  });

  it('guest Exit to menu clears guestPlay and returns to the menu', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    fireEvent.click(screen.getByText('PLAY_GUEST'));
    fireEvent.click(screen.getByText('INTRO'));         // now in GAME as guest
    fireEvent.click(screen.getByText('EXIT'));          // onExitToMenu → guestPlay = false
    expect(screen.getByText('MENU')).toBeInTheDocument();
    expect(screen.queryByText('GAME')).toBeNull();
  });

  it('a fresh anonymous user who has not chosen still sees the menu', () => {
    authValue = { loading: false, isAnonymous: true };
    render(<PlayerRoot />);
    expect(screen.getByText('MENU')).toBeInTheDocument();
    expect(screen.queryByText('GAME')).toBeNull();
  });
});
