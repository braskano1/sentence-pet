import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';
import { usePetDefs } from '../../state/usePetDefs';
import { importBosses } from '../../content/surfaceImport';
import {
  Card, SectionLabel, Field, TextInput, NumberInput, Select, Checkbox, Button,
  SearchableList, FilterChips, AssignList, ImportDrawer,
} from './ui';
import type { FilterChip } from './ui';
import type { ContentItem } from '../../data/types';
import { itemLabel, itemSearchText } from './poolTab/itemLabel';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

const SCOPE_CHIPS: readonly FilterChip<'all' | 'gated' | 'final'>[] = [
  { id: 'all', label: 'All' },
  { id: 'gated', label: 'Gated' },
  { id: 'final', label: 'Final' },
];
type ScopeFilter = (typeof SCOPE_CHIPS)[number]['id'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Boss/sprite/reward/reviews/pins editor for one node. After-unit is gated-only. */
function BossFields({ node, units, pool, onPatch }: {
  node: BossNode;
  units: { id: string; title?: string }[];
  pool: Record<string, ContentItem>;
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const petDefs = usePetDefs();
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  const poolItems = Object.values(pool);

  return (
    <div className="flex flex-col gap-3">
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
            {node.scope !== 'final' && (
              <Field label="After unit">
                <Select aria-label={`gate ${node.id} afterUnit`} value={node.afterUnitId ?? ''}
                  onChange={(e) => onPatch({ afterUnitId: e.target.value })}>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.title ?? u.id} ({u.id})</option>)}
                </Select>
              </Field>
            )}
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
      </div>

      <Card>
        <SectionLabel>Pinned items</SectionLabel>
        <AssignList
          items={poolItems}
          getKey={(it) => it.id}
          ariaLabel={(it) => `${labelPrefix} pins ${it.id}`}
          isSelected={(it) => pinned.includes(it.id)}
          onToggle={(it) => onPatch({ pinnedItemIds: pinned.includes(it.id) ? pinned.filter((x) => x !== it.id) : [...pinned, it.id] })}
          searchText={(it) => itemSearchText(it)}
          renderLabel={(it) => itemLabel(it)}
          placeholder="Search items by id…"
          emptyHint="No items in this course pool."
        />
      </Card>
    </div>
  );
}

async function defaultParseBossesFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importBosses(wb);
}

export function BossesTab({ course, onChange, parseBossesFile = defaultParseBossesFile }: {
  course: Course;
  onChange: (c: Course) => void;
  parseBossesFile?: (file: File) => Promise<{ entities: BossNode[]; errors: string[] }>;
}) {
  const list: BossNode[] = [...course.gates, ...(course.finalBoss ? [course.finalBoss] : [])];
  const petDefs = usePetDefs();
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [confirming, setConfirming] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => { setConfirming(false); }, [selectedId]);

  const filtered = scope === 'all' ? list : list.filter((n) => (scope === 'final' ? n.scope === 'final' : n.scope === 'gated'));
  const unitTitle = (id?: string) => course.units.find((u) => u.id === id)?.title ?? id ?? '—';
  const rewardName = (n: BossNode) => (n.rewardPetDefId ? petDefs.find((d) => d.id === n.rewardPetDefId)?.name ?? n.rewardPetDefId : 'random');

  function patchGate(id: string, patch: Partial<BossNode>) {
    onChange({ ...course, gates: course.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function patchFinal(patch: Partial<BossNode>) {
    const base: BossNode = course.finalBoss ?? {
      id: `${course.id}-final`, title: 'Final Boss', scope: 'final', reviewsUnitIds: [], reviewCount: 6,
      boss: emptyBoss(), onClear: 'completeCourse',
    };
    onChange({ ...course, finalBoss: { ...base, ...patch, scope: 'final', onClear: 'completeCourse' } });
  }
  function patchNode(node: BossNode, patch: Partial<BossNode>) {
    if (node.scope === 'final') patchFinal(patch); else patchGate(node.id, patch);
  }
  function addGate() {
    let n = 1;
    while (course.gates.some((g) => g.id === `gate-${n}`)) n++;
    const id = `gate-${n}`;
    const gate: BossNode = {
      id, title: `Gate ${n}`, scope: 'gated',
      afterUnitId: course.units[0]?.id, reviewsUnitIds: [], reviewCount: 5, boss: emptyBoss(),
    };
    onChange({ ...course, gates: [...course.gates, gate] });
    setSelectedId(id);
  }
  function addFinal() {
    patchFinal({});
    setSelectedId(`${course.id}-final`);
  }
  function deleteGate(id: string) {
    const rest = course.gates.filter((g) => g.id !== id);
    onChange({ ...course, gates: rest });
    setSelectedId((rest[0]?.id) ?? (course.finalBoss?.id ?? null));
    setConfirming(false);
  }
  function applyImport(merged: BossNode[]) {
    const gates = merged.filter((n) => n.scope !== 'final');
    const finalBoss = merged.find((n) => n.scope === 'final');
    onChange({ ...course, gates, ...(finalBoss ? { finalBoss } : {}) });
  }

  const selected = list.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
      </div>
      <div className="flex gap-4">
      <SearchableList
        items={filtered}
        total={list.length}
        countNoun="boss"
        getKey={(n) => n.id}
        selectedKey={selectedId}
        onSelect={setSelectedId}
        searchText={(n) => `${n.boss.name} ${n.id} ${n.scope}`}
        query={query}
        onQuery={setQuery}
        placeholder="Search bosses by name or id…"
        filterSlot={<FilterChips chips={SCOPE_CHIPS} active={scope} onChange={setScope} label="Filter by scope" />}
        footer={
          <div className="flex flex-col gap-2">
            <Button onClick={addGate} className="w-full">+ Add gate</Button>
            {!course.finalBoss && <Button variant="ghost" onClick={addFinal} className="w-full">+ Add final boss</Button>}
          </div>
        }
        renderRow={(n) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-slate-900">{n.boss.name}</span>
              <span className={`shrink-0 rounded px-1.5 text-[11px] font-semibold ${n.scope === 'final' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {n.scope === 'final' ? 'final' : n.id}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {n.scope === 'final'
                ? `completes course · ${n.boss.element}`
                : `after ${unitTitle(n.afterUnitId)} · ${n.boss.element} · reward: ${rewardName(n)}`}
            </span>
          </div>
        )}
      />

      <div className="flex-1">
        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800">{selected.boss.name}</h2>
              <span className="font-mono text-xs text-slate-400">{selected.scope === 'final' ? 'final' : selected.id}</span>
            </div>
            <BossFields node={selected} units={course.units} pool={course.pool} onPatch={(p) => patchNode(selected, p)} />
            {selected.scope !== 'final' && (
              confirming ? (
                <div className="flex gap-2">
                  <Button variant="danger" aria-label={`confirm delete gate ${selected.id}`} onClick={() => deleteGate(selected.id)}>Confirm delete</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete gate</Button>
              )
            )}
          </div>
        ) : (
          <Card><p className="text-slate-500">Add a gate or a final boss to begin.</p></Card>
        )}
      </div>
      </div>

      <ImportDrawer<BossNode>
        open={importing}
        title="Import bosses"
        noun="boss"
        existing={list}
        getId={(n) => n.id}
        parseFile={parseBossesFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{c.incoming.boss.name} <span className="text-slate-400">· {c.incoming.id} · {c.incoming.scope}</span></>}
      />
    </div>
  );
}
