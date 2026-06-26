import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// framer-motion can't run in jsdom — render motion.* as plain elements.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const make = (tag: string) => ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
    const STRIP = new Set(['initial','animate','exit','transition','variants','whileHover','whileTap']);
    const dom: Record<string, unknown> = {};
    for (const k in rest) if (!STRIP.has(k)) dom[k] = rest[k];
    return React.createElement(tag, dom, children as React.ReactNode);
  };
  return {
    motion: new Proxy({}, { get: (_t, tag) => make(String(tag)) }),
    useAnimationControls: () => ({ start: () => {} }),
  };
});

import { DrillPet } from './DrillPet';

describe('DrillPet', () => {
  it('shows the active pet and a nudge line', () => {
    render(<DrillPet species="leaf" stage="baby" happiness={80} reaction="idle" line="Which verb? 👀" />);
    expect(screen.getByText(/which verb/i)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
