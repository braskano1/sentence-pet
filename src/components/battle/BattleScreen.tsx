import { useEffect, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from '../../state/gameStore';
import { useBattleStore } from '../../state/battleStore';
import { useContentStore } from '../../content/store';
import { findLesson, itemsForLesson, trayWords } from '../../content/model';
import { isDragDrop } from '../../data/types';
import { shuffle, isPlacementCorrect } from '../../domain/check';
import { parseDndId, placeTile, tapPlace } from '../../domain/placement';
import { SentenceSlots } from '../SentenceSlots';
import { WordTray } from '../WordTray';
import { PressButton } from '../PressButton';
import { BossZone } from './BossZone';
import { HpBar } from './HpBar';
import { DamageNumber } from './DamageNumber';
import { BossIntro } from './BossIntro';
import { DodgeSwipe } from './DodgeSwipe';
import { SpellOverlay } from './SpellOverlay';
import { getSfx } from '../../effects/sfx';
import { loadBattleSfx } from '../../effects/loadBattleSfx';
import { petStageSprite, petDisplayName } from '../../config/petDisplay';

export function BattleScreen() {
  const lessonId = useGameStore((s) => s.currentBossLessonId);
  const finishBoss = useGameStore((s) => s.finishBoss);
  const setScreen = useGameStore((s) => s.setScreen);
  const bundle = useContentStore((s) => s.bundle);
  const lesson = lessonId ? findLesson(bundle, lessonId)?.lesson : undefined;
  // The battle engine is dragdrop-only; narrow the widened pool to dragdrop items.
  const items = lesson ? itemsForLesson(bundle, lesson).filter(isDragDrop) : [];

  const snapshot = useBattleStore((s) => s.snapshot);
  const boss = useBattleStore((s) => s.boss);
  const pet = useBattleStore((s) => s.pet);
  const onCorrect = useBattleStore((s) => s.onCorrect);
  const onWrong = useBattleStore((s) => s.onWrong);
  const lastEvent = useBattleStore((s) => s.lastEvent);
  const begin = useBattleStore((s) => s.begin);
  const battlePhase = useBattleStore((s) => s.battlePhase);
  const resolveSwipe = useBattleStore((s) => s.resolveSwipe);
  const phaseIndex = useBattleStore((s) => s.phaseIndex);
  const spell = useBattleStore((s) => s.spell);
  const resolveSpell = useBattleStore((s) => s.resolveSpell);

  const [intro, setIntro] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => (items[0]?.slots.map(() => null) ?? []));
  const [tiles, setTiles] = useState<string[]>(() => (items[0] ? shuffle(trayWords(items[0])) : []));
  const [used, setUsed] = useState<boolean[]>(() => (items[0] ? trayWords(items[0]).map(() => false) : []));
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [dmgKey, setDmgKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => { void loadBattleSfx(); }, []);

  useEffect(() => {
    if (!snapshot || !boss || !pet) setScreen('pickDrill');
  }, [snapshot, boss, pet, setScreen]);

  useEffect(() => {
    if (snapshot?.outcome === 'win') {
      finishBoss(true);
      useBattleStore.getState().reset();
    }
  }, [snapshot?.outcome, finishBoss]);

  useEffect(() => {
    if (intro || snapshot?.outcome) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      if (useBattleStore.getState().battlePhase === 'answering') {
        useBattleStore.getState().tickCharge(dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [intro, snapshot?.outcome]);

  const prevPhase = useRef(phaseIndex);
  const [enrageKey, setEnrageKey] = useState(0);
  useEffect(() => {
    if (phaseIndex > prevPhase.current) {
      setEnrageKey((k) => k + 1);
      getSfx().play('enrage', 0.5);
    }
    // Always sync — also captures begin()'s reset to 0 on a soft retry, so the
    // next cross on the retried run fires enrage again (BattleScreen doesn't unmount).
    prevPhase.current = phaseIndex;
  }, [phaseIndex]);

  useEffect(() => {
    if (!lastEvent) return;
    const map: Partial<Record<'playerHit'|'bossHit'|'chargedHit'|'dodge'|'miss'|'bossCharge'|'spellBreak', [import('../../effects/sfx').SfxName, number]>> = {
      playerHit: ['hit', 0.5],
      bossHit: ['bossHit', 0.5],
      chargedHit: ['bossHit', 0.5],
      dodge: ['dodge', 0.5],
      miss: ['fizzle', 0.5],
      bossCharge: ['bossCharge', 0.4],
      spellBreak: ['crit', 0.5],
    };
    const entry = map[lastEvent.kind];
    if (entry) getSfx().play(entry[0], entry[1]);
    if (lastEvent.kind === 'playerHit' && lastEvent.crit) getSfx().play('crit', 0.5);
  }, [lastEvent]);

  if (!snapshot || !boss || !pet || items.length === 0) return null;
  if (intro) return <BossIntro boss={boss} onDone={() => setIntro(false)} />;

  const item = items[index];

  function loadItem(i: number) {
    const words = trayWords(items[i]);
    setPlaced(items[i].slots.map(() => null));
    setTiles(shuffle(words));
    setUsed(words.map(() => false));
  }

  function nextItem() {
    const i = (index + 1) % items.length;
    setIndex(i);
    loadItem(i);
  }

  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
  }

  function onTapPlace(ti: number) {
    commit(tapPlace({ placed, used }, tiles, ti));
  }

  // Pull a placed tile back out (mirrors DrillScreen.handleClear). Only while
  // answering — overlays cover the slots during charged/spell phases anyway.
  function handleClear(slotIndex: number) {
    if (useBattleStore.getState().battlePhase !== 'answering') return;
    const word = placed[slotIndex];
    if (word === null) return;
    const next = [...placed];
    next[slotIndex] = null;
    setPlaced(next);
    const ui = used.findIndex((u, i) => u && tiles[i] === word);
    if (ui !== -1) {
      const nextUsed = [...used];
      nextUsed[ui] = false;
      setUsed(nextUsed);
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    commit(placeTile({ placed, used }, tiles, from.index, to.index));
  }

  function submit() {
    // A charged attack is mid-resolution (dodge overlay up) — ignore drill submits until it clears.
    if (useBattleStore.getState().battlePhase !== 'answering') return;
    const correct = isPlacementCorrect(placed, item.answer);
    if (correct) {
      onCorrect();
      setDmgKey((k) => k + 1);
    } else {
      onWrong();
    }
    // Check outcome after store mutation — if battle ended, the win useEffect handles it
    if (useBattleStore.getState().snapshot?.outcome == null) {
      nextItem();
    }
  }

  const lost = snapshot.outcome === 'lose';
  const ready = placed.every((p) => p !== null) && placed.length > 0;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 to-slate-800">
        <BossZone boss={boss} hp={snapshot.bossHp} hpMax={snapshot.bossHpMax} onExit={() => setConfirmExit(true)} />

        {/* Floating damage / event layer */}
        <div className="relative h-0">
          {lastEvent?.kind === 'playerHit' && (
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <DamageNumber id={dmgKey} dmg={lastEvent.dmg} crit={lastEvent.crit} />
            </div>
          )}
          {lastEvent?.kind === 'dodge' && (
            <div className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-sky-300">Dodge!</div>
          )}
        </div>

        {/* Pet HP strip */}
        <div className="flex items-center gap-2 bg-slate-950/40 px-4 py-2">
          <img
            src={petStageSprite(pet)}
            alt={petDisplayName(pet)}
            className="h-10 w-auto"
            draggable={false}
          />
          <div className="flex-1">
            <div className="text-[10px] text-emerald-200">
              {petDisplayName(pet)} · {snapshot.petHp}/{snapshot.petHpMax}
            </div>
            <HpBar value={snapshot.petHp} max={snapshot.petHpMax} tone="pet" />
          </div>
        </div>

        {/* Main drill area */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Thai hint — real field: item.thaiHint */}
          <div className="rounded-xl bg-white/90 p-3 text-center text-lg font-extrabold text-slate-800">
            {item.thaiHint}
          </div>

          {/* Sentence slots — tap a placed tile to pull it back out (handleClear) */}
          <div className="flex flex-1 items-center justify-center">
            <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          </div>

          {/* Attack button — shown only when all slots filled */}
          {ready && (
            <PressButton
              onClick={submit}
              className="min-h-12 rounded-xl bg-indigo-600 font-extrabold text-white"
            >
              Attack! ⚡
            </PressButton>
          )}

          {/* Word tray — real props: tiles, used, onTapPlace */}
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>

        {/* Leave-battle confirm (mirrors the drill's exit dialog) */}
        {confirmExit && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Leave battle?"
              className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
            >
              <p className="text-base font-extrabold text-slate-800">Leave battle?</p>
              <p className="mt-1 text-sm text-slate-500">Your progress won't be saved.</p>
              <div className="mt-4 flex gap-2">
                <PressButton
                  onClick={() => setConfirmExit(false)}
                  className="min-h-11 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-700"
                >
                  Stay
                </PressButton>
                <PressButton
                  onClick={() => { useBattleStore.getState().reset(); setScreen('pickDrill'); }}
                  className="min-h-11 flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-extrabold text-white"
                >
                  Leave
                </PressButton>
              </div>
            </div>
          </div>
        )}

        {/* Loss overlay */}
        {lost && (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/70 p-6 text-center">
            <p className="text-2xl font-extrabold text-white">So close! 💪</p>
            <p className="mt-1 text-white/80">Your pet is tired. Try again?</p>
            <div className="mt-5 flex gap-2">
              <PressButton
                onClick={() => { useBattleStore.getState().reset(); setScreen('pickDrill'); }}
                className="min-h-12 rounded-xl bg-slate-200 px-5 font-bold text-slate-700"
              >
                Leave
              </PressButton>
              <PressButton
                onClick={() => {
                  begin(pet, boss, undefined, items);
                  setIntro(false);
                  setIndex(0);
                  loadItem(0);
                }}
                className="min-h-12 rounded-xl bg-indigo-600 px-6 font-extrabold text-white"
              >
                Try again
              </PressButton>
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>

      {battlePhase === 'charged' && (
        <DodgeSwipe onResolve={resolveSwipe} />
      )}

      {battlePhase === 'spell' && spell && (
        <SpellOverlay challenge={spell} onResolve={resolveSpell} />
      )}

      {enrageKey > 0 && (
        <div
          key={enrageKey}
          className="pointer-events-none fixed inset-0 z-30 animate-[pulse_0.4s_ease-out] bg-rose-600/30"
        />
      )}
    </DndContext>
  );
}
