import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntroVideo } from './IntroVideo';

describe('IntroVideo', () => {
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
