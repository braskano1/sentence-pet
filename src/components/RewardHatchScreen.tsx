import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Plays the egg→baby hatch for a freshly-granted boss-reward pet (lastHatch),
 *  then hands off to the active-pet evolution (if any) or the pet room. */
export function RewardHatchScreen() {
  const pet = useGameStore((s) => s.lastHatch);
  const lastStageChange = useGameStore((s) => s.lastStageChange);
  const clearHatch = useGameStore((s) => s.clearHatch);
  const setScreen = useGameStore((s) => s.setScreen);
  const defs = usePetDefs();

  // Once onDone fires it clears lastHatch and routes itself; the reload guard
  // below must not then clobber that route back to petRoom.
  const handedOff = useRef(false);

  useEffect(() => {
    if (!pet && !handedOff.current) setScreen('petRoom'); // reload guard — nothing to hatch
  }, [pet, setScreen]);

  if (!pet) return null;

  return (
    <EvolutionCinematic
      from="egg"
      to="baby"
      species={pet.species}
      def={resolvePetDef(pet.defId, defs)}
      onDone={() => {
        handedOff.current = true;
        clearHatch();
        setScreen(lastStageChange ? 'evolution' : 'petRoom');
      }}
    />
  );
}
