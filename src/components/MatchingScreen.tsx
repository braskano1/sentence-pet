import { useEffect, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from '../state/gameStore';
import { computeStars } from '../domain/scoring';
import { showL1 } from '../content/l1';
import { LessonShell } from './lesson/LessonShell';
import type { MatchingItem, MatchingPair } from '../data/types';

/**
 * Rolling-window cap: at most this many UNSOLVED pairs are shown at once, in original
 * order. As the learner matches one, it leaves the board and the next pair rolls in.
 * Items with ≤3 pairs are unaffected. Grading/completion still span ALL item.pairs.
 */
const MATCH_WINDOW = 3;

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
  const [solved, setSolved] = useState(false); // brief "Correct!" beat before advancing
  const [errorRight, setErrorRight] = useState<string | null>(null); // target just wrongly filled
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending timers on unmount.
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to match.
  if (items.length === 0) return null;

  const item = items[index];

  // Rolling window: the first MATCH_WINDOW still-unsolved pairs, in original order.
  // A pair is solved when its prompt sits in its own right slot. Solved pairs leave,
  // letting later pairs roll into view. Grading/completion below still span item.pairs.
  const activePairs = item.pairs.filter((p) => assignment[p.left] !== p.right).slice(0, MATCH_WINDOW);

  function place(left: string, right: string) {
    const next = { ...assignment, [left]: right };
    const { done, wrong } = gradeMatching(item.pairs, next);
    if (wrong.length) {
      setMistakes((m) => m + 1);
      for (const w of wrong) next[w] = undefined; // clear wrong, keep correct
      // Gentle-but-legible: flag the just-dropped target slot for a brief shake + rose
      // border, announced politely, then clear it ~600ms later.
      setErrorRight(right);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setErrorRight(null), 600);
    }
    setAssignment(next);
    if (done) {
      // Presentational beat: show "Correct! ✓" for ~700ms, THEN advance / finishRound.
      setSolved(true);
      advanceTimer.current = setTimeout(() => {
        if (index + 1 >= items.length) {
          finishRound({
            drill: 'mixed',
            kind: 'matching',
            level: item.level,
            stars: computeStars({ hints: 0, mistakes }),
            correctCount: items.length,
          });
        } else {
          setIndex(index + 1);
          setAssignment({});
          setMistakes(0);
          setSolved(false);
        }
      }, 700);
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
    <LessonShell title="Match the pairs" instruction="Drag each word to its match." index={index} total={items.length} l1={unit.l1Enabled}>
    <div className="relative flex flex-1 flex-col gap-4 p-6">
      {solved && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div
            role="status"
            className="rounded-2xl bg-emerald-500 px-8 py-4 text-2xl font-black text-white shadow-xl"
          >
            Correct! ✓
          </div>
        </div>
      )}
      {/* Gentle, legible wrong-placement signal for assistive tech (visual cue lives on the slot).
          Suppressed while the success beat is up so only one role="status" region is ever live. */}
      {errorRight && !solved && (
        <div role="status" aria-live="polite" className="text-center text-sm font-semibold text-rose-500">
          Try again
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex justify-around gap-4">
          <div className="flex flex-col gap-2">
            {activePairs.map((p) => {
              const th = showL1(unit, l1Mode, p.l1);
              return <PromptTile key={p.left} id={p.left} label={p.left} sub={th} />;
            })}
          </div>
          <div className="flex flex-col gap-2">
            {activePairs.map((p) => (
              <TargetSlot
                key={p.right}
                id={p.right}
                label={p.right}
                filledBy={Object.entries(assignment).find(([, r]) => r === p.right)?.[0]}
                error={errorRight === p.right}
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
    </LessonShell>
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

function TargetSlot({ id, label, filledBy, error }: { id: string; label: string; filledBy?: string; error?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`target-${id}`}
      className={`min-h-12 rounded-xl border-2 px-4 py-3 ${
        error
          ? 'shake-wrong border-rose-400 bg-rose-50'
          : isOver
            ? 'border-emerald-500 bg-emerald-50'
            : filledBy
              ? 'border-emerald-400 bg-emerald-100'
              : 'border-dashed border-slate-300 bg-white'
      }`}
    >
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      {filledBy && <span className="font-bold">{filledBy}</span>}
    </div>
  );
}
