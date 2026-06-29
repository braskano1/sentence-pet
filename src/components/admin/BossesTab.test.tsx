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

describe('BossesTab import wiring', () => {
  it('merges imported bosses and splits gates vs finalBoss', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {},
      units: [{ id: 'u1', title: 'U1', emoji: '', order: 1, lessons: [] }],
      gates: [], finalBoss: undefined,
    } as unknown as import('../../content/course').Course;
    const parseBossesFile = async () => ({
      entities: [
        { id: 'g1', title: 'g1', scope: 'gated', afterUnitId: 'u1', boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } },
        { id: 'f', title: 'f', scope: 'final', onClear: 'completeCourse', boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } } },
      ] as unknown as import('../../content/course').BossNode[],
      errors: [],
    });
    render(<BossesTab course={course} onChange={onChange} parseBossesFile={parseBossesFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 2 changes/i }));
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(next.gates.map((g) => g.id)).toEqual(['g1']);
    expect(next.finalBoss?.id).toBe('f');
  });

  it('lets an imported final boss replace a pre-existing differently-id\'d final', async () => {
    const onChange = vi.fn();
    const existingFinal = { id: 'c1-final', title: 'Old', scope: 'final', onClear: 'completeCourse',
      boss: { tierId: 't', element: 'leaf', name: 'OldFinal', rivalSprite: { species: 'leaf', stage: 'adult' } } };
    const course = {
      id: 'c1', title: 'C1', pool: {},
      units: [{ id: 'u1', title: 'U1', emoji: '', order: 1, lessons: [] }],
      gates: [], finalBoss: existingFinal,
    } as unknown as import('../../content/course').Course;
    const parseBossesFile = async () => ({
      entities: [
        { id: 'other-final', title: 'New', scope: 'final', onClear: 'completeCourse',
          boss: { tierId: 't', element: 'fire', name: 'NewFinal', rivalSprite: { species: 'fire', stage: 'adult' } } },
      ] as unknown as import('../../content/course').BossNode[],
      errors: [],
    });
    render(<BossesTab course={course} onChange={onChange} parseBossesFile={parseBossesFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 1 change/i }));
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(next.finalBoss?.id).toBe('other-final'); // imported final wins, not silently dropped
  });
});
