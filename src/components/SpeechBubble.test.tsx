import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SpeechBubble } from './SpeechBubble';

describe('SpeechBubble', () => {
  it('shows the speaker name and line', () => {
    const { getByText } = render(<SpeechBubble name="Bubble" line="I'm hungry!" />);
    expect(getByText('Bubble')).toBeTruthy();
    expect(getByText("I'm hungry!")).toBeTruthy();
  });
});
