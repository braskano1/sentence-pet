import { useEffect } from 'react';
import { useGameStore, selectActivePet, postCinematicScreen } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
import { EvolutionCinematic } from './EvolutionCinematic';
import { needsNameEntry } from '../domain/playerName';

/** Routed evolution screen (hatch / L16 / L36). Binds the transient
 * lastStageChange + active pet to the shared cinematic. */
export function EvolutionScreen() {
  const change = useGameStore((s) => s.lastStageChange);
  const pet = useGameStore(selectActivePet);
  const screen = useGameStore((s) => s.screen);
  const clearStageChange = useGameStore((s) => s.clearStageChange);
  const setScreen = useGameStore((s) => s.setScreen);
  const currentCourseId = useGameStore((s) => s.currentCourseId);
  const displayName = useGameStore((s) => s.displayName);
  const defs = usePetDefs();

  // No stage change to show (e.g. a genuine reload landing here) -> leave.
  // Gate on `screen === 'evolution'` so this does NOT fire after onDone routes away:
  // clearStageChange() nulls `change` and re-renders this still-mounted node, but by
  // then `screen` is already the post-cinematic target, so the guard self-suppresses
  // (mirrors RewardHatchScreen).
  useEffect(() => {
    if (!change && screen === 'evolution') setScreen('petRoom');
  }, [change, screen, setScreen]);

  if (!change) return null;

  return (
    <EvolutionCinematic
      from={change.from}
      to={change.to}
      species={pet.species}
      def={resolvePetDef(pet.defId, defs)}
      // Intro hatch (egg -> baby) mystery-rolls a random baby silhouette, like the
      // Mystery Egg / Gacha. Real evolutions (baby/young start) show the real pet.
      mysterySilhouette={change.from === 'egg'}
      onDone={() => {
        clearStageChange();
        setScreen(
          needsNameEntry(change.from, displayName)
            ? 'nameEntry'
            : postCinematicScreen(currentCourseId),
        );
      }}
    />
  );
}
