import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDrawer } from './ImportDrawer';

type Row = { id: string; v: number };
const existing: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];

function setup(parseFile: (f: File) => Promise<{ entities: Row[]; errors: string[] }>, onApply = vi.fn()) {
  const onClose = vi.fn();
  render(
    <ImportDrawer<Row>
      open
      title="Import rows"
      noun="row"
      existing={existing}
      getId={(r) => r.id}
      parseFile={parseFile}
      onApply={onApply}
      onClose={onClose}
      renderChange={(c) => <span>{c.id} v{c.incoming.v}</span>}
    />,
  );
  return { onApply, onClose };
}

function pickFile() {
  fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
}

describe('ImportDrawer', () => {
  it('previews an additive merge and applies the merged result', async () => {
    const parseFile = async () => ({ entities: [{ id: 'b', v: 9 }, { id: 'c', v: 3 }], errors: [] });
    const { onApply, onClose } = setup(parseFile);
    pickFile();
    await screen.findByText(/1 new/i);
    expect(screen.getByText(/1 updated/i)).toBeInTheDocument();
    expect(screen.getByText(/0 unchanged/i)).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: /apply 2 changes/i });
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 9 }, { id: 'c', v: 3 }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks apply and shows parse errors', async () => {
    const parseFile = async () => ({ entities: [], errors: ['No item rows found.'] });
    const { onApply } = setup(parseFile);
    pickFile();
    await screen.findByText(/no item rows found/i);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('disables apply when there are zero changes', async () => {
    const parseFile = async () => ({ entities: [{ id: 'a', v: 1 }], errors: [] }); // deep-equal to existing
    setup(parseFile);
    pickFile();
    await screen.findByText(/1 unchanged/i);
    expect(screen.getByRole('button', { name: /apply 0 changes/i })).toBeDisabled();
  });

  it('Cancel closes without applying', () => {
    const { onApply, onClose } = setup(async () => ({ entities: [], errors: [] }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ImportDrawer<Row>
        open={false}
        title="Import rows"
        noun="row"
        existing={existing}
        getId={(r) => r.id}
        parseFile={async () => ({ entities: [], errors: [] })}
        onApply={vi.fn()}
        onClose={vi.fn()}
        renderChange={() => null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
