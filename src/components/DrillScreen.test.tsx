// src/components/DrillScreen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// Make round feedback synchronous in tests: play immediately runs onDone.
vi.mock('./useRoundFeedback', () => ({
  useRoundFeedback: () => ({ feedback: null, locked: false, play: (_k: string, done: () => void) => done() }),
}));

const speech = vi.hoisted(() => ({
  speakWord: vi.fn(),
  speakThai: vi.fn(),
  speakSentence: vi.fn(),
}));
vi.mock('../hooks/useSpeech', () => ({ useSpeech: () => speech }));

const audio = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => audio }));

import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';
import { SEED } from '../content/seed';
import { itemsForDrill } from '../content/model';
import type { DrillItem } from '../data/types';

const ITEM: DrillItem = {
  id: 'i1', kind: 'dragdrop', drill: 'pattern' as const, level: 1, thaiHint: 'เธอให้อาหารแมว',
  slots: ['Subject', 'Verb', 'Object'],
  answer: ['She', 'feeds', 'the cat'],
  distractors: ['eats'],
};

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    const items = itemsForDrill(SEED, 'pattern', 1);
    render(<DrillScreen items={items} drill="pattern" level={1} />);
    expect(screen.getByText(items[0].thaiHint)).toBeInTheDocument();
    expect(screen.getAllByText('Subject').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('tap-places a tile into the current slot', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    expect(screen.getByTestId('slot-0')).toHaveTextContent('She');
  });

  it('plays the drop SFX when a tile is tap-placed', () => {
    audio.play.mockClear();
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    expect(audio.play).toHaveBeenCalledWith('drop');
  });

  it('on a wrong answer, clears only the wrong slot and shows the why-tip', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-eats'));
    fireEvent.click(screen.getByTestId('tile-the cat'));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByTestId('slot-0')).toHaveTextContent('She');
    expect(screen.getByTestId('slot-2')).toHaveTextContent('the cat');
    expect(screen.getByTestId('slot-1')).not.toHaveTextContent('eats');
    expect(screen.getByTestId('why-tip')).toBeInTheDocument();
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'pattern', 1)} drill="pattern" level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('word-choice tray includes the distractor tiles', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'wordChoice', 1)} drill="wordChoice" level={1} />);
    // first wordChoice L1 item: answer ['I','run'] + distractors ['runs','running']
    expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'running' })).toBeInTheDocument();
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen items={itemsForDrill(SEED, 'pattern', 2)} drill="pattern" level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });

  it('grammar tray includes the agreement trap tile', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />);
    // first grammar L1 item: answer ['he','eats'] + trap 'eat'
    expect(screen.getByRole('button', { name: 'eat' })).toBeInTheDocument();
  });

  it('mounts for grammar without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />
        </DndContext>,
      ),
    ).not.toThrow();
  });

  it('shows no Submit button until every slot is filled', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-feeds'));
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tile-the cat'));
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('does not speak the sentence or grade until Submit is tapped', () => {
    speech.speakSentence.mockClear();
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-feeds'));
    fireEvent.click(screen.getByTestId('tile-the cat'));
    expect(speech.speakSentence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(speech.speakSentence).toHaveBeenCalledTimes(1);
  });

  it('hides the Submit button again when a filled slot is cleared', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-feeds'));
    fireEvent.click(screen.getByTestId('tile-the cat'));
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('slot-0'));
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('on Submit with a wrong answer, grades (clears wrong slot, shows why-tip) but does not speak the sentence', () => {
    speech.speakSentence.mockClear();
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByTestId('tile-She'));
    fireEvent.click(screen.getByTestId('tile-eats'));
    fireEvent.click(screen.getByTestId('tile-the cat'));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByTestId('why-tip')).toBeInTheDocument();
    expect(screen.getByTestId('slot-1')).not.toHaveTextContent('eats');
    expect(speech.speakSentence).not.toHaveBeenCalled();
  });

  it('rejects a grammar near-miss: clears the verb slot and shows the trap tip', () => {
    // first grammar L1 item: answer ['he','eats'] + trap 'eat'
    render(<DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />);
    fireEvent.click(screen.getByTestId('tile-he'));
    fireEvent.click(screen.getByTestId('tile-eat')); // the agreement trap
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    // near-miss is rejected -> the wrong verb slot is cleared (retry)
    expect(screen.getByTestId('slot-1')).not.toHaveTextContent('eat');
    // and the trap's teaching tip is shown
    expect(screen.getByTestId('why-tip')).toHaveTextContent('เขา → he eats 👍');
  });

  it('exit ✕ opens a confirm; Stay keeps the drill mounted', () => {
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    expect(screen.getByText(/won't be saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stay/i }));
    expect(screen.queryByText(/won't be saved/i)).not.toBeInTheDocument();
    expect(useGameStore.getState().screen).not.toBe('pickDrill');
  });

  it('exit ✕ -> Leave returns to the journey map without finishing the round', () => {
    const finishSpy = vi.spyOn(useGameStore.getState(), 'finishRound');
    render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    fireEvent.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
    expect(finishSpy).not.toHaveBeenCalled();
  });
});
