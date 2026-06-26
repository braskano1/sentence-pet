// src/domain/placement.ts

export interface PlacementState {
  placed: (string | null)[];
  used: boolean[];
}

export type DndId = { kind: 'tile' | 'slot'; index: number };

/** Parse a draggable/droppable id like "tile-3" or "slot-0". */
export function parseDndId(id: string): DndId | null {
  const m = /^(tile|slot)-(\d+)$/.exec(id);
  if (!m) return null;
  return { kind: m[1] as 'tile' | 'slot', index: Number(m[2]) };
}

/**
 * Place the tile at `tileIndex` into `slotIndex`.
 * No-op (returns the SAME state object) if the slot is filled or the tile is used,
 * so callers can detect "nothing changed" by reference equality.
 */
export function placeTile(
  state: PlacementState,
  tiles: string[],
  tileIndex: number,
  slotIndex: number,
): PlacementState {
  if (state.placed[slotIndex] !== null) return state;
  if (state.used[tileIndex]) return state;
  const placed = [...state.placed];
  const used = [...state.used];
  placed[slotIndex] = tiles[tileIndex];
  used[tileIndex] = true;
  return { placed, used };
}

/** Index of the leftmost empty slot, or -1 when the sentence is full. */
export function currentSlotIndex(placed: (string | null)[]): number {
  return placed.findIndex((p) => p === null);
}

/**
 * Tap-to-place: drop the tile at `tileIndex` into the current (leftmost empty) slot.
 * No-op (same ref) when full or the tile is used — mirrors placeTile's contract.
 */
export function tapPlace(state: PlacementState, tiles: string[], tileIndex: number): PlacementState {
  const slot = currentSlotIndex(state.placed);
  if (slot === -1) return state;
  return placeTile(state, tiles, tileIndex, slot);
}
