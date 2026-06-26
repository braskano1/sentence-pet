import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authValue: { loading: boolean; isAnonymous: boolean };
vi.mock('./auth/useAuth', () => ({ useAuth: () => authValue }));
// Stub the heavy children so we only test routing.
vi.mock('./components/menu/MainMenu', () => ({
  MainMenu: ({ onSignedUp }: { onSignedUp: () => void }) => <button onClick={onSignedUp}>MENU</button>,
}));
vi.mock('./components/menu/IntroVideo', () => ({
  IntroVideo: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>INTRO</button>,
}));
vi.mock('./App', () => ({ default: () => <div>GAME</div> }));

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

  it('signed-in shows the game', () => {
    authValue = { loading: false, isAnonymous: false };
    render(<PlayerRoot />);
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });

  it('after sign-up the intro plays, then the game when done', () => {
    authValue = { loading: false, isAnonymous: true };
    const { rerender } = render(<PlayerRoot />);
    fireEvent.click(screen.getByText('MENU'));     // onSignedUp → pendingIntro = true
    authValue = { loading: false, isAnonymous: false }; // auth flips after the link
    rerender(<PlayerRoot />);
    expect(screen.getByText('INTRO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('INTRO'));     // onDone → pendingIntro = false
    expect(screen.getByText('GAME')).toBeInTheDocument();
  });
});
