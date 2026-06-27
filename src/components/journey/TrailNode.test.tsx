import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import { TrailNode } from './TrailNode';

const units = orderedUnits(SEED);
const u1 = units[0];
const u2 = units[1];
const patternLesson = u1.lessons[0];           // u1-pattern
const lockedLesson = u2.lessons[0];            // u2-pattern (locked at fresh state)

function renderNode(props: Partial<React.ComponentProps<typeof TrailNode>> = {}) {
  const onStart = vi.fn();
  render(
    <TrailNode
      units={units} unit={u1} lesson={patternLesson} stars={{}}
      index={0} isCurrent={false} onStart={onStart} {...props}
    />,
  );
  return onStart;
}

describe('TrailNode', () => {
  it('a cleared node still shows its food emoji (not just a check)', () => {
    renderNode({ stars: { 'u1-pattern': 3 } });
    const btn = screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i });
    expect(btn.textContent).toContain('🥩');
  });

  it('an open node starts its lesson on click', () => {
    const onStart = renderNode({ isCurrent: true });
    fireEvent.click(screen.getByRole('button', { name: /Basics: pattern lesson/i }));
    expect(onStart).toHaveBeenCalledWith('u1-pattern');
  });

  it('the current node shows a "you are here" beacon', () => {
    renderNode({ isCurrent: true });
    expect(screen.getByText(/you are here/i)).toBeInTheDocument();
  });

  it('a locked node is disabled', () => {
    render(
      <TrailNode units={units} unit={u2} lesson={lockedLesson} stars={{}}
        index={0} isCurrent={false} onStart={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Next Steps: pattern lesson, locked/i })).toBeDisabled();
  });
});
