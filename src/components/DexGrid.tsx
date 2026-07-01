import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGameStore } from '../state/gameStore';
import { usePetDefs } from '../state/usePetDefs';
import { spriteSrc } from '../config/sprites';
import { ELEMENT_EMOJI, PET_NAME, formatDexNo } from '../config/petDisplay';
import { SPECIES } from '../domain/species';
import {
  dexLines,
  latestUnlockedInChain,
  stageForChainPosition,
  chainCaughtCount,
  linesByGen,
} from '../domain/dex';
import { PressButton } from './PressButton';
import { PanViewport } from './journey/PanViewport';
import { DexDetail } from './DexDetail';
import type { PetDef, Species } from '../data/types';

type ProgressFilter = 'all' | 'caught' | 'missing';
type ElementFilter = 'all' | Species;

/** A dex line paired with its precomputed caught/total progress. */
interface DexRow {
  chain: PetDef[];
  root: PetDef;
  caught: number;
  total: number;
}

/**
 * The Dex: a player-facing collection browser for every evolution line, one card
 * per line. A fixed control header (count + element/progress filters) sits above
 * a drag-to-pan world (the Journey camera) of generation-sectioned line cards.
 * Card art is the latest stage the player has caught in that line; undiscovered
 * lines show the base-form silhouette.
 */
