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

// Mutable intro config so we can exercise both the placeholder branch (no asset)
// and the real-video branch. Named imports are live bindings, so the getters are
// re-read on each render — flip `cfg.src` before rendering to switch branches.
const cfg = vi.hoisted(() => ({ src: '', webm: '', poster: '' }));
vi.mock('../../config/intro', () => ({
  get INTRO_VIDEO_SRC() { return cfg.src; },
  get INTRO_VIDEO_WEBM() { return cfg.webm; },
  get INTRO_VIDEO_POSTER() { return cfg.poster; },
}));

import { IntroVideo } from './IntroVideo';

describe('IntroVideo', () => {
  it('stops music on mount (setZone(null)) so it does not clash with the video', () => {
    cfg.src = '';
    setZone.mockClear();
    render(<IntroVideo onDone={() => {}} />);
    expect(setZone).toHaveBeenCalledWith(null);
  });

  it('renders the placeholder while there is no real asset', () => {
    cfg.src = '';
    render(<IntroVideo onDone={() => {}} />);
    expect(screen.getByTestId('intro-placeholder')).toBeInTheDocument();
  });

  it('renders the <video> (not the placeholder) once an asset is set', () => {
    cfg.src = '/intro.mp4';
    cfg.webm = '/intro.webm';
    cfg.poster = '/intro-poster.jpg';
    render(<IntroVideo onDone={() => {}} />);
    expect(screen.getByTestId('intro-video')).toBeInTheDocument();
    expect(screen.queryByTestId('intro-placeholder')).toBeNull();
  });

  it('onEnded fires onDone (clip finished)', () => {
    cfg.src = '/intro.mp4';
    const onDone = vi.fn();
    render(<IntroVideo onDone={onDone} />);
    fireEvent.ended(screen.getByTestId('intro-video'));
    expect(onDone).toHaveBeenCalled();
  });

  it('onError fires onDone so a failed load cannot trap the player on a black screen', () => {
    cfg.src = '/intro.mp4';
    const onDone = vi.fn();
    render(<IntroVideo onDone={onDone} />);
    fireEvent.error(screen.getByTestId('intro-video'));
    expect(onDone).toHaveBeenCalled();
  });

  it('Skip calls onDone', () => {
    cfg.src = '';
    const onDone = vi.fn();
    render(<IntroVideo onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDone).toHaveBeenCalled();
  });
});
