import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PetForm } from './PetForm';
import { BUILTIN_PET_DEFS } from '../../../domain/petDef';

const baseProps = () => ({
  allDefs: [...BUILTIN_PET_DEFS],
  onPatch: vi.fn(),
  onRename: vi.fn(),
  onSetStarter: vi.fn(),
});

describe('PetForm rarity override', () => {
  it('patches def.rarity when an override is chosen', () => {
    const props = baseProps();
    render(<PetForm def={BUILTIN_PET_DEFS[0]} {...props} />);
    fireEvent.change(screen.getByLabelText('rarity override'), { target: { value: 'epic' } });
    expect(props.onPatch).toHaveBeenCalledWith({ rarity: 'epic' });
  });

  it('clears the override to undefined when Default is chosen', () => {
    const props = baseProps();
    render(<PetForm def={{ ...BUILTIN_PET_DEFS[0], rarity: 'epic' }} {...props} />);
    fireEvent.change(screen.getByLabelText('rarity override'), { target: { value: '' } });
    expect(props.onPatch).toHaveBeenCalledWith({ rarity: undefined });
  });
});