export function DexGrid() {
  const caughtDefIds = useGameStore(useShallow((s) => s.caughtDefIds));
  const caught = useMemo(() => new Set(caughtDefIds), [caughtDefIds]);
  const [selected, setSelected] = useState<PetDef | null>(null);
  const [element, setElement] = useState<ElementFilter>('all');
  const [progress, setProgress] = useState<ProgressFilter>('all');

  // Reactive catalog: re-renders when hydratePetDefs swaps the registry post-mount.
  const allDefs = usePetDefs();

  // One row per visible line (root enabled), with per-line progress precomputed.
  // Chains are walked over the full catalog so a disabled later stage doesn't
  // truncate shape; visibility gates on the root's enabled flag only.
  const rows = useMemo<DexRow[]>(
    () =>
      dexLines(allDefs)
        .filter((chain) => chain[0].enabled)
        .map((chain) => {
          const { caught: c, total } = chainCaughtCount(chain, caught);
          return { chain, root: chain[0], caught: c, total };
        }),
    [allDefs, caught],
  );

  // Header counts are over the full visible set (unaffected by the filters, so
  // the player always sees their true overall progress).
  const linesTotal = rows.length;
  const linesCaught = rows.filter((r) => r.caught > 0).length;
  const formsCaught = rows.reduce((n, r) => n + r.caught, 0);
  const formsTotal = rows.reduce((n, r) => n + r.total, 0);

  // Apply the element + progress filters to decide which cards render.
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (element !== 'all' && r.root.element !== element) return false;
        if (progress === 'caught' && r.caught === 0) return false;
        if (progress === 'missing' && r.caught > 0) return false;
        return true;
      }),
    [rows, element, progress],
  );

  const gens = useMemo(
    () => linesByGen(filtered.map((r) => r.chain)),
    [filtered],
  );

  // Per-line lookup so gen sections can reuse the precomputed progress.
  const rowByRootId = useMemo(() => {
    const m = new Map<string, DexRow>();
    for (const r of filtered) m.set(r.root.id, r);
    return m;
  }, [filtered]);

  // Focal node: first not-fully-caught visible line, else the first line. The id
  // encodes the active filters so the camera re-centers whenever they change.
  const focalId = useMemo(() => {
    const target = filtered.find((r) => r.caught < r.total) ?? filtered[0];
    return target ? `${element}:${progress}:${target.root.id}` : null;
  }, [filtered, element, progress]);

  const elementChips: ElementFilter[] = ['all', ...SPECIES];

  return (
    <div className="flex h-full flex-col bg-amber-50">
      {/* ── A) fixed control header (not pannable) ── */}
      <div className="shrink-0 border-b-2 border-amber-900/10 px-4 pb-2 pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-900/60">
          Caught {linesCaught} / {linesTotal} lines
          <span className="mx-1 text-amber-900/30">·</span>
          {formsCaught} / {formsTotal} forms
        </p>
        {linesCaught === 0 && (
          <p className="mt-0.5 text-[11px] font-semibold text-amber-900/50">
            Catch pets in battles and eggs to fill your Dex.
          </p>
        )}

        {/* element filter chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {elementChips.map((el) => {
            const active = element === el;
            const label = el === 'all' ? 'All' : PET_NAME[el];
            return (
              <PressButton
                key={el}
                aria-pressed={active}
                aria-label={el === 'all' ? 'All elements' : PET_NAME[el]}
                onClick={() => setElement(el)}
                className={`flex min-h-[40px] items-center gap-1 rounded-full px-3 text-sm font-bold ${
                  active
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-amber-900/10 text-amber-900/70'
                }`}
              >
                {el !== 'all' && <span aria-hidden="true">{ELEMENT_EMOJI[el]}</span>}
                {label}
              </PressButton>
            );
          })}
        </div>

        {/* progress segmented control */}
        <div
          role="group"
          aria-label="Filter by progress"
          className="mt-2 flex rounded-xl bg-amber-900/10 p-0.5 text-sm font-bold"
        >
          {(['all', 'caught', 'missing'] as ProgressFilter[]).map((p) => {
            const active = progress === p;
            return (
              <PressButton
                key={p}
                aria-pressed={active}
                onClick={() => setProgress(p)}
                className={`min-h-[40px] flex-1 rounded-lg px-2 capitalize ${
                  active ? 'bg-amber-200 text-amber-950 shadow-sm' : 'text-amber-900/60'
                }`}
              >
                {p}
              </PressButton>
            );
          })}
        </div>
      </div>

      {/* ── B) pannable world (reuse the Journey camera) ── */}
      <div className="relative flex-1">
        <PanViewport currentId={focalId} contentClassName="px-4 pb-10 pt-3">
          {gens.length === 0 ? (
            <EmptyState element={element} progress={progress} />
          ) : (
            gens.map(({ gen, lines }) => {
              const caughtInGen = lines.filter(
                (l) => (rowByRootId.get(l[0].id)?.caught ?? 0) > 0,
              ).length;
              return (
                <section key={gen} className="mb-5">
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-amber-900/70">
                    Gen {gen}
                    <span className="mx-1 text-amber-900/30">·</span>
                    {caughtInGen}/{lines.length}
                  </h3>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}
                  >
                    {lines.map((chain) => {
                      const row = rowByRootId.get(chain[0].id);
                      if (!row) return null;
                      return (
                        <LineCard
                          key={chain[0].id}
                          row={row}
                          focal={focalId?.endsWith(`:${chain[0].id}`) ?? false}
                          caught={caught}
                          onOpen={() => setSelected(chain[0])}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </PanViewport>
      </div>

      {selected && (
        <DexDetail def={selected} defs={allDefs} caught={caught} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** One evolution line: latest-caught art (or base silhouette) + dex#, name, X/N badge. */
function LineCard({
  row,
  focal,
  caught,
  onOpen,
}: {
  row: DexRow;
  focal: boolean;
  caught: ReadonlySet<string>;
  onOpen: () => void;
}) {
  const { chain, root } = row;
  const latest = latestUnlockedInChain(chain, caught);
  const shown = latest ?? { def: root, index: 0 };
  const stage = stageForChainPosition(shown.index, chain.length);
  const isCaught = latest !== null;
  const complete = row.caught === row.total && row.total > 0;

  return (
    <PressButton
      onClick={onOpen}
      data-current={focal ? 'true' : undefined}
      aria-label={
        isCaught
          ? shown.def.name
          : `Undiscovered ${PET_NAME[root.element]} ${formatDexNo(root.dexNo)}`
      }
      className="relative flex flex-col items-center rounded-xl bg-white/70 p-2"
    >
      {/* chain-progress badge: always shown; stronger amber when complete */}
      <span
        className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
          complete
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-amber-200/70 text-amber-800'
        }`}
      >
        {row.caught}/{row.total}
      </span>

      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-100/50">
        <img
          src={spriteSrc(shown.def.element, stage, 'happy', shown.def)}
          alt=""
          aria-hidden
          loading="lazy"
          onError={(e) => {
            // A bad sprite override must never leave a broken glyph: fall back to
            // the bundled element art (no def → SPRITES element sprite).
            const fallback = spriteSrc(shown.def.element, stage, 'happy');
            if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
          }}
          className="h-14 w-14 object-contain"
          style={isCaught ? undefined : { filter: 'brightness(0)' }}
        />
      </span>
      <span className="mt-0.5 text-[10px] font-bold text-amber-900/60">{formatDexNo(root.dexNo)}</span>
      <span className="text-[11px] font-extrabold text-amber-950">{isCaught ? shown.def.name : '???'}</span>
    </PressButton>
  );
}

/** Friendly centered copy when a filter yields no cards. Never a blank void. */
function EmptyState({ element, progress }: { element: ElementFilter; progress: ProgressFilter }) {
  const label = element === 'all' ? '' : `${ELEMENT_EMOJI[element]} ${PET_NAME[element]} `;
  let msg: string;
  if (progress === 'missing') msg = `No missing ${label}pets — all caught!`;
  else if (progress === 'caught') msg = `No ${label}pets caught yet`;
  else msg = `No ${label}pets in the Dex yet`;
  return (
    <div className="flex h-full min-h-[8rem] items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-amber-900/60">{msg}</p>
    </div>
  );
}
