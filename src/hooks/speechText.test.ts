import { describe, it, expect } from 'vitest';
import { normalizeSpeechWord } from './speechText';

describe('normalizeSpeechWord', () => {
  it('collapses upper+lower same letter to a single letter', () => {
    expect(normalizeSpeechWord('A a')).toBe('A');
    expect(normalizeSpeechWord('B b')).toBe('B');
    expect(normalizeSpeechWord('Z z')).toBe('Z');
  });

  it('keeps the first letter when order is lower+upper', () => {
    expect(normalizeSpeechWord('a A')).toBe('a');
  });

  it('leaves ordinary words unchanged', () => {
    expect(normalizeSpeechWord('dog')).toBe('dog');
  });

  it('leaves multi-word sentences unchanged', () => {
    expect(normalizeSpeechWord('the cat')).toBe('the cat');
  });

  it('leaves two different letters unchanged', () => {
    expect(normalizeSpeechWord('I O')).toBe('I O');
  });

  it('handles surrounding whitespace', () => {
    expect(normalizeSpeechWord('  B b  ')).toBe('B');
  });

  it('only collapses ASCII letters, not digits or symbols', () => {
    expect(normalizeSpeechWord('3 3')).toBe('3 3');
  });
});
