import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// jsdom can't run framer-motion; render motion.* as plain elements (see App.test).
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const STRIP = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants', 'whileHover',
    'whileTap', 'whileFocus', 'whileInView', 'whileDrag', 'drag', 'layout',
    'layoutId', 'custom', 'onAnimationComplete', 'viewport',
  ]);
  const make = (tag: string) =>
    ({ children, ...rest }: Record<string, unknown> & { children?: ReactNode }) => {
      const dom: Record<string, unknown> = {};
      for (const k in rest) if (!STRIP.has(k)) dom[k] = rest[k];
      return React.createElement(tag, dom, children as ReactNode);
    };
  const motion = new Proxy({} as Record<string, ReturnType<typeof make>>, {
    get: (_t, tag) => make(String(tag)),
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    MotionConfig: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ linkEmail: vi.fn().mockResolvedValue(undefined), signIn: vi.fn().mockResolvedValue(undefined) }),
}));

const { setZone } = vi.hoisted(() => ({ setZone: vi.fn() }));
vi.mock('../../hooks/useAudio', () => ({ useAudio: () => ({ setZone }) }));

import { MainMenu } from './MainMenu';

const onPlayGuest = vi.fn();
function openChoose() {
  render(<MainMenu onSignedUp={() => {}} onPlayGuest={onPlayGuest} />);
  fireEvent.click(screen.getByRole('button', { name: /tap to start/i }));
}

describe('MainMenu', () => {
  it("arms the title music zone on mount", () => {
    setZone.mockClear();
    render(<MainMenu onSignedUp={() => {}} onPlayGuest={() => {}} />);
    expect(setZone).toHaveBeenCalledWith('title');
  });

  it('tapping the title reveals New Game and Continue', () => {
    openChoose();
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('New Game opens the sign-up form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & play/i })).toBeInTheDocument();
  });

  it('Continue opens the sign-in form', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('Back returns from a form to the choose screen', () => {
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
  });

  it('Play as guest fires onPlayGuest (enter the game without an account)', () => {
    onPlayGuest.mockClear();
    openChoose();
    fireEvent.click(screen.getByRole('button', { name: /play as guest/i }));
    expect(onPlayGuest).toHaveBeenCalled();
  });
});
