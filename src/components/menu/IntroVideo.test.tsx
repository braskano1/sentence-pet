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

const { setZone } = vi.hoisted(() => ({ setZone: vi.fn() }));
vi.mock('../../hooks/useAudio', () => ({ useAudio: () => ({ setZone }) }));

import { IntroVideo } from './IntroVideo';

describe('IntroVideo', () => {
  it('stops music on mount (setZone(null)) so it does not clash with the video', () => {
    setZone.mockClear();
    render(<IntroVideo onDone={() => {}} />);
    expect(setZone).toHaveBeenCalledWith(null);
  });

  it('renders the placeholder while there is no real asset', () => {
    render(<IntroVideo onDone={() => {}} />);
    expect(screen.getByTestId('intro-placeholder')).toBeInTheDocument();
  });

  it('Skip calls onDone', () => {
    const onDone = vi.fn();
    render(<IntroVideo onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDone).toHaveBeenCalled();
  });
});
