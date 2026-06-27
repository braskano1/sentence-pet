import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from '../state/gameStore';
import { showL1 } from '../content/l1';
import { L1Toggle } from './L1Toggle';
import type { MatchingItem, MatchingPair } from '../data/types';

/**
 * Matching activity (Spec §5/§7). Drag each prompt tile (left = L2 prompt) into its
 * target slot (right = answer). Correct when EVERY prompt sits in its right slot.
 * Wrong placements CLEAR but correct ones stay (selective clear, mirroring drag-drop).
 * Per-pair Thai is shown under the prompt tile, gated by unit.l1Enabled + L1 toggle.
 */

/** Pure grader: assignment maps prompt(left) → chosen right. Wrong = assigned-but-mismatched. */
export function gradeMatching(pairs: MatchingPair[], assignment: Record<string, string | undefined>) {
  const wrong = pairs
    .filter((p) => assignment[p.left] !== undefined && assignment[p.left] !== p.right)
    .map((p) => p.left);
  const done = pairs.every((p) => assignment[p.left] === p.right);
  return { done, wrong };
}

export function MatchingScreen({ items, unit }: { items: MatchingItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const [index, setIndex] = useState(0);
  const [assignment, setAssignment] = useState<Record<string, string | undefined>>({});
  const [mistakes, setMistakes] = useState(0);
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to match.
  if (items.length === 0) return null;

  const item = items[index];

  function place(left: string, right: string) {
    const next = { ...assignment, [left]: right };
    const { done, wrong } = gradeMatching(item.pairs, next);
    if (wrong.length) {
      setMistakes((m) => m + 1);
      for (const w of wrong) next[w] = undefined; // clear wrong, keep correct
    }
    setAssignment(next);
    if (done) {
      if (index + 1 >= items.length) {
        finishRound({
          drill: 'mixed',
          level: item.level,
          stars: mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1,
          correctCount: items.length,
        });
      } else {
        setIndex(index + 1);
        setAssignment({});
        setMistakes(0);
      }
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveLeft(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveLeft(null);
    if (e.over) place(String(e.active.id), String(e.over.id));
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {unit.l1Enabled && (
        <div className="self-end">
          <L1Toggle />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex justify-around gap-4">
          <div className="flex flex-col gap-2">
            {item.pairs.map((p) => {
              const th = showL1(unit, l1Mode, p.l1);
              return assignment[p.left] === p.right ? null : (
                <PromptTile key={p.left} id={p.left} label={p.left} sub={th} />
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            {item.pairs.map((p) => (
              <TargetSlot
                key={p.right}
                id={p.right}
                label={p.right}
                filledBy={Object.entries(assignment).find(([, r]) => r === p.right)?.[0]}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeLeft ? (
            <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white shadow">
              {activeLeft}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function PromptTile({ id, label, sub }: { id: string; label: string; sub: string | null }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-bold"
    >
      {label}
      {sub && <span className="block text-xs text-slate-500">{sub}</span>}
    </button>
  );
}

function TargetSlot({ id, label, filledBy }: { id: string; label: string; filledBy?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`target-${id}`}
      className={`min-h-12 rounded-xl border-2 px-4 py-3 ${
        isOver
          ? 'border-emerald-500 bg-emerald-50'
          : filledBy
            ? 'border-emerald-400 bg-emerald-100'
            : 'border-dashed border-slate-300 bg-white'
      }`}
    >
      <span className="block text-xs opacity-70">{label}</span>
      {filledBy && <span className="font-bold">{filledBy}</span>}
    </div>
  );
}
