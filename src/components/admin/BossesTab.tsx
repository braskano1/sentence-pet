import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Reusable review/boss fields shared by gated + final editors. */
function BossFields({ node, units, poolIds, onPatch }: {
  node: BossNode;
  units: { id: string }[];
  poolIds: string[];
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  return (
    <div className="flex flex-col gap-1">
      <label>name
        <input className="border px-1" aria-label={`${labelPrefix} name`} value={node.boss.name}
          onChange={(e) => onPatch({ boss: { ...node.boss, name: e.target.value } })} />
      </label>
      <label>tierId
        <input className="border px-1" aria-label={`${labelPrefix} tierId`} value={node.boss.tierId}
          onChange={(e) => onPatch({ boss: { ...node.boss, tierId: e.target.value } })} />
      </label>
      <label>element
        <select className="border px-1" aria-label={`${labelPrefix} element`} value={node.boss.element}
          onChange={(e) => onPatch({ boss: { ...node.boss, element: e.target.value as Species } })}>
          {SPECIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>sprite species
        <select className="border px-1" aria-label={`${labelPrefix} sprite species`} value={node.boss.rivalSprite.species}
          onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, species: e.target.value as Species } } })}>
          {SPECIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>sprite stage
        <select className="border px-1" aria-label={`${labelPrefix} sprite stage`} value={node.boss.rivalSprite.stage}
          onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, stage: e.target.value as Exclude<PetStage, 'egg'> } } })}>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>reviewCount
        <input type="number" className="w-16 border px-1" aria-label={`${labelPrefix} reviewCount`} value={node.reviewCount ?? 0}
          onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch({ reviewCount: n }); }} />
      </label>
      <fieldset className="border p-1"><legend>reviews units</legend>
        {units.map((u) => (
          <label key={u.id} className="mr-2">
            <input type="checkbox" aria-label={`${labelPrefix} reviews ${u.id}`} checked={reviews.includes(u.id)}
              onChange={() => onPatch({ reviewsUnitIds: reviews.includes(u.id) ? reviews.filter((x) => x !== u.id) : [...reviews, u.id] })} /> {u.id}
          </label>
        ))}
      </fieldset>
      <fieldset className="border p-1"><legend>pinned items</legend>
        {poolIds.map((id) => (
          <label key={id} className="mr-2">
            <input type="checkbox" aria-label={`${labelPrefix} pins ${id}`} checked={pinned.includes(id)}
              onChange={() => onPatch({ pinnedItemIds: pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id] })} /> {id}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const poolIds = Object.keys(course.pool);

  function patchGate(id: string, patch: Partial<BossNode>) {
    onChange({ ...course, gates: course.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function addGate() {
    let n = 1;
    while (course.gates.some((g) => g.id === `gate-${n}`)) n++;
    const gate: BossNode = {
      id: `gate-${n}`, title: `Gate ${n}`, scope: 'gated',
      afterUnitId: course.units[0]?.id, reviewsUnitIds: [], reviewCount: 5, boss: emptyBoss(),
    };
    onChange({ ...course, gates: [...course.gates, gate] });
  }
  function deleteGate(id: string) {
    onChange({ ...course, gates: course.gates.filter((g) => g.id !== id) });
  }
  function patchFinal(patch: Partial<BossNode>) {
    const base: BossNode = course.finalBoss ?? {
      id: `${course.id}-final`, title: 'Final Boss', scope: 'final', reviewsUnitIds: [], reviewCount: 6,
      boss: emptyBoss(), onClear: 'completeCourse',
    };
    onChange({ ...course, finalBoss: { ...base, ...patch, scope: 'final', onClear: 'completeCourse' } });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Gated bosses</h2>
          <button type="button" onClick={addGate} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add gate</button>
        </div>
        {course.gates.map((g) => (
          <div key={g.id} className="mt-2 rounded border p-2">
            <div className="flex items-center gap-2">
              <strong>{g.id}</strong>
              <label>afterUnit
                <select className="border px-1" aria-label={`gate ${g.id} afterUnit`} value={g.afterUnitId ?? ''}
                  onChange={(e) => patchGate(g.id, { afterUnitId: e.target.value })}>
                  {course.units.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
                </select>
              </label>
              <button type="button" aria-label={`delete gate ${g.id}`} onClick={() => deleteGate(g.id)}
                className="text-red-600">Delete</button>
            </div>
            <BossFields node={g} units={course.units} poolIds={poolIds} onPatch={(p) => patchGate(g.id, p)} />
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Final boss</h2>
        <div className="mt-2 rounded border p-2">
          {course.finalBoss
            ? <BossFields node={course.finalBoss} units={course.units} poolIds={poolIds} onPatch={patchFinal} />
            : <button type="button" onClick={() => patchFinal({})} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add final boss</button>}
        </div>
      </section>
    </div>
  );
}
