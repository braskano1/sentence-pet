import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Plays the egg→baby hatch for a freshly-granted boss-reward pet (lastHatch),
 *  then hands off to the active-pet evolution (if any) or the pet room. */
export function RewardHatchScreen() {
  const pet = useGameStore((s) => s.lastHatch);
  const lastStageChange = useGameStore((s) => s.lastStageChange);
  const screen = useGameStore((s) => s.screen);
  const clearHatch = useGameStore((s) => s.clearHatch);
  const setScreen = useGameStore((s) => s.setScreen);
  const defs = usePetDefs();

  // Leave only on a genuine reload that lands here with nothing to hatch (lastHatch
  // is transient/not persisted). We gate on `screen === 'rewardHatch'` so this does NOT
  // fire after onDone routes away: clearHatch() nulls lastHatch and re-renders this
  // still-mounted node (AnimatePresence mode="wait"), but `screen` is already 'evolution'
  // /'petRoom' by then, so the guard self-suppresses without a ref.
  useEffect(() => {
    if (!pet && screen === 'rewardHatch') setScreen('petRoom');
  }, [pet, screen, setScreen]);

  if (!pet) return null;

  return (
    <EvolutionCinematic
      from="egg"
      to="baby"
      species={pet.species}
      def={resolvePetDef(pet.defId, defs)}
      onDone={() => {
        clearHatch();
        setScreen(lastStageChange ? 'evolution' : 'petRoom');
      }}
    />
  );
}
