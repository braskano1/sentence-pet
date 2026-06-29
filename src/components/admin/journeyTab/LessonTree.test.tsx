import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonTree } from './LessonTree';
import type { Unit } from '../../../content/model';

const units: Unit[] = [
  { id: 'u1', title: 'Greetings', emoji: '👋', order: 1, lessons: [
    { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: [] },
    { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: [], isCheckpoint: true },
  ] },
  { id: 'u2', title: 'Ordering', emoji: '🍜', order: 2, lessons: [
    { id: 'u2-l1', drill: 'pattern', level: 1, itemIds: [] },
  ] },
];

function setup(sel: { type: 'unit' | 'lesson'; id: string } | null = null) {
  const onSelect = vi.fn();
  const onAddUnit = vi.fn();
  const onAddLesson = vi.fn();
  render(
    <LessonTree units={units} selected={sel} onSelect={onSelect}
      onAddUnit={onAddUnit} onAddLesson={onAddLesson} />,
  );
  return { onSelect, onAddUnit, onAddLesson };
}

describe('LessonTree', () => {
  it('renders unit headers and lesson rows', () => {
    setup();
    expect(screen.getByRole('button', { name: /Greetings/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u1-l1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u2-l1' })).toBeInTheDocument();
  });

  it('selects a unit when its header is clicked', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Greetings/ }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'unit', id: 'u1' });
  });

  it('selects a lesson when its row is clicked', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'u1-l1' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'lesson', id: 'u1-l1' });
  });

  it('filters to checkpoint lessons when the Checkpoints chip is active', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /checkpoints/i }));
    expect(screen.getByRole('button', { name: 'u1-cp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'u1-l1' })).toBeNull();
  });

  it('filters lessons by the search query', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'u2-l1' } });
    expect(screen.getByRole('button', { name: 'u2-l1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'u1-l1' })).toBeNull();
  });

  it('fires onAddUnit and onAddLesson', () => {
    const { onAddUnit, onAddLesson } = setup();
    fireEvent.click(screen.getByRole('button', { name: /\+ unit/i }));
    fireEvent.click(screen.getByRole('button', { name: /add lesson/i }));
    expect(onAddUnit).toHaveBeenCalled();
    expect(onAddLesson).toHaveBeenCalled();
  });
});
