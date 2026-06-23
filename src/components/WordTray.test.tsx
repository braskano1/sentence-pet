import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordTray } from './WordTray';

describe('WordTray', () => {
  it('renders tiles and fires onPickWord with the tapped word', async () => {
    const onPick = vi.fn();
    render(<WordTray tiles={['I', 'run']} onPickWord={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'run' }));
    expect(onPick).toHaveBeenCalledWith('run');
  });
});
