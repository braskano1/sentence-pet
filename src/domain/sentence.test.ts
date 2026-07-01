import { describe, it, expect } from 'vitest';
import { capitalizeFirst, renderSentence } from './sentence';

describe('capitalizeFirst', () => {
  it('uppercases the first letter', () => {
    expect(capitalizeFirst('he')).toBe('He');
  });
  it('leaves already-capital words unchanged', () => {
    expect(capitalizeFirst('I')).toBe('I');
    expect(capitalizeFirst('TV')).toBe('TV');
  });
  it('handles empty string', () => {
    expect(capitalizeFirst('')).toBe('');
  });
});

describe('renderSentence', () => {
  it('capitalizes the first word and appends a period', () => {
    expect(renderSentence(['he', 'eats'])).toBe('He eats.');
    expect(renderSentence(['they', 'watch', 'TV'])).toBe('They watch TV.');
  });
  it('keeps mid-sentence words as-is', () => {
    expect(renderSentence(['I', 'eat', 'rice'])).toBe('I eat rice.');
  });
  it('returns empty string for no words', () => {
    expect(renderSentence([])).toBe('');
  });
  it('uses the given end punctuation and capitalizes the first word', () => {
    expect(renderSentence(['do', 'you', 'like', 'fish'], '?')).toBe('Do you like fish?');
  });
  it('defaults to a period when endPunct is omitted', () => {
    expect(renderSentence(['he', 'eats'])).toBe('He eats.');
  });
});
