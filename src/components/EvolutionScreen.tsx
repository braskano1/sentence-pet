import { useEffect } from 'react';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Routed evolution screen (hatch / L16 / L36). Binds the transient
 * lastStageChange + active pet to the shared cinematic. */
export function EvolutionScreen() {
  const change = useGameStore((s) => s.lastStageChange);
  const pet = useGameStore(selectActivePet);
  const clearStageChange = useGameStore((s) => s.clearStageChange);
  const setScreen = useGameStore((s) => s.setScreen);

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
      onDone={() => {
        clearStageChange();
        setScreen('petRoom');
      }}
    />
  );
}
