import type { PetDef, Species } from '../data/types';

/** A stored/cached pet-def that may predate v2 (missing gen/dexNo/types). */
export type RawPetDef = Partial<PetDef> & { id: string; element: Species };

/** Backfill v2 fields on pre-v2 pet-defs so an older stored/cached catalog
 *  validates and loads instead of being rejected to the built-ins. Deterministic:
 *  gen 1, dexNo by array order, types from the def's element. Already-set fields win.
 *  A def that survives backfill but is still structurally invalid (e.g. missing statBands,
 *  or a mixed catalog where index-based dexNo fill collides with an explicit dexNo) is
 *  rejected downstream by validatePetDefs — backfill is a best-effort rescue of
 *  missing-v2-fields only, not a validator. The `as PetDef[]` cast reflects this: backfill
 *  guarantees only the three v2 fields, and validatePetDefs is the safety net for the rest. */
export function backfillPetDefs(raw: readonly RawPetDef[]): PetDef[] {
  return raw.map((d, i) => ({
    ...d,
    gen: typeof d.gen === 'number' ? d.gen : 1,
    dexNo: typeof d.dexNo === 'number' ? d.dexNo : i + 1,
    types: Array.isArray(d.types) && d.types.length > 0 ? d.types : [d.element],
  })) as PetDef[];
}
