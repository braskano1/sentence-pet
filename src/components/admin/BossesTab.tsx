import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';
import { usePetDefs } from '../../state/usePetDefs';
import { Card, SectionLabel } from './ui/Card';
import { Field } from './ui/Field';
import { TextInput } from './ui/TextInput';
import { NumberInput } from './ui/NumberInput';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Reusable review/boss fields shared by gated + final editors. */
function BossFields({ node, units, poolIds, onPatch }: {
  node: BossNode;
  units: { id: string; title?: string }[];
  poolIds: string[];
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const petDefs = usePetDefs();
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <SectionLabel>Boss</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <TextInput aria-label={`${labelPrefix} name`} value={node.boss.name}
              onChange={(e) => onPatch({ boss: { ...node.boss, name: e.target.value } })} />
          </Field>
          <Field label="Tier">
            <TextInput aria-label={`${labelPrefix} tierId`} value={node.boss.tierId}
              onChange={(e) => onPatch({ boss: { ...node.boss, tierId: e.target.value } })} />
          </Field>
          <Field label="Element">
            <Select aria-label={`${labelPrefix} element`} value={node.boss.element}
              onChange={(e) => onPatch({ boss: { ...node.boss, element: e.target.value as Species } })}>
              {SPECIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Sprite</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Sprite species">
            <Select aria-label={`${labelPrefix} sprite species`} value={node.boss.rivalSprite.species}
              onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, species: e.target.value as Species } } })}>
              {SPECIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Sprite stage">
            <Select aria-label={`${labelPrefix} sprite stage`} value={node.boss.rivalSprite.stage}
              onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, stage: e.target.value as Exclude<PetStage, 'egg'> } } })}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Reward</SectionLabel>
        <Field label="Reward pet" hint="Lists all pet defs — an authored reward may grant a non-gacha def.">
          <Select aria-label={`${labelPrefix} reward`} value={node.rewardPetDefId ?? ''}
            onChange={(e) => onPatch({ rewardPetDefId: e.target.value || undefined })}>
            <option value="">— none (random) —</option>
            {petDefs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </Card>

      <Card>
        <SectionLabel>Reviews</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Review count">
            <NumberInput aria-label={`${labelPrefix} reviewCount`} value={node.reviewCount ?? 0}
              onValueChange={(n) => { if (n !== null) onPatch({ reviewCount: n }); }} />
          </Field>
          <div className="flex flex-wrap gap-3">
            {units.map((u) => (
              <Checkbox key={u.id} label={u.title ?? u.id} aria-label={`${labelPrefix} reviews ${u.id}`}
                checked={reviews.includes(u.id)}
                onChange={() => onPatch({ reviewsUnitIds: reviews.includes(u.id) ? reviews.filter((x) => x !== u.id) : [...reviews, u.id] })} />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Pins</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {poolIds.map((id) => (
            <Checkbox key={id} label={id} aria-label={`${labelPrefix} pins ${id}`}
              checked={pinned.includes(id)}
              onChange={() => onPatch({ pinnedItemIds: pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id] })} />
          ))}
        </div>
      </Card>
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
    <div className="flex flex-col gap-6 text-sm">
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800">Gated bosses</h2>
          <Button onClick={addGate}>+ Add gate</Button>
        </div>
        <div className="flex flex-col gap-4">
          {course.gates.map((g) => (
            <div key={g.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-3">
                <strong className="text-slate-800">{g.id}</strong>
                <Field label="After unit">
                  <Select aria-label={`gate ${g.id} afterUnit`} value={g.afterUnitId ?? ''}
                    onChange={(e) => patchGate(g.id, { afterUnitId: e.target.value })}>
                    {course.units.map((u) => <option key={u.id} value={u.id}>{u.title} ({u.id})</option>)}
                  </Select>
                </Field>
                <Button variant="danger" aria-label={`delete gate ${g.id}`} onClick={() => deleteGate(g.id)}
                  className="ml-auto">Delete</Button>
              </div>
              <BossFields node={g} units={course.units} poolIds={poolIds} onPatch={(p) => patchGate(g.id, p)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Final boss</h2>
        {course.finalBoss
          ? <BossFields node={course.finalBoss} units={course.units} poolIds={poolIds} onPatch={patchFinal} />
          : <Button onClick={() => patchFinal({})}>+ Add final boss</Button>}
      </section>
    </div>
  );
}
