import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyTab } from './JourneyTab';
import type { ContentBundle } from '../../content/model';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function bundle(): ContentBundle {
  return {
    pool: { a: item('a'), b: item('b') },
    units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true },
    ]}],
  };
}

describe('JourneyTab', () => {
  it('renders units and their lessons', () => {
    render(<JourneyTab bundle={bundle()} onChange={() => {}} />);
    expect(screen.getByDisplayValue('One')).toBeInTheDocument();
    expect(screen.getByText('u1-l1')).toBeInTheDocument();
  });

  it('toggling an item id in the selected lesson calls onChange', () => {
    const onChange = vi.fn();
    render(<JourneyTab bundle={bundle()} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.click(screen.getByRole('checkbox', { name: /item b/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ContentBundle;
    expect(next.units[0].lessons[0].itemIds).toContain('b');
  });
});
