import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BossesTab } from './BossesTab';
import type { Course } from '../../content/course';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../../domain/petDef';

function course(): Course {
  return {
    id: 'c', title: 'C', gates: [],
    pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
    units: [
      { id: 'u1', title: 'One', emoji: '🐣', order: 1, l1Enabled: false,
        lessons: [{ id: 'u1-cp', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true }] },
      { id: 'u2', title: 'Two', emoji: '🌱', order: 2, l1Enabled: false,
        lessons: [{ id: 'u2-cp', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true }] },
    ],
    finalBoss: { id: 'fb', title: 'Final', scope: 'final', reviewsUnitIds: ['u1'], reviewCount: 3,
      boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } }, onClear: 'completeCourse' },
  };
}

describe('BossesTab', () => {
  it('adds a gated boss with scope gated', () => {
    const onChange = vi.fn();
    render(<BossesTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add gate/i }));
    const next: Course = onChange.mock.calls.at(-1)![0];
    expect(next.gates).toHaveLength(1);
    expect(next.gates[0].scope).toBe('gated');
  });

  it('deletes a gated boss via confirm', () => {
    const onChange = vi.fn();
    const c = course();
    c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
      boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
    render(<BossesTab course={c} onChange={onChange} />);
    // g1 is the first row, selected by default → its editor is shown.
    fireEvent.click(screen.getByRole('button', { name: /delete gate/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(onChange.mock.calls.at(-1)![0].gates).toHaveLength(0);
  });

  it('edits the final boss name', () => {
    const onChange = vi.fn();
    render(<BossesTab course={course()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/final boss name/i), { target: { value: 'Champion' } });
    expect(onChange.mock.calls.at(-1)![0].finalBoss.boss.name).toBe('Champion');
  });

  describe('reward pet dropdown', () => {
    beforeEach(() => { setActivePetDefs([...BUILTIN_PET_DEFS]); });
    afterEach(() => { setActivePetDefs([...BUILTIN_PET_DEFS]); });

    it('sets rewardPetDefId on the final boss via the dropdown', () => {
      const onChange = vi.fn();
      render(<BossesTab course={course()} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(/final boss reward/i),
        { target: { value: BUILTIN_PET_DEFS[0].id } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        finalBoss: expect.objectContaining({ rewardPetDefId: BUILTIN_PET_DEFS[0].id }),
      }));
    });

    it('clears rewardPetDefId when the none option is chosen', () => {
      const onChange = vi.fn();
      const c = course();
      c.finalBoss!.rewardPetDefId = BUILTIN_PET_DEFS[0].id;
      render(<BossesTab course={c} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(/final boss reward/i), { target: { value: '' } });
      const next: Course = onChange.mock.calls.at(-1)![0];
      expect(next.finalBoss!.rewardPetDefId).toBeUndefined();
    });

    it('sets rewardPetDefId on a gated boss via the dropdown', () => {
      const onChange = vi.fn();
      const c = course();
      c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
        boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
      render(<BossesTab course={c} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(/gate g1 reward/i),
        { target: { value: BUILTIN_PET_DEFS[1].id } });
      const next: Course = onChange.mock.calls.at(-1)![0];
      expect(next.gates[0].rewardPetDefId).toBe(BUILTIN_PET_DEFS[1].id);
    });
  });

  describe('label contract (P3)', () => {
    it('renders friendly visible labels, not raw selector strings', () => {
      render(<BossesTab course={course()} onChange={vi.fn()} />);
      // friendly visible text present
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('Tier')).toBeTruthy();
      expect(screen.getByText('Reward pet')).toBeTruthy();
      expect(screen.getByText('Review count')).toBeTruthy();
      // leaky raw strings no longer rendered as visible text
      expect(screen.queryByText('final boss name')).toBeNull();
      expect(screen.queryByText('final boss reward')).toBeNull();
      expect(screen.queryByText('final boss reviewCount')).toBeNull();
    });

    it('keeps selector strings reachable as accessible names', () => {
      render(<BossesTab course={course()} onChange={vi.fn()} />);
      expect(screen.getByLabelText(/final boss name/i)).toBeTruthy();
      expect(screen.getByLabelText(/final boss reward/i)).toBeTruthy();
      expect(screen.getByLabelText(/final boss tierId/i)).toBeTruthy();
    });

    it('shows the gate-row After unit with friendly label', () => {
      const c = course();
      c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
        boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
      render(<BossesTab course={c} onChange={vi.fn()} />);
      expect(screen.getByText('After unit')).toBeTruthy();
      expect(screen.getByLabelText(/gate g1 afterUnit/i)).toBeTruthy();
    });
  });
});
