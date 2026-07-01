import { useEffect } from 'react';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Routed evolution screen (hatch / L16 / L36). Binds the transient
 * lastStageChange + active pet to the shared cinematic. */
export function EvolutionScreen() {
  const change = useGameStore((s) => s.lastStageChange);
  const pet = useGameStore(selectActivePet);
  const clearStageChange = useGameStore((s) => s.clearStageChange);
  const setScreen = useGameStore((s) => s.setScreen);
  const defs = usePetDefs();

  // No stage change to show (e.g. reload while on this screen) -> leave.
  useEffect(() => {
    if (!change) setScreen('petRoom');
  }, [change, setScreen]);

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
        setScreen('petRoom');
      }}
    />
  );
}
